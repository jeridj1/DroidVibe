# Future Workbench Ideas

> Back-burner design notes. These ideas are intentionally not part of the current implementation work. Do not let them become detours from getting the existing hardware, USB, programmer, and communication pipeline working reliably first.

## Core direction

DroidVibe should remain an Android-native Arduino development workstation, while leaving room to grow into a broader embedded-electronics workbench. The existing editor/build/flash/serial/logic-analyzer workflow remains the foundation.

The order of priority is:

**hardware and USB communication first → reliable programmer/probe pipeline → target identification and basic operations → richer interfaces and workbench features**

Do not redesign the repository around these ideas prematurely.

## Capability-driven Workbench

Treat the Programmer/Workbench area as a collection of instruments rather than one giant IDE that tries to understand every chip directly.

Conceptual pipeline:

`DroidVibe → Workbench → Capability → Interface → Programmer/Probe → Transport → Target`

A physical device such as an RP2040 or ESP may have several possible personalities. The application should expose the appropriate tools based on the capabilities actually available from the connected hardware/firmware.

## Explore mode without hardware

Every supported instrument should be usable in an **Explore** or **Browse** state without a target chip being connected.

For example, a user should be able to open an STM32 SWD programmer screen simply to learn the interface, inspect memory/protection/option-byte controls, and understand what the tool does. Hardware-dependent operations can be disabled or simulated until a real connection exists.

When real hardware becomes available, the same interface should transition from **Explore** to **Connected/Live** rather than requiring a completely different screen.

This is intentional. The interface itself should be useful as a learning and familiarization tool.

## Capability Explorer

Provide a place where a connected programmer/probe can show what it is capable of doing, for example:

- SWD / CMSIS-DAP
- JTAG where supported
- UART bootloader programming
- AVR ISP / UPDI where supported
- ESP programming protocols
- RP2040 PICOBOOT / UF2
- Serial bridge
- Logic analyzer
- GPIO tools
- I2C / SPI tools
- Other capabilities as they are actually implemented

Do not claim a capability merely because the underlying MCU could theoretically perform it. Capability should reflect the firmware/probe implementation that DroidVibe can actually communicate with.

## STM32-style Programmer instrument

A future STM32 programmer interface should be substantially richer than a simple flash button. Depending on the target and probe capabilities, it may expose:

- device identification
- connection/interface selection
- probe information
- memory map and memory viewer
- read/write/program/verify
- chip and sector erase
- reset and run/halt controls
- option bytes
- readout protection/security state
- firmware/device information
- operation logs
- target-specific controls as appropriate

The same UI should ideally work with a real ST-Link and with a supported RP2040/ESP probe personality when those backends exist.

## Device Lab dashboard

When a real target is connected, consider a dashboard showing the detected device, interface, probe, device ID, memory information, protection state, firmware information, recent operation, and available capabilities. This should be a gateway into the individual instruments, not a replacement for them.

## Virtual Hardware

Consider simulated device profiles for Explore mode. A user could select an example target such as an STM32F103 and inspect the programmer interface using simulated device information without owning or connecting that chip.

The same UI can then become live when an actual target is detected.

## Operation Recorder

Consider recording programming/debugging operations as readable sequences, for example:

`connect SWD → identify device → halt → erase → program → verify → reset`

A later version could replay or export these sequences for repeatable workflows and automation.

## Raw diagnostics

Keep a low-level log/diagnostic view underneath the friendly UI. When something fails, users should be able to inspect USB/protocol activity, target responses, errors, timing, and operation history rather than being limited to a simplified error message.

## Appearance direction

Favor a modern Android instrument-panel feel rather than a wall of tiny professional-tool buttons. Dark/light themes can remain available, with clear status indicators, large identifiable tools, compact technical status information, expandable advanced sections, and good tablet/DeX behavior.

The interface should feel approachable when learning but expose deeper technical information when wanted.

## Architectural rule

These ideas must remain additive and capability-driven. Do not turn DroidVibe into a giant collection of unrelated chip-specific screens or replace the existing project architecture merely to accommodate future possibilities.

The immediate goal remains making the existing pipeline work reliably. Rich workbench interfaces come afterward.
