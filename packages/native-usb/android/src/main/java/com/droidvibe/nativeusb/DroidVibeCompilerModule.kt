package com.droidvibe.nativeusb

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class LocalCompileInput : Record {
    @Field val name: String = "Sketch"
    @Field val fqbn: String = "arduino:avr:uno"
    @Field val code: String = ""
}

class DroidVibeCompilerModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("DroidVibeCompiler")

        AsyncFunction("compileLocal") { input: LocalCompileInput, promise: Promise ->
            try {
                val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
                val result = LocalToolchain.compile(context, input.name, input.fqbn, input.code)
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
