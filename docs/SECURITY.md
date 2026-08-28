# Security boundary

- The cloud backend runs `arduino-cli` in a constrained, ephemeral workspace per
  compile request. Sketch source is treated as untrusted input; compilation is
  sandboxed and never executed.
- USB access on device requires the Android USB permission flow. The app never
  auto-grants USB access; the user explicitly approves each device.
- Firmware is never reported as successfully written unless read-back
  verification (where the protocol supports it) confirms it, or the device
  acknowledges completion per its documented protocol.
- Native library execution respects Android/SELinux: executables ship in
  `jniLibs` and run from `nativeLibraryDir` (the only path Android permits
  execution from), not from `filesDir`.
- No secrets are shipped in the client. Backend secrets live in server-side
  environment variables.
