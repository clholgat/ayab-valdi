package com.snap.modules.serial

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.os.Build
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.snapchat.client.valdi_core.ModuleFactory
import com.snap.valdi.modules.RegisterValdiModule
import com.snap.modules.serial.SerialModuleFactory
import com.snap.modules.serial.SerialModule
import com.snap.valdi.promise.Promise
import com.snap.valdi.promise.ResolvablePromise
import com.snap.valdi.promise.ResolvedPromise
import java.io.IOException
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

private const val USB_PERMISSION_ACTION = "com.snap.modules.serial.USB_PERMISSION"

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
        context = SerialAppContext.applicationContext
            ?: throw IOException(
                "Android Context is not yet available (SerialAppContextProvider hasn't run)."
            )

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
            } catch (e: IOException) {
                // If write fails, connection might be broken
                isOpen.set(false)
            } catch (e: Exception) {
                // Log error
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

    override fun get_serial_ports(): List<String> {
        // Only devices we already hold USB permission for — matches the web
        // implementation's "previously authorized USB devices" contract. A
        // newly-attached, not-yet-permitted device is only reachable via
        // request_serial_port()'s consent flow, same as on web.
        val ctx = SerialAppContext.applicationContext ?: return emptyList()
        val manager = ctx.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: return emptyList()
        return manager.deviceList.values
            .filter { device ->
                manager.hasPermission(device) &&
                    UsbSerialProber.getDefaultProber().probeDevice(device) != null
            }
            .map { it.deviceName }
    }

    override fun consumeReadBuffer(bytesToConsume: Double) {
        bufferLock.withLock {
            var remaining = bytesToConsume.toInt()
            while (remaining > 0 && readBuffer.isNotEmpty()) {
                readBuffer.poll()
                remaining--
            }
        }
    }

    override fun request_serial_port(): Promise<String?> {
        val ctx = SerialAppContext.applicationContext ?: return ResolvedPromise(null)
        val manager = ctx.getSystemService(Context.USB_SERVICE) as? UsbManager
            ?: return ResolvedPromise(null)

        val candidate = manager.deviceList.values.firstOrNull { device ->
            !manager.hasPermission(device) &&
                UsbSerialProber.getDefaultProber().probeDevice(device) != null
        } ?: return ResolvedPromise(null)

        val promise = ResolvablePromise<String?>()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(receiverContext: Context, intent: Intent) {
                if (intent.action != USB_PERMISSION_ACTION) {
                    return
                }
                try {
                    ctx.unregisterReceiver(this)
                } catch (e: Exception) {
                    // Already unregistered — ignore.
                }
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                promise.fulfillSuccess(if (granted) candidate.deviceName else null)
            }
        }

        val filter = IntentFilter(USB_PERMISSION_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            ctx.registerReceiver(receiver, filter)
        }

        val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        val permissionIntent = PendingIntent.getBroadcast(
            ctx,
            0,
            Intent(USB_PERMISSION_ACTION),
            pendingIntentFlags,
        )
        manager.requestPermission(candidate, permissionIntent)

        return promise
    }

    override fun refresh_serial_ports(): Promise<List<String>> {
        // UsbManager.deviceList is always current — no separate rescan step needed.
        return ResolvedPromise(get_serial_ports())
    }

    override fun browse_ayab_mdns(): List<Map<String, Any?>> {
        return emptyList()
    }

    override fun requires_usb_permission_prompt(): Boolean {
        // Android USB host mode requires runtime consent per not-yet-permitted
        // device — see request_serial_port() above.
        return true
    }

    override fun prompt_websocket_url(): String? {
        // No manual URL entry on Android — network devices are discovered via
        // browse_ayab_mdns() instead (once implemented).
        return null
    }

    override fun registerDataAvailableResolver(resolver: () -> Unit): () -> Unit {
        // No async read notifications in the v1 prep-only build.
        return {}
    }

    override fun in_waiting(): Double {
        synchronized(this) {
            if (!isOpen.get() || usbPort == null) {
                return 0.0
            }

            // usb-serial-for-android has no bytes-available query; the read
            // thread drains the port into readBuffer, so its size is the count.
            val bufferSize = bufferLock.withLock { readBuffer.size }
            return bufferSize.toDouble()
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
