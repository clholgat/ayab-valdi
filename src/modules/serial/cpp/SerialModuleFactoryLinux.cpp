// Linux implementation of Serial module
#include "valdi_core/cpp/JavaScript/ModuleFactoryRegistry.hpp"
#include "valdi_core/cpp/Utils/ValueFunctionWithCallable.hpp"
#include "valdi_core/cpp/Utils/ValueUtils.hpp"
#include "valdi_core/cpp/Utils/StringBox.hpp"
#include "valdi_core/cpp/Utils/ValueArray.hpp"
#include "valdi_core/cpp/Utils/ValueTypedArray.hpp"
#include "valdi_core/cpp/Utils/ByteBuffer.hpp"
#include <iostream>
#include <iomanip>
#include <string>
#include <cstring>
#include <mutex>
#include <vector>
#include <filesystem>
#include <algorithm>

// POSIX includes (Linux)
#include <fcntl.h>
#include <termios.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <poll.h>
#include <errno.h>

using namespace Valdi;

namespace snap::valdi::serial {

// Serial port configuration constants (matching Python implementation)
static const int BAUD_RATE = 115200;
static const double TIMEOUT_SECONDS = 0.1;

// Serial port handle (POSIX file descriptor)
typedef int SerialHandle;
static const SerialHandle INVALID_HANDLE = -1;

// Serial port state
struct SerialPortState {
    SerialHandle handle;
    bool isOpen;
    std::string uri;
    std::mutex mutex;
    std::vector<uint8_t> readBuffer;
    
    SerialPortState() : handle(INVALID_HANDLE), isOpen(false) {}
};

static SerialPortState g_serialPort;

// Helper function to get serial ports on Linux by listing /dev/tty* devices
static std::vector<std::string> getSerialPortsLinux() {
    std::vector<std::string> ports;
    
    try {
        std::filesystem::path devPath("/dev");
        if (std::filesystem::exists(devPath) && std::filesystem::is_directory(devPath)) {
            for (const auto& entry : std::filesystem::directory_iterator(devPath)) {
                std::string filename = entry.path().filename().string();
                // Filter for common serial port patterns
                if (filename.find("ttyUSB") == 0 || 
                    filename.find("ttyACM") == 0 ||
                    filename.find("ttyS") == 0 ||
                    filename.find("ttyAMA") == 0) {
                    ports.push_back(entry.path().string());
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error listing serial ports: " << e.what() << std::endl;
    }
    
    // Sort ports for consistent ordering
    std::sort(ports.begin(), ports.end());
    return ports;
}

// POSIX (Linux) serial port functions
static bool openSerialPort(const std::string& uri) {
    std::lock_guard<std::mutex> lock(g_serialPort.mutex);
    
    if (g_serialPort.isOpen) {
        std::cerr << "openSerialPort: Port already open" << std::endl;
        return false; // Already open
    }
    
    // Open serial port with O_RDWR | O_NOCTTY | O_EXCL (blocking mode)
    // O_EXCL provides exclusive access (like pyserial's exclusive=True)
    // We use blocking mode with termios timeout (like pyserial)
    int fd = open(uri.c_str(), O_RDWR | O_NOCTTY | O_EXCL);
    if (fd < 0) {
        std::cerr << "openSerialPort: Failed to open " << uri << ", errno: " << errno << std::endl;
        return false;
    }
    
    // Configure termios
    struct termios tty;
    if (tcgetattr(fd, &tty) != 0) {
        std::cerr << "openSerialPort: Failed to get termios attributes, errno: " << errno << std::endl;
        close(fd);
        return false;
    }
    
    // Set baud rate
    cfsetospeed(&tty, B115200);
    cfsetispeed(&tty, B115200);
    
    // 8N1 configuration
    tty.c_cflag &= ~PARENB;        // No parity
    tty.c_cflag &= ~CSTOPB;        // 1 stop bit
    tty.c_cflag &= ~CSIZE;         // Clear size bits
    tty.c_cflag |= CS8;             // 8 bits
    tty.c_cflag &= ~CRTSCTS;        // No hardware flow control
    tty.c_cflag |= CREAD | CLOCAL;  // Enable receiver, ignore modem controls
    
    // Disable canonical mode and echo
    tty.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);
    
    // Disable software flow control
    tty.c_iflag &= ~(IXON | IXOFF | IXANY);
    tty.c_iflag &= ~(IGNBRK | BRKINT | PARMRK | ISTRIP | INLCR | IGNCR | ICRNL);
    
    // Raw output
    tty.c_oflag &= ~OPOST;
    
    // Blocking mode with timeout: block until data available or timeout
    // This matches pyserial's behavior with timeout=0.1
    tty.c_cc[VMIN] = 0;   // Don't wait for minimum bytes
    tty.c_cc[VTIME] = 1;   // 0.1 second timeout (VTIME is in tenths of seconds)
    
    // Apply termios settings
    if (tcsetattr(fd, TCSANOW, &tty) != 0) {
        std::cerr << "openSerialPort: Failed to set termios attributes, errno: " << errno << std::endl;
        close(fd);
        return false;
    }
    
    // Handle DTR/RTS signals for Arduino reset
    // Many Arduinos reset when DTR goes low, then high
    // This matches pyserial's behavior with exclusive=True
    int status;
    if (ioctl(fd, TIOCMGET, &status) == 0) {
        // Toggle DTR low to reset Arduino
        status &= ~TIOCM_DTR;
        ioctl(fd, TIOCMSET, &status);
        usleep(100000); // 100ms delay for reset
        
        // Set DTR and RTS high (normal state)
        status |= TIOCM_DTR;
        status |= TIOCM_RTS;
        ioctl(fd, TIOCMSET, &status);
        
        // Wait for Arduino to boot (2 seconds like pyserial)
        usleep(2000000); // 2 seconds
    }
    
    // Flush any existing data in buffers
    tcflush(fd, TCIOFLUSH);
    
    g_serialPort.handle = fd;
    g_serialPort.isOpen = true;
    g_serialPort.uri = uri;
    g_serialPort.readBuffer.clear();
    
    std::cout << "openSerialPort: Successfully opened and configured port: " << uri << std::endl;
    std::cout << "openSerialPort: File descriptor: " << fd << ", blocking mode with 0.1s timeout" << std::endl;
    
    return true;
}

static void closeSerialPort() {
    std::lock_guard<std::mutex> lock(g_serialPort.mutex);
    
    if (g_serialPort.isOpen && g_serialPort.handle != INVALID_HANDLE) {
        close(g_serialPort.handle);
        g_serialPort.handle = INVALID_HANDLE;
        g_serialPort.isOpen = false;
        g_serialPort.uri.clear();
        g_serialPort.readBuffer.clear();
    }
}

static int readFromSerialPort(uint8_t* buffer, size_t maxSize) {
    int fd;
    {
        std::lock_guard<std::mutex> lock(g_serialPort.mutex);
        
        if (!g_serialPort.isOpen || g_serialPort.handle == INVALID_HANDLE) {
            return 0;
        }
        fd = g_serialPort.handle;
    }
    
    // Blocking read with timeout (configured via termios VTIME)
    // This matches pyserial's behavior: blocks until data available or timeout
    // Release mutex before read to avoid holding it during I/O
    ssize_t bytesRead = read(fd, buffer, maxSize);
    
    if (bytesRead < 0) {
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            // Timeout - no data available (this is expected when timeout expires)
            return 0;
        }
        std::cerr << "readFromSerialPort: Read error, errno: " << errno << " (" << strerror(errno) << ")" << std::endl;
        std::cerr.flush();
        return 0;
    }
    
    if (bytesRead > 0) {
        std::cout << "readFromSerialPort: Read " << bytesRead << " bytes (hex: ";
        for (int i = 0; i < bytesRead && i < 16; i++) {
            std::cout << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(buffer[i]) << " ";
        }
        std::cout << std::dec << ")" << std::endl;
        std::cout.flush();
    }
    
    return static_cast<int>(bytesRead);
}

static int writeToSerialPort(const uint8_t* buffer, size_t size) {
    std::lock_guard<std::mutex> lock(g_serialPort.mutex);
    
    if (!g_serialPort.isOpen || g_serialPort.handle == INVALID_HANDLE) {
        std::cerr << "writeToSerialPort: Port not open or invalid handle" << std::endl;
        return 0;
    }
    
    std::cout << "writeToSerialPort: Writing " << size << " bytes (hex: ";
    for (size_t i = 0; i < size && i < 16; i++) {
        std::cout << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(buffer[i]) << " ";
    }
    std::cout << std::dec << ")" << std::endl;
    
    ssize_t bytesWritten = write(g_serialPort.handle, buffer, size);
    if (bytesWritten < 0) {
        std::cerr << "writeToSerialPort: Write error, errno: " << errno << " (" << strerror(errno) << ")" << std::endl;
        return 0; // Error
    }
    
    if (bytesWritten != static_cast<ssize_t>(size)) {
        std::cerr << "writeToSerialPort: Warning: Only wrote " << bytesWritten << " of " << size << " bytes" << std::endl;
    }
    
    // Flush the output to ensure data is sent immediately
    if (tcdrain(g_serialPort.handle) < 0) {
        std::cerr << "writeToSerialPort: tcdrain error, errno: " << errno << " (" << strerror(errno) << ")" << std::endl;
    }
    
    std::cout << "writeToSerialPort: Successfully wrote " << bytesWritten << " bytes and flushed" << std::endl;
    
    return static_cast<int>(bytesWritten);
}

static int getBytesAvailable() {
    std::lock_guard<std::mutex> lock(g_serialPort.mutex);
    
    if (!g_serialPort.isOpen || g_serialPort.handle == INVALID_HANDLE) {
        return static_cast<int>(g_serialPort.readBuffer.size());
    }
    
    int bytesAvailable = 0;
    if (ioctl(g_serialPort.handle, FIONREAD, &bytesAvailable) == 0) {
        return bytesAvailable + static_cast<int>(g_serialPort.readBuffer.size());
    }
    
    return static_cast<int>(g_serialPort.readBuffer.size());
}

static void flushSerialPort() {
    std::lock_guard<std::mutex> lock(g_serialPort.mutex);
    
    if (g_serialPort.isOpen && g_serialPort.handle != INVALID_HANDLE) {
        tcflush(g_serialPort.handle, TCIOFLUSH);
        g_serialPort.readBuffer.clear();
    }
}

class DesktopSerialModule : public valdi_core::ModuleFactory {
public:
    DesktopSerialModule() = default;
    ~DesktopSerialModule() override = default;

    Valdi::StringBox getModulePath() final {
        return Valdi::StringBox::fromCString("serial/src/Serial");
    }

    Valdi::Value loadModule() final {
        // get_serial_ports function
        auto getSerialPortsFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                std::vector<std::string> ports = getSerialPortsLinux();
                auto portArray = ValueArray::make(ports.size());
                for (size_t i = 0; i < ports.size(); i++) {
                    (*portArray)[i] = Valdi::Value(StringBox::fromCString(ports[i].c_str()));
                }
                return Valdi::Value(portArray);
            }
        );

        // close_serial function
        auto closeSerialFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                closeSerialPort();
                return Valdi::Value::undefined();
            }
        );

        // open_serial function
        auto openSerialFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                if (callContext.getParametersSize() != 1) {
                    std::cerr << "open_serial: Invalid number of parameters" << std::endl;
                    return Valdi::Value::undefined();
                }
                StringBox uri = callContext.getParameterAsString(0);
                std::string uriStr(uri.toStringView());
                
                std::cout << "open_serial: Attempting to open port: " << uriStr << std::endl;
                
                if (!openSerialPort(uriStr)) {
                    // Failed to open serial port
                    std::cerr << "open_serial: Failed to open serial port: " << uriStr << std::endl;
                    return Valdi::Value::undefined();
                }
                
                std::cout << "open_serial: Successfully opened serial port: " << uriStr << std::endl;
                return Valdi::Value::undefined();
            }
        );

        // write function
        auto writeFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                if (callContext.getParametersSize() != 1) {
                    return Valdi::Value::undefined();
                }
                auto typedArray = callContext.getParameter(0).checkedTo<Ref<ValueTypedArray>>(callContext.getExceptionTracker());
                if (typedArray == nullptr) {
                    return Valdi::Value::undefined();
                }
                BytesView buffer = typedArray->getBuffer();
                
                if (buffer.size() > 0) {
                    writeToSerialPort(buffer.data(), buffer.size());
                }
                
                return Valdi::Value::undefined();
            }
        );

        // read function
        // Non-blocking read: returns immediately with any available data
        // JavaScript handles polling and timing
        auto readFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                // Log immediately to verify function is called
                std::cout << "*** NATIVE read() CALLED ***" << std::endl;
                std::cout.flush();
                std::cerr << "*** NATIVE read() CALLED (stderr) ***" << std::endl;
                std::cerr.flush();
                
                // Read up to 256 bytes (non-blocking, returns immediately)
                uint8_t readBuffer[256];
                int bytesRead = readFromSerialPort(readBuffer, sizeof(readBuffer));
                
                std::cout << "*** NATIVE read() returned " << bytesRead << " bytes ***" << std::endl;
                std::cout.flush();
                std::cerr << "*** NATIVE read() returned " << bytesRead << " bytes (stderr) ***" << std::endl;
                std::cerr.flush();
                
                if (bytesRead > 0) {
                    auto byteBuffer = Valdi::makeShared<Valdi::ByteBuffer>();
                    byteBuffer->append(readBuffer, readBuffer + bytesRead);
                    auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                        Valdi::TypedArrayType::Uint8Array, byteBuffer->toBytesView());
                    return Valdi::Value(typedArray);
                }
                
                // Return empty Uint8Array (no data available)
                auto byteBuffer = Valdi::makeShared<Valdi::ByteBuffer>();
                auto typedArray = Valdi::makeShared<Valdi::ValueTypedArray>(
                    Valdi::TypedArrayType::Uint8Array, byteBuffer->toBytesView());
                return Valdi::Value(typedArray);
            }
        );

        // is_open function
        auto isOpenFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                std::lock_guard<std::mutex> lock(g_serialPort.mutex);
                return Valdi::Value(g_serialPort.isOpen);
            }
        );

        // in_waiting function
        auto inWaitingFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                return Valdi::Value(getBytesAvailable());
            }
        );

        // flush function
        auto flushFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                flushSerialPort();
                return Valdi::Value::undefined();
            }
        );

        auto browseAyabMdnsFunction = Valdi::makeShared<Valdi::ValueFunctionWithCallable>(
            [](const Valdi::ValueFunctionCallContext& callContext) -> Valdi::Value {
                (void)callContext;
                return Valdi::Value(Valdi::ValueArray::make(0));
            }
        );

        return Valdi::Value()
            .setMapValue("get_serial_ports", Valdi::Value(getSerialPortsFunction))
            .setMapValue("close_serial", Valdi::Value(closeSerialFunction))
            .setMapValue("open_serial", Valdi::Value(openSerialFunction))
            .setMapValue("write", Valdi::Value(writeFunction))
            .setMapValue("read", Valdi::Value(readFunction))
            .setMapValue("is_open", Valdi::Value(isOpenFunction))
            .setMapValue("in_waiting", Valdi::Value(inWaitingFunction))
            .setMapValue("flush", Valdi::Value(flushFunction))
            .setMapValue("browse_ayab_mdns", Valdi::Value(browseAyabMdnsFunction));
    }
};

Valdi::RegisterModuleFactory kRegisterDesktopModule([]() { return std::make_shared<DesktopSerialModule>(); });

} // namespace snap::valdi::serial
