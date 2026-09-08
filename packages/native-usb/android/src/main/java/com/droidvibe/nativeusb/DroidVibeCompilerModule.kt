package com.droidvibe.nativeusb

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray

class LocalCompileInput : Record {
    @Field val name: String = "Sketch"
    @Field val fqbn: String = "arduino:avr:uno"
    @Field val filesJson: String = "[]"
}

class DroidVibeCompilerModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("DroidVibeCompiler")

        AsyncFunction("compileLocal") { input: LocalCompileInput, promise: Promise ->
            try {
                val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
                val json = JSONArray(input.filesJson)
                val files = ArrayList<Pair<String, String>>(json.length())
                for (i in 0 until json.length()) {
                    val item = json.getJSONObject(i)
                    files += item.getString("path") to item.getString("content")
                }
                val result = LocalToolchain.compile(context, input.name, input.fqbn, files)
                promise.resolve(
                    mapOf(
                        "ok" to result.ok,
                        "diagnostics" to result.diagnostics,
                        "firmware" to result.firmware,
                        "firmwarePath" to result.firmwarePath,
                        "fqbn" to result.fqbn,
                        "durationMs" to result.durationMs,
                        "stdout" to result.stdout,
                    )
                )
            } catch (e: Exception) {
                promise.reject("LOCAL_COMPILE_FAILED", e.message ?: "Local compilation failed", e)
            }
        }

        AsyncFunction("isLocalToolchainInstalled") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
                val p = LocalToolchain.ensureInstalled(context)
                promise.resolve(p.rootfs.isDirectory && p.proot.isFile)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }
}
