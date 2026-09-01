/*
 * DroidVibe Logic Analyzer Helper Firmware
 * Target: Raspberry Pi Pico (RP2040)
 *
 * Samples 8 GPIO channels (GP2-GP9) at a configurable rate and streams
 * the data back to the Android app over USB CDC serial at 115200 baud.
 *
 * Protocol (must match RP2040Controller.kt):
 *   0x02 + 3-byte LE rate + 1-byte channels  -> enter LA mode, ACK
 *   0x04                                     -> start capture: 4-byte LE count + data
 *   0x05                                     -> stop capture
 *   0x03                                     -> exit LA mode, ACK
 *   0x00                                     -> reboot to BOOTSEL
 */

#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"
#include "hardware/structs/sio.h"
#include "tusb.h"

/* ---- Command bytes (must match Android RP2040Controller.kt) ---- */
#define CMD_ENTER_BOOTLOADER   0x00
#define CMD_ENTER_LA_MODE      0x02
#define CMD_EXIT_LA_MODE       0x03
#define CMD_START_CAPTURE      0x04
#define CMD_STOP_CAPTURE       0x05
#define ACK                    0x06

/* ---- Configuration ---- */
#define LA_BASE_PIN            2   /* GP2-GP9 = channels 0-7 */
#define NUM_CHANNELS           8
#define MAX_SAMPLES            32768  /* 32 KB sample buffer */

static uint8_t  sample_buffer[MAX_SAMPLES];
static volatile bool stop_capture = false;
static uint32_t configured_rate     = 100000;
static uint8_t  configured_channels  = 0xFF;

/* ---- GPIO setup ---- */
static void init_gpio_inputs(void) {
    for (int i = 0; i < NUM_CHANNELS; i++) {
        gpio_init(LA_BASE_PIN + i);
        gpio_set_dir(LA_BASE_PIN + i, GPIO_IN);
        gpio_pull_down(LA_BASE_PIN + i);
    }
}

/* Read 8 GPIO channels into a single byte (bits 0-7 = GP2-GP9) */
static inline uint8_t read_sample(void) {
    uint32_t gpio_in = sio_hw->gpio_in;
    return (uint8_t)((gpio_in >> LA_BASE_PIN) & 0xFF);
}

/* ---- CDC helpers ---- */
static void cdc_write_bytes(const uint8_t *data, uint32_t len) {
    uint32_t offset = 0;
    while (offset < len) {
        uint32_t remaining = len - offset;
        uint32_t space = tud_cdc_write_available();
        if (space == 0) {
            tud_cdc_write_flush();
            tud_task();
            space = tud_cdc_write_available();
            if (space == 0) {
                sleep_us(10);
                continue;
            }
        }
        uint32_t to_write = (remaining < space) ? remaining : space;
        uint32_t written = tud_cdc_write(data + offset, to_write);
        offset += written;
    }
    tud_cdc_write_flush();
}

static int cdc_read_bytes(uint8_t *buf, uint32_t len, uint32_t timeout_ms) {
    uint32_t total = 0;
    absolute_time_t deadline = make_timeout_time_ms(timeout_ms);
    while (total < len) {
        if (time_reached(deadline)) break;
        if (tud_cdc_available()) {
            uint32_t count = tud_cdc_read(buf + total, len - total);
            total += count;
        }
        tud_task();
        if (total < len) sleep_us(100);
    }
    return (int)total;
}

/* ---- Capture routine ---- */
static void do_capture(void) {
    stop_capture = false;
    uint32_t interval_us = (configured_rate > 0)
        ? (1000000 / configured_rate) : 1;
    if (interval_us == 0) interval_us = 1;

    uint32_t count = 0;
    for (count = 0; count < MAX_SAMPLES && !stop_capture; count++) {
        uint32_t start_time = time_us_32();
        sample_buffer[count] = read_sample();

        /* Wait for next sample interval, checking for STOP command */
        while (time_us_32() - start_time < interval_us) {
            if (tud_cdc_available()) {
                uint8_t cmd;
                if (tud_cdc_read(&cmd, 1) > 0 && cmd == CMD_STOP_CAPTURE) {
                    stop_capture = true;
                    break;
                }
            }
            tight_loop_contents();
        }
    }

    /* Send 4-byte LE count + sample data */
    uint8_t header[4];
    header[0] = (uint8_t)(count & 0xFF);
    header[1] = (uint8_t)((count >> 8) & 0xFF);
    header[2] = (uint8_t)((count >> 16) & 0xFF);
    header[3] = (uint8_t)((count >> 24) & 0xFF);
    cdc_write_bytes(header, 4);
    if (count > 0) {
        cdc_write_bytes(sample_buffer, count);
    }
}

static void enter_bootloader(void) {
    reset_usb_boot(0, 0);
}

/* ---- Main loop ---- */
int main(void) {
    stdio_init_all();
    init_gpio_inputs();

    uint8_t cmd;

    while (true) {
        tud_task();

        if (!tud_cdc_available()) {
            sleep_ms(1);
            continue;
        }

        if (tud_cdc_read(&cmd, 1) > 0) {
            switch (cmd) {
            case CMD_ENTER_LA_MODE: {
                /* Read 4 bytes: 3-byte LE sample rate + 1-byte channels */
                uint8_t config[4];
                if (cdc_read_bytes(config, 4, 1000) == 4) {
                    configured_rate = (uint32_t)config[0]
                        | ((uint32_t)config[1] << 8)
                        | ((uint32_t)config[2] << 16);
                    configured_channels = config[3];
                }
                uint8_t ack = ACK;
                cdc_write_bytes(&ack, 1);
                break;
            }
            case CMD_EXIT_LA_MODE: {
                uint8_t ack = ACK;
                cdc_write_bytes(&ack, 1);
                break;
            }
            case CMD_START_CAPTURE:
                do_capture();
                break;
            case CMD_STOP_CAPTURE:
                stop_capture = true;
                break;
            case CMD_ENTER_BOOTLOADER:
                enter_bootloader();
                break;
            default:
                break;
            }
        }
    }

    return 0;
}
