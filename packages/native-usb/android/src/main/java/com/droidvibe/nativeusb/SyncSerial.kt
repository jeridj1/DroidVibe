package com.droidvibe.nativeusb

import android.util.Log
import java.util.concurrent.LinkedBlockingQueue

/**
 * Synchronous serial read helper for the upload protocols.
 *
 * In the integrated build, the upload driver's read thread pushes received
 * bytes into a per-driver queue; upload protocols drain it deterministically
 * with a timeout. Until the read thread is wired into the upload path, this
 * returns an empty buffer on timeout rather than fabricating bytes (no-fake-
 * success directive).
 */
object SyncSerial {
    private const val TAG = "SyncSerial"

    /** Optional queue a wired read thread can push bytes into. */
    @Volatile
    var queue: LinkedBlockingQueue<Byte>? = null

    fun read(driver: UsbSerialDriver, minLen: Int, timeoutMs: Int): ByteArray {
        val q = queue
        val out = ArrayList<Byte>()
        if (q != null) {
            val deadline = System.currentTimeMillis() + timeoutMs
            while (System.currentTimeMillis() < deadline && out.size < minLen) {
                val b = q.poll(2, java.util.concurrent.TimeUnit.MILLISECONDS)
                if (b != null) out.add(b)
            }
        }
        if (out.isEmpty()) Log.w(TAG, "SyncSerial.read timed out (" + minLen + " bytes, " + timeoutMs + "ms)")
        return out.toByteArray()
    }
}
