/*
 * DroidVibe AVR ISP Programmer Helper Firmware
 * Target: Raspberry Pi Pico (RP2040)
 *
 * Uses hardware SPI on GP3-GP5 to program AVR microcontrollers via ISP
 * (In-System Programming). Implements a simplified STK500v1-compatible
 * protocol over CDC serial so avrdude-style tools can talk through it.
 *
 * Pin assignments (must match firmware/README.md):
 *   GP2: RESET (to target RESET)
 *   GP3: SCK   (SPI clock)
 *   GP4: MISO  (SPI data from target)
 *   GP5: MOSI  (SPI data to target)
 *   GND: Ground
 *   3V3: Target VCC (optional, many AVR boards need 5V externally)
 */

#include <stdio.h>
#include <string.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"
#include "hardware/spi.h"
#include "tusb.h"

/* ---- Command bytes (CDC protocol for DroidVibe app) ---- */
#define CMD_ENTER_BOOTLOADER   0x00

/* ---- STK500v1 protocol constants ---- */
#define STK_GET_SYNC           0x30
#define STK_GET_SIGN_ON        0x31
#define STK_SET_PARAMETER      0x40
#define STK_GET_PARAMETER      0x41
#define STK_LOAD_ADDRESS       0x55
#define STK_PROG_FLASH         0x60
#define STK_READ_FLASH         0x70
#define STK_PROG_PAGE          0x64
#define STK_READ_PAGE          0x74
#define STK_LEAVE_PROGMODE     0x51
#define STK_IN_PROGMODE        0x56
#define STK_READ_SIGN          0x75
#define Cmnd_STK_OK            0x10
#define Cmnd_STK_FAILED        0x11
#define Cmnd_STK_INSYNC        0x14
#define Sync_CRC_EOP           0x20

/* ---- Pin assignments ---- */
#define RESET_PIN  2
#define SCK_PIN    3
#define MISO_PIN   4
#define MOSI_PIN   5
#define SPI_INSTANCE spi0

#define PAGE_BUFFER_SIZE  256

static uint8_t page_buffer[PAGE_BUFFER_SIZE];
static uint32_t flash_address = 0;

static void init_isp_pins(void) {
    spi_init(SPI_INSTANCE, 250000);
    spi_set_format(SPI_INSTANCE, 8, SPI_CPOL_0, SPI_CPHA_0, SPI_MSB_FIRST);

    gpio_set_function(SCK_PIN,  GPIO_FUNC_SPI);
    gpio_set_function(MISO_PIN, GPIO_FUNC_SPI);
    gpio_set_function(MOSI_PIN, GPIO_FUNC_SPI);

    gpio_init(RESET_PIN);
    gpio_set_dir(RESET_PIN, GPIO_OUT);
    gpio_put(RESET_PIN, 1);
}

static void enter_progmode(void) {
    gpio_put(RESET_PIN, 0);
    sleep_ms(20);

    spi_set_baudrate(SPI_INSTANCE, 250000);
    uint8_t tx[4] = {0xAC, 0x53, 0x00, 0x00};
    spi_write_blocking(SPI_INSTANCE, tx, 4);
    sleep_ms(10);
}

static void leave_progmode(void) {
    gpio_put(RESET_PIN, 1);
    sleep_ms(10);
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

/* ---- ISP SPI operations ---- */
static void read_signature(uint8_t *sig) {
    uint8_t tx[4], rx[4];
    for (int i = 0; i < 3; i++) {
        tx[0] = 0x30;
        tx[1] = 0x00;
        tx[2] = (uint8_t)i;
        tx[3] = 0x00;
        spi_write_blocking(SPI_INSTANCE, tx, 4);
        spi_read_blocking(SPI_INSTANCE, 0, rx, 4);
        sig[i] = rx[3];
    }
}

static void load_address(uint8_t addr_hi, uint8_t addr_lo) {
    flash_address = ((uint32_t)addr_hi << 8) | addr_lo;
}

static void program_page(uint16_t page_size, const uint8_t *data) {
    uint8_t tx[4];
    uint16_t word_addr = (uint16_t)(flash_address << 1);
    for (uint16_t i = 0; i < page_size; i += 2) {
        tx[0] = 0x40; tx[1] = 0x00;
        tx[2] = (uint8_t)((word_addr + i) & 0xFF);
        tx[3] = data[i];
        spi_write_blocking(SPI_INSTANCE, tx, 4);

        tx[0] = 0x48; tx[1] = 0x00;
        tx[2] = (uint8_t)((word_addr + i) & 0xFF);
        tx[3] = data[i + 1];
        spi_write_blocking(SPI_INSTANCE, tx, 4);
    }

    tx[0] = 0x4C;
    tx[1] = (uint8_t)((flash_address >> 8) & 0xFF);
    tx[2] = (uint8_t)(flash_address & 0xFF);
    tx[3] = 0x00;
    spi_write_blocking(SPI_INSTANCE, tx, 4);
    sleep_ms(5);
}

static void read_page(uint16_t page_size, uint8_t *data) {
    uint8_t tx[4], rx[4];
    uint16_t word_addr = (uint16_t)(flash_address << 1);
    for (uint16_t i = 0; i < page_size; i += 2) {
        tx[0] = 0x20; tx[1] = 0x00;
        tx[2] = (uint8_t)((word_addr + i) & 0xFF);
        tx[3] = 0x00;
        spi_write_blocking(SPI_INSTANCE, tx, 4);
        spi_read_blocking(SPI_INSTANCE, 0, rx, 4);
        data[i] = rx[3];

        tx[0] = 0x28; tx[1] = 0x00;
        tx[2] = (uint8_t)((word_addr + i) & 0xFF);
        tx[3] = 0x00;
        spi_write_blocking(SPI_INSTANCE, tx, 4);
        spi_read_blocking(SPI_INSTANCE, 0, rx, 4);
        data[i + 1] = rx[3];
    }
}

/* ---- STK500v1 protocol handler ---- */
static void stk_resp(uint8_t resp) {
    cdc_write_bytes(&resp, 1);
}

static void stk_resp_ok(void) {
    uint8_t resp[2] = { Cmnd_STK_INSYNC, Cmnd_STK_OK };
    cdc_write_bytes(resp, 2);
}

static void enter_bootloader(void) {
    reset_usb_boot(0, 0);
}

static void process_stk500(void) {
    uint8_t cmd;

    while (true) {
        tud_task();

        if (!tud_cdc_available()) {
            sleep_ms(1);
            continue;
        }

        if (tud_cdc_read(&cmd, 1) > 0) {
            switch (cmd) {
            case STK_GET_SYNC:
            case STK_IN_PROGMODE:
                stk_resp_ok();
                break;

            case STK_LEAVE_PROGMODE:
                leave_progmode();
                stk_resp_ok();
                return;

            case STK_GET_SIGN_ON:
            case STK_READ_SIGN: {
                stk_resp(Cmnd_STK_INSYNC);
                uint8_t sig[3];
                read_signature(sig);
                cdc_write_bytes(sig, 3);
                stk_resp(Cmnd_STK_OK);
                break;
            }

            case STK_LOAD_ADDRESS: {
                uint8_t addr[2];
                if (cdc_read_bytes(addr, 2, 1000) == 2) {
                    load_address(addr[0], addr[1]);
                    stk_resp_ok();
                }
                break;
            }

            case STK_PROG_PAGE: {
                uint8_t hdr[3];
                if (cdc_read_bytes(hdr, 3, 1000) < 3) break;
                uint16_t page_size = (uint16_t)(hdr[0] | (hdr[1] << 8));
                uint8_t memtype = hdr[2];

                if (page_size > PAGE_BUFFER_SIZE) page_size = PAGE_BUFFER_SIZE;
                if (cdc_read_bytes(page_buffer, page_size, 2000) < page_size) break;

                uint8_t eop;
                cdc_read_bytes(&eop, 1, 500);

                if (memtype == 'F') {
                    program_page(page_size, page_buffer);
                }
                stk_resp_ok();
                break;
            }

            case STK_READ_PAGE: {
                uint8_t hdr[3];
                if (cdc_read_bytes(hdr, 3, 1000) < 3) break;
                uint16_t page_size = (uint16_t)(hdr[0] | (hdr[1] << 8));
                uint8_t memtype = hdr[2];

                if (page_size > PAGE_BUFFER_SIZE) page_size = PAGE_BUFFER_SIZE;

                uint8_t eop;
                cdc_read_bytes(&eop, 1, 500);

                stk_resp(Cmnd_STK_INSYNC);
                if (memtype == 'F') {
                    read_page(page_size, page_buffer);
                    cdc_write_bytes(page_buffer, page_size);
                }
                stk_resp(Cmnd_STK_OK);
                break;
            }

            case STK_SET_PARAMETER:
            case STK_GET_PARAMETER: {
                uint8_t param;
                cdc_read_bytes(&param, 1, 500);
                uint8_t eop;
                cdc_read_bytes(&eop, 1, 500);
                stk_resp(Cmnd_STK_INSYNC);
                if (cmd == STK_GET_PARAMETER) {
                    stk_resp(0x03);
                }
                stk_resp(Cmnd_STK_OK);
                break;
            }

            case Sync_CRC_EOP:
                break;

            default:
                stk_resp(Cmnd_STK_INSYNC);
                stk_resp(Cmnd_STK_FAILED);
                break;
            }
        }
    }
}

/* ---- Main loop ---- */
int main(void) {
    stdio_init_all();
    init_isp_pins();

    uint8_t cmd;

    while (true) {
        tud_task();

        if (!tud_cdc_available()) {
            sleep_ms(1);
            continue;
        }

        if (tud_cdc_read(&cmd, 1) > 0) {
            switch (cmd) {
            case CMD_ENTER_BOOTLOADER:
                enter_bootloader();
                break;

            case STK_GET_SYNC:
            case STK_GET_SIGN_ON:
            case STK_IN_PROGMODE:
                enter_progmode();
                process_stk500();
                break;

            default:
                break;
            }
        }
    }

    return 0;
}
