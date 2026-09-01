package com.droidvibe.nativeusb

import android.util.Log

/**
 * Synchronous serial read helper for the upload protocols.
 * Delegates to UsbSerialDriver.synchronizedRead() which drains the
 * internal read queue fed by the USB read thread.
 */
object SyncSerial {
    private const val TAG = "SyncSerial"

    fun read(driver: UsbSerialDriver, minLen: Int, timeoutMs: Int): ByteArray {
        val result = driver.synchronizedRead(minLen, timeoutMs)
        if (result.isEmpty()) {
            Log.w(TAG, "SyncSerial.read timed out (" + minLen + " bytes, " + timeoutMs + "ms)")
        }
        return result
    }
}