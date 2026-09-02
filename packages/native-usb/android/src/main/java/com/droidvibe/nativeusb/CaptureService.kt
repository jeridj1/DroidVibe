package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import android.util.Log
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * RP2040 multi-mode controller — manages the Pico as a universal hardware tool.
 *
 * Modes:
 *  - LOGIC_ANALYZER: PIO-based GPIO sampling at up to ~1 MHz, 8 channels
 *  - SWD_PROGRAMMER: Serial Wire Debug for ARM Cortex-M targets
 *  - JTAG_PROGRAMMER: JTAG for various targets
 *  - AVR_ISP_PROGRAMMER: SPI-based ISP for AVR chips
 *  - SERIAL_BRIDGE: Pass-through USB-serial to target
 *
 * Workflow:
 *  1. User selects a mode in the app
 *  2. App flashes the matching helper firmware UF2 via PICOBOOT
 *  3. Pico reboots running the helper firmware
 *  4. App communicates with the helper firmware over CDC serial
 *
 * The helper firmware must be compiled from the Pico SDK source under
 * firmware/ and bundled as assets. See firmware/README.md for build
 * instructions.
 */
object RP2040Controller {
    private const val TAG = "RP2040Controller"

    const val RP2040_VID = 0x2E8A
    const val PID_BOOTSEL = 0x0003
    const val PID_SERIAL = 0x000A
    const val PID_MICROPYTHON = 0x0005

    const val CMD_ENTER_LA_MODE: Byte = 0x02
    const val CMD_EXIT_LA_MODE: Byte = 0x03
    const val CMD_START_CAPTURE: Byte = 0x04
    const val CMD_STOP_CAPTURE: Byte = 0x05
    const val CMD_ENTER_BOOTLOADER: Byte = 0x00
    const val CMD_ENTER_BOOTLOADER_ALT: Byte = 0x01

    const val CMD_SWD_WRITE: Byte = 0x10
    const val CMD_SWD_READ: Byte = 0x11
    const val CMD_JTAG_WRITE: Byte = 0x20
    const val CMD_JTAG_READ: Byte = 0x21
    const val CMD_JTAG_TMS_SEQ: Byte = 0x22
    const val CMD_JTAG_TDI_TDO_SEQ: Byte = 0x23

    data class CaptureResult(
        val actualSamples: Int,
        val durationUs: Long,
        val data: ByteArray,
        val sampleRate: Int,
        val channels: Int,
    )

    fun isRP2040(device: UsbDevice): Boolean =
        device.vendorId == RP2040_VID &&
            (device.productId == PID_BOOTSEL || device.productId == PID_SERIAL || device.productId == PID_MICROPYTHON)

    fun isBootSel(device: UsbDevice): Boolean =
        device.vendorId == RP2040_VID && device.productId == PID_BOOTSEL

    fun isApplicationMode(device: UsbDevice): Boolean =
        device.vendorId == RP2040_VID && device.productId != PID_BOOTSEL

    fun capture(driver: UsbSerialDriver, sampleRate: Int, numSamples: Int, channels: Int): CaptureResult {
        val configCmd = byteArrayOf(
            CMD_ENTER_LA_MODE,
            (sampleRate and 0xFF).toByte(),
            ((sampleRate shr 8) and 0xFF).toByte(),
            ((sampleRate shr 16) and 0xFF).toByte(),
            channels.toByte(),
        )
        if (driver.write(configCmd) != configCmd.size) throw IOException("Failed to send LA mode command")
        Thread.sleep(100)
        driver.write(byteArrayOf(CMD_START_CAPTURE))
        Thread.sleep(50)
        val header = driver.synchronizedRead(4, 5000)
        if (header.size < 4) {
            driver.write(byteArrayOf(CMD_STOP_CAPTURE))
            throw IOException("Capture timeout: no data header received. Ensure the Pico is running the LA helper firmware.")
        }
        val actualCount = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN).int
        val toRead = if (actualCount > 0) actualCount else numSamples
        val sampleBytes = driver.synchronizedRead(toRead, 10000)
        driver.write(byteArrayOf(CMD_STOP_CAPTURE))
        Thread.sleep(50)
        val actual = sampleBytes.size
        val durationUs = if (sampleRate > 0) (actual.toLong() * 1_000_000L) / sampleRate else 0L
        return CaptureResult(actual, durationUs, sampleBytes, sampleRate, channels)
    }

    /** Trigger the standard RP2040 USB CDC 1200-baud reset into BOOTSEL. */
    fun enterBootselViaSerial(driver: UsbSerialDriver): Boolean {
        return try {
            driver.touch1200()
        } catch (e: Exception) {
            Log.w(TAG, "enterBootselViaSerial failed: " + e.message)
            false
        }
    }

    fun jtagTransfer(driver: UsbSerialDriver, tms: ByteArray, tdi: ByteArray, bitCount: Int): ByteArray {
        val cmd = ByteBuffer.allocate(3 + tms.size + tdi.size).order(ByteOrder.LITTLE_ENDIAN)
        cmd.put(CMD_JTAG_TDI_TDO_SEQ)
        cmd.putShort(bitCount.toShort())
        cmd.put(tms)
        cmd.put(tdi)
        driver.write(cmd.array())
        Thread.sleep(10)
        return driver.synchronizedRead((bitCount + 7) / 8, 2000)
    }

    fun swdTransfer(driver: UsbSerialDriver, isRead: Boolean, apDp: Int, addr: Int, data: Int): Int {
        val cmd = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN)
        cmd.put(if (isRead) CMD_SWD_READ else CMD_SWD_WRITE)
        cmd.put(apDp.toByte())
        cmd.putInt(addr)
        cmd.putInt(data)
        driver.write(cmd.array())
        Thread.sleep(10)
        val resp = driver.synchronizedRead(4, 2000)
        if (resp.size < 4) throw IOException("SWD transfer timeout")
        return ByteBuffer.wrap(resp).order(ByteOrder.LITTLE_ENDIAN).int
    }
}

typealias CaptureService = RP2040Controller
