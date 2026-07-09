package com.snap.modules.serial

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.snapchat.client.valdi_core.ModuleFactory
import com.snap.valdi.modules.RegisterValdiModule
import com.snap.modules.serial.SerialModuleFactory
import com.snap.modules.serial.SerialModule
import java.io.IOException
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

@RegisterValdiModule
class SerialModuleFactoryImpl: SerialModuleFactory() {

    override fun onLoadModule(): SerialModule {
        return SerialModuleImpl()
    }
}

class SerialModuleImpl: SerialModule {
    private val isOpen = AtomicBoolean(false)
    private val readBuffer = ConcurrentLinkedQueue<Byte>()
    private val bufferLock = ReentrantLock()
    
    // USB Serial port
    private var usbPort: UsbSerialPort? = null
    private var usbConnection: UsbDeviceConnection? = null
    private var usbDevice: UsbDevice? = null
    private var usbManager: UsbManager? = null
    private var context: Context? = null
    
    // Thread for reading from USB serial
    private var readThread: Thread? = null
    private val shouldStopReading = AtomicBoolean(false)
    
    // Default serial port parameters (matching Python implementation)
    private val BAUD_RATE = 115200
    private val DATA_BITS = 8
    private val STOP_BITS = UsbSerialPort.STOPBITS_1
    private val PARITY = UsbSerialPort.PARITY_NONE

    override fun close_serial() {
        synchronized(this) {
            if (!isOpen.get()) {
                return
            }
            
            shouldStopReading.set(true)
            
            try {
                // Stop read thread
                readThread?.interrupt()
                readThread?.join(1000)
                readThread = null
                
                // Close USB serial port
                usbPort?.close()
                usbConnection?.close()
                
                usbPort = null
                usbConnection = null
                usbDevice = null
                
                readBuffer.clear()
                isOpen.set(false)
            } catch (e: Exception) {
                // Log error if logging is available
            }
        }
    }

    override fun open_serial(uri: String) {
        synchronized(this) {
            if (isOpen.get()) {
                close_serial()
            }
            
            try {
                openUsbSerial(uri)
            } catch (e: Exception) {
                // Log error: "Could not open serial port $uri: ${e.message}"
                isOpen.set(false)
                throw IOException("Could not open serial port $uri: ${e.message}", e)
            }
        }
    }
    
    private fun openUsbSerial(uri: String) {
        // Get Android Context - this needs to be provided by Valdi runtime
        // For now, we'll try to get it from the application context
        // In a real implementation, this should be passed from the Valdi runtime
        context = try {
            // Try to get context from application
            // This is a placeholder - actual implementation needs Valdi runtime support
            null // Will be set when Valdi provides context access
        } catch (e: Exception) {
            null
        }
        
        if (context == null) {
            throw UnsupportedOperationException(
                "Android Context is required for USB serial communication. " +
                "This needs to be provided by the Valdi runtime."
            )
        }
        
        usbManager = context!!.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: throw IOException("USB service not available")
        
        // Find USB device
        // URI format can be:
        // - Device name (e.g., "/dev/ttyUSB0")
        // - USB device path
        // - Vendor ID:Product ID format
        usbDevice = findUsbDevice(uri, usbManager!!)
            ?: throw IOException("USB device not found: $uri")
        
        // Request USB permissions if needed
        // Note: This typically requires user interaction via a broadcast receiver
        // For now, we assume permissions are already granted
        val hasPermission = usbManager!!.hasPermission(usbDevice!!)
        if (!hasPermission) {
            throw IOException("USB permission not granted for device: $uri")
        }
        
        // Open device connection
        usbConnection = usbManager!!.openDevice(usbDevice!!)
            ?: throw IOException("Failed to open USB device connection")
        
        // Probe for serial drivers
        val driver: UsbSerialDriver = UsbSerialProber.getDefaultProber().probeDevice(usbDevice!!)
            ?: throw IOException("No USB serial driver found for device")
        
        // Get the first available port (most devices have one port)
        if (driver.ports.isEmpty()) {
            throw IOException("No serial ports available on device")
        }
        
        usbPort = driver.ports[0]
        
        // Open the serial port
        usbPort!!.open(usbConnection!!)
        
        // Configure serial port parameters (115200 baud, 8N1 - matching Python implementation)
        usbPort!!.setParameters(BAUD_RATE, DATA_BITS, STOP_BITS, PARITY)
        
        // Start read thread
        startReadThread()
        
        isOpen.set(true)
    }
    
    private fun findUsbDevice(uri: String, usbManager: UsbManager): UsbDevice? {
        // Try different URI formats
        val deviceList = usbManager.deviceList
        
        // Format 1: Vendor ID:Product ID (e.g., "1234:5678")
        if (uri.contains(":")) {
            val parts = uri.split(":")
            if (parts.size == 2) {
                try {
                    val vendorId = parts[0].toInt(16)
                    val productId = parts[1].toInt(16)
                    return deviceList.values.firstOrNull { device ->
                        device.vendorId == vendorId && device.productId == productId
                    }
                } catch (e: NumberFormatException) {
                    // Invalid format, try other methods
                }
            }
        }
        
        // Format 2: Device name (try to match by device name)
        // This is less reliable but sometimes the URI might be a device name
        for (device in deviceList.values) {
            val deviceName = device.deviceName
            if (uri == deviceName || deviceName.contains(uri)) {
                return device
            }
        }
        
        // Format 3: Try to find any USB serial device
        // If URI is empty or generic, return first available device
        if (uri.isEmpty() || uri == "auto") {
            return deviceList.values.firstOrNull { device ->
                UsbSerialProber.getDefaultProber().probeDevice(device) != null
            }
        }
        
        return null
    }

    override fun write(data: ByteArray) {
        synchronized(this) {
            if (!isOpen.get() || usbPort == null) {
                return
            }
            
            try {
                usbPort?.write(data, 0)
            } catch (e: Exception) {
                // Log error
                // If write fails, connection might be broken
                if (e is IOException) {
                    isOpen.set(false)
                }
            }
        }
    }

    override fun read(): ByteArray {
        synchronized(this) {
            if (!isOpen.get()) {
                return ByteArray(0)
            }
            
            try {
                // Read from buffer (populated by read thread)
                bufferLock.withLock {
                    if (readBuffer.isEmpty()) {
                        return ByteArray(0)
                    }
                    val bytes = mutableListOf<Byte>()
                    while (readBuffer.isNotEmpty() && bytes.size < 256) {
                        readBuffer.poll()?.let { bytes.add(it) }
                    }
                    return bytes.toByteArray()
                }
            } catch (e: Exception) {
                // Log error
                if (e is IOException) {
                    isOpen.set(false)
                }
                return ByteArray(0)
            }
        }
    }

    override fun is_open(): Boolean {
        return isOpen.get() && usbPort != null
    }

    override fun in_waiting(): Int {
        synchronized(this) {
            if (!isOpen.get() || usbPort == null) {
                return 0
            }
            
            // Return bytes available in buffer + bytes available in USB port
            val bufferSize = bufferLock.withLock { readBuffer.size }
            val portAvailable = try {
                usbPort?.bytesAvailable ?: 0
            } catch (e: Exception) {
                0
            }
            return bufferSize + portAvailable
        }
    }

    override fun flush() {
        synchronized(this) {
            if (!isOpen.get() || usbPort == null) {
                return
            }
            
            try {
                // Flush USB serial port buffers (both input and output)
                usbPort?.purgeHwBuffers(true, true)
                // Also clear our read buffer
                bufferLock.withLock {
                    readBuffer.clear()
                }
            } catch (e: Exception) {
                // Log error
            }
        }
    }
    
    private fun startReadThread() {
        if (readThread != null) {
            return
        }
        
        shouldStopReading.set(false)
        readThread = Thread {
            val buffer = ByteArray(256)
            while (!shouldStopReading.get() && isOpen.get() && !Thread.currentThread().isInterrupted) {
                try {
                    val bytesRead = usbPort?.read(buffer, 100) ?: 0
                    if (bytesRead > 0) {
                        bufferLock.withLock {
                            for (i in 0 until bytesRead) {
                                readBuffer.offer(buffer[i])
                            }
                        }
                    }
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    if (e is IOException) {
                        isOpen.set(false)
                    }
                    break
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }
}
