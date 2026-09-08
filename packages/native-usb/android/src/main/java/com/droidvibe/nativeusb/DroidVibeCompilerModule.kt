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

class BoardManagerInput : Record {
    @Field val value: String = ""
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
                promise.resolve(mapOf(
                    "ok" to result.ok,
                    "diagnostics" to result.diagnostics,
                    "firmware" to result.firmware,
                    "firmwarePath" to result.firmwarePath,
                    "fqbn" to result.fqbn,
                    "durationMs" to result.durationMs,
                    "stdout" to result.stdout,
                ))
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

        AsyncFunction("boardManagerAddUrl") { input: BoardManagerInput, promise: Promise ->
            runBoardCommand(input.value, listOf("config", "add", "board_manager.additional_urls", input.value), promise)
        }

        AsyncFunction("boardManagerUpdateIndexes") { promise: Promise ->
            runBoardCommand(null, listOf("core", "update-index"), promise)
        }

        AsyncFunction("boardManagerInstallCore") { input: BoardManagerInput, promise: Promise ->
            runBoardCommand(input.value, listOf("core", "install", input.value), promise)
        }

        AsyncFunction("boardManagerListCores") { promise: Promise ->
            runBoardCommand(null, listOf("core", "list"), promise)
        }

        AsyncFunction("boardManagerListBoards") { promise: Promise ->
            runBoardCommand(null, listOf("board", "listall"), promise)
        }
    }

    private fun runBoardCommand(marker: String?, args: List<String>, promise: Promise) {
        try {
            if (marker != null && marker.isBlank()) throw IllegalArgumentException("Board Manager value is empty")
            val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
            val result = LocalToolchain.runCli(context, args, 15L)
            promise.resolve(mapOf("ok" to result.first, "stdout" to result.second, "command" to args))
        } catch (e: Exception) {
            promise.reject("BOARD_MANAGER_FAILED", e.message ?: "Board Manager operation failed", e)
        }
    }
}
