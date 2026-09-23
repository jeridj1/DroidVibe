#include "pico/stdlib.h"
#include "pico/bootrom.h"
#include "hardware/pio.h"
#include "hardware/dma.h"
#include "hardware/clocks.h"
#include <stdint.h>
#include <stdbool.h>

#define CAPTURE_BASE_PIN 2
#define CAPTURE_CHANNELS 8
#define MAX_SAMPLES 8192
#define MAX_WORDS ((MAX_SAMPLES + 3) / 4)

extern uint odt_capture_program_add(PIO pio);
extern uint odt_capture_program_init(PIO pio, uint sm, uint offset, uint pin, float clkdiv);

static uint32_t capture_words[MAX_WORDS];
static uint configured_rate = 1000000;
static uint configured_channels = CAPTURE_CHANNELS;
static int dma_chan = -1;
static PIO capture_pio = pio0;
static uint capture_sm = 0;
static int configured_offset = -1;

static void send_u32_le(uint32_t value) {
    putchar_raw((int)(value & 0xff));
    putchar_raw((int)((value >> 8) & 0xff));
    putchar_raw((int)((value >> 16) & 0xff));
    putchar_raw((int)((value >> 24) & 0xff));
}

static void capture_samples(uint samples) {
    if (samples == 0 || samples > MAX_SAMPLES) samples = MAX_SAMPLES;
    uint channels = configured_channels;
    if (channels == 0 || channels > CAPTURE_CHANNELS) channels = CAPTURE_CHANNELS;
    if (configured_offset < 0) configured_offset = (int)odt_capture_program_add(capture_pio);

    float div = (float)clock_get_hz(clk_sys) / (2.0f * (float)configured_rate);
    if (div < 1.0f) div = 1.0f;
    odt_capture_program_init(capture_pio, capture_sm, (uint)configured_offset, CAPTURE_BASE_PIN, div);

    if (dma_chan < 0) dma_chan = dma_claim_unused_channel(true);
    uint words = (samples + 3u) / 4u;
    dma_channel_config dc = dma_channel_get_default_config(dma_chan);
    channel_config_set_transfer_data_size(&dc, DMA_SIZE_32);
    channel_config_set_read_increment(&dc, false);
    channel_config_set_write_increment(&dc, true);
    channel_config_set_dreq(&dc, pio_get_dreq(capture_pio, capture_sm, false));
    dma_channel_configure(dma_chan, &dc, capture_words, &capture_pio->rxf[capture_sm], words, false);
    dma_channel_start(dma_chan);
    pio_sm_set_enabled(capture_pio, capture_sm, true);
    dma_channel_wait_for_finish_blocking(dma_chan);
    pio_sm_set_enabled(capture_pio, capture_sm, false);
    pio_sm_clear_fifos(capture_pio, capture_sm);

    send_u32_le(samples);
    uint emitted = 0;
    for (uint w = 0; w < words && emitted < samples; ++w) {
        uint32_t packed = capture_words[w];
        for (uint i = 0; i < 4 && emitted < samples; ++i) {
            uint8_t sample = (uint8_t)((packed >> (i * 8)) & 0xffu);
            if (channels < 8) sample &= (uint8_t)((1u << channels) - 1u);
            putchar_raw(sample);
            ++emitted;
        }
    }
}

/* ---------------- SWD transport: GP2=SWDIO, GP3=SWCLK ---------------- */
#define SWDIO_PIN 2
#define SWCLK_PIN 3

static void swd_clk(void) {
    gpio_put(SWCLK_PIN, 1); __asm volatile("nop\nnop\nnop\nnop\n");
    gpio_put(SWCLK_PIN, 0); __asm volatile("nop\nnop\nnop\nnop\n");
}

static void swd_io_out(void) { gpio_set_dir(SWDIO_PIN, GPIO_OUT); }
static void swd_io_in(void) { gpio_set_dir(SWDIO_PIN, GPIO_IN); }

static void swd_write_bits(uint32_t value, uint bits) {
    swd_io_out();
    for (uint i = 0; i < bits; ++i) { gpio_put(SWDIO_PIN, (value >> i) & 1u); swd_clk(); }
}

static uint32_t swd_read_bits(uint bits) {
    uint32_t value = 0;
    swd_io_in();
    for (uint i = 0; i < bits; ++i) { if (gpio_get(SWDIO_PIN)) value |= (1u << i); swd_clk(); }
    return value;
}

static void swd_reset(void) {
    gpio_init(SWDIO_PIN); gpio_init(SWCLK_PIN);
    gpio_set_function(SWDIO_PIN, GPIO_FUNC_SIO); gpio_set_function(SWCLK_PIN, GPIO_FUNC_SIO);
    gpio_put(SWCLK_PIN, 0); gpio_put(SWDIO_PIN, 1); swd_io_out();
    for (int i = 0; i < 60; ++i) swd_clk();
    /* JTAG-to-SWD sequence, LSB first: 0xE79E */
    swd_write_bits(0xE79E, 16);
    for (int i = 0; i < 8; ++i) swd_clk();
}

static uint8_t swd_parity4(uint8_t v) {
    return (uint8_t)((((v >> 0) & 1u) ^ ((v >> 1) & 1u) ^ ((v >> 2) & 1u) ^ ((v >> 3) & 1u)) & 1u);
}

static uint8_t swd_transfer(uint8_t apdp, uint8_t addr, bool read, uint32_t write_data, uint32_t *read_data) {
    /* Request: start, APnDP, RnW, A2, A3, parity, stop, park */
    uint8_t a2 = (addr >> 2) & 1u, a3 = (addr >> 3) & 1u;
    uint8_t req = (uint8_t)(1u | ((apdp & 1u) << 1) | ((read ? 1u : 0u) << 2) | (a2 << 3) | (a3 << 4));
    uint8_t parity = (uint8_t)((apdp ^ (read ? 1u : 0u) ^ a2 ^ a3) & 1u);
    req |= (uint8_t)(parity << 5);
    swd_write_bits(req, 8);
    swd_io_in(); swd_clk();
    uint8_t ack = (uint8_t)swd_read_bits(3);
    if (ack != 1) { swd_io_out(); swd_write_bits(1, 1); return ack; }
    if (read) {
        uint32_t data = swd_read_bits(32); uint8_t p = (uint8_t)swd_read_bits(1);
        uint8_t calc = 0; for (uint i = 0; i < 32; ++i) calc ^= (uint8_t)((data >> i) & 1u);
        if (calc != p) { swd_io_out(); swd_write_bits(1, 1); return 4; }
        if (read_data) *read_data = data;
        swd_io_out(); swd_write_bits(1, 1); /* turnaround */
        return ack;
    }
    swd_clk(); swd_write_bits(write_data, 32);
    uint8_t p = 0; for (uint i = 0; i < 32; ++i) p ^= (uint8_t)((write_data >> i) & 1u);
    swd_write_bits(p, 1); return ack;
}

static uint32_t handle_swd(uint8_t cmd) {
    int apdp = getchar_timeout_us(1000000), a0 = getchar_timeout_us(1000000), a1 = getchar_timeout_us(1000000), a2 = getchar_timeout_us(1000000), a3 = getchar_timeout_us(1000000);
    int d0 = getchar_timeout_us(1000000), d1 = getchar_timeout_us(1000000), d2 = getchar_timeout_us(1000000), d3 = getchar_timeout_us(1000000);
    if (apdp < 0 || a0 < 0 || a1 < 0 || a2 < 0 || a3 < 0 || d0 < 0 || d1 < 0 || d2 < 0 || d3 < 0) return 0;
    uint8_t addr = (uint8_t)a0;
    uint32_t data = (uint32_t)d0 | ((uint32_t)d1 << 8) | ((uint32_t)d2 << 16) | ((uint32_t)d3 << 24);
    uint32_t result = 0; swd_reset();
    uint8_t ack = swd_transfer((uint8_t)apdp, addr, cmd == 0x11, data, &result);
    if (cmd == 0x11) { send_u32_le(result); }
    else { send_u32_le(data); }
    putchar_raw(ack);
    return ack;
}

/* ---------------- JTAG transport: GP2=TCK GP3=TMS GP4=TDI GP5=TDO ---------------- */
#define JTAG_TCK 2
#define JTAG_TMS 3
#define JTAG_TDI 4
#define JTAG_TDO 5

static uint8_t jtag_clock(bool tms, bool tdi) {
    gpio_put(JTAG_TMS, tms); gpio_put(JTAG_TDI, tdi); gpio_put(JTAG_TCK, 0); __asm volatile("nop\nnop\n");
    uint8_t tdo = (uint8_t)gpio_get(JTAG_TDO); gpio_put(JTAG_TCK, 1); __asm volatile("nop\nnop\n"); return tdo;
}

static void jtag_init(void) {
    const uint pins[] = {JTAG_TCK, JTAG_TMS, JTAG_TDI, JTAG_TDO};
    for (uint i = 0; i < 4; ++i) { gpio_init(pins[i]); gpio_set_function(pins[i], GPIO_FUNC_SIO); }
    gpio_set_dir(JTAG_TCK, GPIO_OUT); gpio_set_dir(JTAG_TMS, GPIO_OUT); gpio_set_dir(JTAG_TDI, GPIO_OUT); gpio_set_dir(JTAG_TDO, GPIO_IN);
    for (int i = 0; i < 6; ++i) jtag_clock(true, false);
}

static uint8_t handle_jtag_sequence(void) {
    int l0 = getchar_timeout_us(1000000), l1 = getchar_timeout_us(1000000);
    if (l0 < 0 || l1 < 0) return 0;
    uint16_t bits = (uint16_t)l0 | ((uint16_t)l1 << 8);
    uint bytes = (bits + 7u) / 8u;
    if (bytes > 4096) return 0;
    uint8_t tms[4096], tdi[4096], tdo[4096];
    for (uint i = 0; i < bytes; ++i) { int v = getchar_timeout_us(1000000); if (v < 0) return 0; tms[i] = (uint8_t)v; }
    for (uint i = 0; i < bytes; ++i) { int v = getchar_timeout_us(1000000); if (v < 0) return 0; tdi[i] = (uint8_t)v; tdo[i] = 0; }
    jtag_init();
    for (uint bit = 0; bit < bits; ++bit) {
        bool tmsb = (tms[bit >> 3] >> (bit & 7u)) & 1u;
        bool tdib = (tdi[bit >> 3] >> (bit & 7u)) & 1u;
        if (jtag_clock(tmsb, tdib)) tdo[bit >> 3] |= (uint8_t)(1u << (bit & 7u));
    }
    for (uint i = 0; i < bytes; ++i) putchar_raw(tdo[i]);
    return 1;
}

/* ---------------- AVR ISP raw SPI: GP2=/RESET GP3=SCK GP4=MISO GP5=MOSI ---------------- */
#define AVR_RESET 2
#define AVR_SCK 3
#define AVR_MISO 4
#define AVR_MOSI 5

static uint8_t avr_spi(uint8_t out) {
    uint8_t in = 0; for (int i = 7; i >= 0; --i) { gpio_put(AVR_MOSI, (out >> i) & 1u); gpio_put(AVR_SCK, 1); sleep_us(1); in = (uint8_t)((in << 1) | gpio_get(AVR_MISO)); gpio_put(AVR_SCK, 0); sleep_us(1); } return in;
}

static void avr_init(void) {
    const uint pins[] = {AVR_RESET, AVR_SCK, AVR_MOSI, AVR_MISO};
    for (uint i = 0; i < 4; ++i) { gpio_init(pins[i]); gpio_set_function(pins[i], GPIO_FUNC_SIO); }
    gpio_set_dir(AVR_RESET, GPIO_OUT); gpio_set_dir(AVR_SCK, GPIO_OUT); gpio_set_dir(AVR_MOSI, GPIO_OUT); gpio_set_dir(AVR_MISO, GPIO_IN);
    gpio_put(AVR_SCK, 0); gpio_put(AVR_MOSI, 0); gpio_put(AVR_RESET, 1); sleep_ms(20); gpio_put(AVR_RESET, 0); sleep_ms(25); gpio_put(AVR_RESET, 1); sleep_ms(25);
}

static void handle_avr_isp(void) {
    int a = getchar_timeout_us(1000000), b = getchar_timeout_us(1000000), c = getchar_timeout_us(1000000), d = getchar_timeout_us(1000000);
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    avr_init(); uint8_t r0 = avr_spi((uint8_t)a), r1 = avr_spi((uint8_t)b), r2 = avr_spi((uint8_t)c), r3 = avr_spi((uint8_t)d);
    putchar_raw(r0); putchar_raw(r1); putchar_raw(r2); putchar_raw(r3);
}

static void handle_command(uint8_t cmd) {
    if (cmd == 0x00 || cmd == 0x01) { sleep_ms(10); reset_usb_boot(0, 0); return; }
    if (cmd == 0x02) {
        int b0 = getchar_timeout_us(500000), b1 = getchar_timeout_us(500000), b2 = getchar_timeout_us(500000), ch = getchar_timeout_us(500000);
        if (b0 < 0 || b1 < 0 || b2 < 0 || ch < 0) return;
        configured_rate = (uint)b0 | ((uint)b1 << 8) | ((uint)b2 << 16); if (configured_rate == 0) configured_rate = 1000000;
        configured_channels = (uint)ch; if (configured_channels == 0 || configured_channels > CAPTURE_CHANNELS) configured_channels = CAPTURE_CHANNELS; return;
    }
    if (cmd == 0x04) { capture_samples(MAX_SAMPLES); return; }
    if (cmd == 0x05) return;
    if (cmd == 0x10 || cmd == 0x11) { handle_swd(cmd); return; }
    if (cmd == 0x23) { handle_jtag_sequence(); return; }
    if (cmd == 0x30) { handle_avr_isp(); return; }
}

int main(void) {
    stdio_init_all(); sleep_ms(1500);
    while (true) { int c = getchar_timeout_us(1000); if (c >= 0) handle_command((uint8_t)c); }
}
