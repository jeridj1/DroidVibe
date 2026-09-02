cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(droidvibe_swd C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(droidvibe_swd main.c)

target_compile_options(droidvibe_swd PRIVATE -include pico/bootrom.h)
target_link_libraries(droidvibe_swd
    pico_stdlib
    hardware_gpio
)

pico_enable_stdio_usb(droidvibe_swd 1)
pico_enable_stdio_uart(droidvibe_swd 0)

pico_add_extra_outputs(droidvibe_swd)
