cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(droidvibe_avr_isp C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(droidvibe_avr_isp main.c)

target_compile_options(droidvibe_avr_isp PRIVATE -include pico/bootrom.h)
target_link_libraries(droidvibe_avr_isp
    pico_stdlib
    hardware_gpio
    hardware_spi
)

pico_enable_stdio_usb(droidvibe_avr_isp 1)
pico_enable_stdio_uart(droidvibe_avr_isp 0)

pico_add_extra_outputs(droidvibe_avr_isp)
