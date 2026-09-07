#include "hardware/pio.h"
#include "logic_capture.pio.h"

uint odt_capture_program_add(PIO pio) {
    return pio_add_program(pio, &odt_capture_program);
}

uint odt_capture_program_init(PIO pio, uint sm, uint offset, uint pin, float clkdiv) {
    pio_sm_config c = odt_capture_program_get_default_config(offset);
    sm_config_set_in_pins(&c, pin);
    sm_config_set_in_shift(&c, true, true, 32);
    sm_config_set_clkdiv(&c, clkdiv);
    for (uint i = 0; i < 8; ++i) pio_gpio_init(pio, pin + i);
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 8, false);
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_clear_fifos(pio, sm);
    return offset;
}
