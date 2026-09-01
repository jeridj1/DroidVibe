# DroidVibe RP2040 Helper Firmware

Firmware for the Raspberry Pi Pico (RP2040) that turns it into a universal
hardware tool for DroidVibe. Each mode is a separate firmware project that
gets flashed via PICOBOOT and communicates with the Android app over USB CDC.

## Modes

| Mode | Firmware | Description |
|------|----------|-------------|
| Logic Analyzer | logic_analyzer | 8-channel GPIO sampling at up to ~1 MHz |
| SWD Programmer | swd | Serial Wire Debug for ARM Cortex-M targets |
| JTAG Programmer | jtag | JTAG TMS/TDI/TDO shifting for various targets |
| AVR ISP | avr_isp | SPI-based ISP for AVR chips (STK500v1 compatible) |

## Building

### Prerequisites

1. Install the Raspberry Pi Pico SDK:
   ```bash
   git clone https://github.com/raspberrypi/pico-sdk.git --recurse-submodules
   export PICO_SDK_PATH=/path/to/pico-sdk
   ```

2. Install the ARM GCC toolchain:
   ```bash
   # Ubuntu/Debian:
   sudo apt install cmake gcc-arm-none-eabi libnewlib-arm-none-eabi build-essential
   
   # macOS (via Homebrew):
   brew install cmake arm-none-eabi-gcc
   
   # Windows: See https://datasheets.raspberrypi.com/pico/getting-started-with-pico.pdf
   ```

### Compile each firmware

```bash
# Logic Analyzer
cd firmware/logic_analyzer
mkdir build && cd build
cmake ..
make -j4
# Output: droidvibe_la.uf2

# SWD Programmer
cd firmware/swd
mkdir build && cd build
cmake ..
make -j4
# Output: droidvibe_swd.uf2

# JTAG Programmer
cd firmware/jtag
mkdir build && cd build
cmake ..
make -j4
# Output: droidvibe_jtag.uf2

# AVR ISP
cd firmware/avr_isp
mkdir build && cd build
cmake ..
make -j4
# Output: droidvibe_avr_isp.uf2
```

### Bundling into the app

After building, copy the .uf2 files into the app assets directory:
```bash
cp firmware/logic_analyzer/build/droidvibe_la.uf2 apps/mobile/src/main/assets/firmware/logic_analyzer_helper.uf2
cp firmware/swd/build/droidvibe_swd.uf2 apps/mobile/src/main/assets/firmware/swd_helper.uf2
cp firmware/jtag/build/droidvibe_jtag.uf2 apps/mobile/src/main/assets/firmware/jtag_helper.uf2
cp firmware/avr_isp/build/droidvibe_avr_isp.uf2 apps/mobile/src/main/assets/firmware/avr_isp_helper.uf2
```

Then rebuild the APK. The "Prepare Pico" button in the Bench tab will flash
the appropriate firmware onto the Pico via PICOBOOT.

### Manual flashing (for testing)

Hold BOOTSEL while plugging in the Pico, then drag the .uf2 file onto the
mounted mass storage device. The Pico will reboot running the new firmware.

## Communication Protocol

All firmware communicates with the Android app over USB CDC serial at 115200 baud.

### Command format

| Command | Value | Payload | Response |
|---------|-------|---------|----------|
| Enter bootloader | 0x00 | none | reboots to BOOTSEL |
| Enter LA mode | 0x02 | 3-byte sample rate + 1-byte channels | ack |
| Exit LA mode | 0x03 | none | ack |
| Start capture | 0x04 | none | 4-byte sample count + sample data |
| Stop capture | 0x05 | none | ack |
| SWD write | 0x10 | 1-byte AP/DP + 4-byte addr + 4-byte data | 4-byte ack/status |
| SWD read | 0x11 | 1-byte AP/DP + 4-byte addr + 4-byte (ignored) data | 4-byte data |
| JTAG write | 0x20 | (reserved) | ack |
| JTAG read | 0x21 | (reserved) | ack |
| JTAG TMS seq | 0x22 | 2-byte bit count + TMS bytes | ack |
| JTAG TDI/TDO seq | 0x23 | 2-byte bit count + TMS + TDI bytes | TDO bytes |

## Pin Assignments

### Logic Analyzer
- GP2-GP9: Channels 0-7
- GND: Ground

### SWD
- GP2: SWDIO
- GP3: SWCLK
- GND: Ground
- 3V3: Target VCC (optional)

### JTAG
- GP2: TCK
- GP3: TMS
- GP4: TDI
- GP5: TDO
- GND: Ground
- 3V3: Target VCC (optional)

### AVR ISP
- GP2: RESET
- GP3: SCK
- GP4: MISO
- GP5: MOSI
- GND: Ground
