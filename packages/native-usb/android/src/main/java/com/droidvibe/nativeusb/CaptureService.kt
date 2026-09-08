package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** RP2040 helper-firmware transport controller. */
object RP2040Controller {
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
    const val CMD_JTAG_TDI_TDO_SEQ: Byte = 0x23
    const val CMD_AVR_ISP_XFER: Byte = 0x30

    data class CaptureResult(val actualSamples: Int, val durationUs: Long, val data: ByteArray, val sampleRate: Int, val channels: Int)

    fun isRP2040(device: UsbDevice): Boolean = device.vendorId == RP2040_VID && (device.productId == PID_BOOTSEL || device.productId == PID_SERIAL || device.productId == PID_MICROPYTHON)
    fun isBootSel(device: UsbDevice): Boolean = device.vendorId == RP2040_VID && device.productId == PID_BOOTSEL
    fun isApplicationMode(device: UsbDevice): Boolean = device.vendorId == RP2040_VID && device.productId != PID_BOOTSEL

    fun capture(driver: UsbSerialDriver, sampleRate: Int, numSamples: Int, channels: Int): CaptureResult {
        val configCmd = byteArrayOf(CMD_ENTER_LA_MODE, (sampleRate and 0xFF).toByte(), ((sampleRate shr 8) and 0xFF).toByte(), ((sampleRate shr 16) and 0xFF).toByte(), channels.toByte())
        if (driver.write(configCmd) != configCmd.size) throw IOException("Failed to send LA mode command")
        Thread.sleep(100)
        driver.write(byteArrayOf(CMD_START_CAPTURE)); Thread.sleep(50)
        val header = driver.synchronizedRead(4, 5000)
        if (header.size < 4) { driver.write(byteArrayOf(CMD_STOP_CAPTURE)); throw IOException("Capture timeout: no data header received") }
        val actualCount = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN).int
        val toRead = if (actualCount > 0) actualCount else numSamples
        val sampleBytes = driver.synchronizedRead(toRead, 10000)
        driver.write(byteArrayOf(CMD_STOP_CAPTURE)); Thread.sleep(50)
        return CaptureResult(sampleBytes.size, if (sampleRate > 0) (sampleBytes.size.toLong() * 1_000_000L) / sampleRate else 0L, sampleBytes, sampleRate, channels)
    }

    fun enterBootselViaSerial(driver: UsbSerialDriver): Boolean = try { driver.write(byteArrayOf(CMD_ENTER_BOOTLOADER)); Thread.sleep(1000); true } catch (_: Exception) { false }

    fun jtagTransfer(driver: UsbSerialDriver, tms: ByteArray, tdi: ByteArray, bitCount: Int): ByteArray {
        require(bitCount >= 0 && bitCount <= 32767) { "invalid JTAG bit count" }
        val expected = (bitCount + 7) / 8
        require(tms.size >= expected && tdi.size >= expected) { "JTAG buffers are too short" }
        val cmd = ByteBuffer.allocate(3 + expected + expected).order(ByteOrder.LITTLE_ENDIAN)
        cmd.put(CMD_JTAG_TDI_TDO_SEQ); cmd.putShort(bitCount.toShort()); cmd.put(tms, 0, expected); cmd.put(tdi, 0, expected)
        if (driver.write(cmd.array()) != cmd.capacity()) throw IOException("Failed to write JTAG sequence")
        return driver.synchronizedRead(expected, 5000)
    }

    fun swdTransfer(driver: UsbSerialDriver, isRead: Boolean, apDp: Int, addr: Int, data: Int): Int {
        val cmd = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN)
        cmd.put(if (isRead) CMD_SWD_READ else CMD_SWD_WRITE); cmd.put(apDp.toByte()); cmd.putInt(addr); cmd.putInt(data)
        if (driver.write(cmd.array()) != cmd.capacity()) throw IOException("Failed to write SWD request")
        val resp = driver.synchronizedRead(5, 3000)
        if (resp.size < 5) throw IOException("SWD transfer timeout")
        val ack = resp[4].toInt() and 0xff
        if (ack != 1) throw IOException("SWD target returned ACK $ack (1=OK, 2=WAIT, 4=FAULT)")
        return ByteBuffer.wrap(resp, 0, 4).order(ByteOrder.LITTLE_ENDIAN).int
    }

    /** Four-byte raw SPI transfer for AVR ISP. Pins are GP2=/RESET, GP3=SCK, GP4=MISO, GP5=MOSI. */
    fun avrIspTransfer(driver: UsbSerialDriver, bytes: ByteArray): ByteArray {
        require(bytes.size == 4) { "AVR ISP transfer requires exactly four bytes" }
        val packet = ByteArray(5); packet[0] = CMD_AVR_ISP_XFER; System.arraycopy(bytes, 0, packet, 1, 4)
        if (driver.write(packet) != packet.size) throw IOException("Failed to write AVR ISP request")
        return driver.synchronizedRead(4, 3000)
    }
}

typealias CaptureService = RP2040Controller
