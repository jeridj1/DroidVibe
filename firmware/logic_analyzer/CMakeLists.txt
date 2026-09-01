cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(droidvibe_la C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(droidvibe_la main.c)

target_link_libraries(droidvibe_la
    pico_stdlib
    hardware_gpio
    hardware_timer
)

pico_enable_stdio_usb(droidvibe_la 1)
pico_enable_stdio_uart(droidvibe_la 0)

pico_add_extra_outputs(droidvibe_la)
