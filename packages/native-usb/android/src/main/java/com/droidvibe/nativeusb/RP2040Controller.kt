package com.droidvibe.nativeusb

import android.hardware.usb.UsbDevice

/** RP2040 application/BOOTSEL state helpers. */
object RP2040Controller {
    private const val RP2040_VID = 0x2E8A
    private const val BOOTSEL_PID = 0x0003

    data class CaptureResult(
        val actualSamples: Int,
        val durationUs: Long,
        val data: ByteArray,
        val sampleRate: Int,
        val channels: Int,
    )

    fun isRP2040(device: UsbDevice): Boolean = device.vendorId == RP2040_VID

    fun isBootSel(device: UsbDevice): Boolean =
        device.vendorId == RP2040_VID && device.productId == BOOTSEL_PID

    fun isApplicationMode(device: UsbDevice): Boolean =
        device.vendorId == RP2040_VID && device.productId != BOOTSEL_PID

    /**
     * Trigger the standard USB CDC 1200-baud reset used by RP2040 USB stdio.
     * UsbSerialDriver.touch1200() claims the CDC interface, sends SET_LINE_CODING
     * at 1200 baud and DTR low, then releases the interface so the device can
     * detach and re-enumerate as the BOOTSEL device (VID 2E8A, PID 0003).
     */
    fun enterBootselViaSerial(driver: UsbSerialDriver): Boolean = driver.touch1200()

    /** Advanced helper-firmware operations are deliberately explicit until a
     * compatible DroidVibe helper protocol is installed on the RP2040. */
    fun capture(driver: UsbSerialDriver, sampleRate: Int, numSamples: Int, channels: Int): CaptureResult {
        throw UnsupportedOperationException("RP2040 capture requires DroidVibe logic-analyzer helper firmware")
    }

    fun swdTransfer(driver: UsbSerialDriver, isRead: Boolean, apDp: Int, addr: Int, data: Int): Int {
        throw UnsupportedOperationException("SWD requires DroidVibe SWD helper firmware")
    }

    fun jtagTransfer(driver: UsbSerialDriver, tms: ByteArray, tdi: ByteArray, bitCount: Int): ByteArray {
        throw UnsupportedOperationException("JTAG requires DroidVibe JTAG helper firmware")
    }
}
