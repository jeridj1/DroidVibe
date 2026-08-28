package com.droidvibe.nativeusb

import android.hardware.usb.UsbManager

/**
 * Logic-analyzer capture over a configured RP2040 helper image.
 *
 * The actual capture requires an RP2040 flashed with the DroidVibe logic-
 * analyzer helper firmware, which streams packed samples over a vendor
 * endpoint. Until a verified helper firmware is bundled, this returns an
 * explicit "unknown/not supported" state rather than fabricating samples.
 */
data class CaptureResult(val actualSamples: Int, val durationUs: Long, val data: ByteArray) {
    override fun equals(other: Any?) = this === other
    override fun hashCode() = System.identityHashCode(this)
}

object CaptureService {
    fun capture(
        usbManager: UsbManager,
        sampleRate: Int,
        numSamples: Int,
        channels: Int,
    ): CaptureResult {
        // No verified helper firmware bundled yet. Per the no-fake-success
        // directive, return zero samples with explicit unknown status. The
        // caller surfaces this as "capture unavailable" rather than fake data.
        throw UnsupportedOperationException(
            "Logic-analyzer capture requires a verified RP2040 helper firmware image " +
                "(not bundled). See docs/SECURITY.md."
        )
    }
}
