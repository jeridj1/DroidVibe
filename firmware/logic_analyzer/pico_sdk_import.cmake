# pico_sdk_import.cmake
# Standard SDK import helper — auto-finds the Pico SDK from PICO_SDK_PATH
# or fetches it from git if PICO_SDK_FETCH_FROM_GIT is set.

if (DEFINED ENV{PICO_SDK_PATH} AND (NOT PICO_SDK_PATH))
    set(PICO_SDK_PATH $ENV{PICO_SDK_PATH})
    message("Using PICO_SDK_PATH from environment ('${PICO_SDK_PATH}')")
endif ()

if (DEFINED ENV{PICO_SDK_FETCH_FROM_GIT} AND (NOT PICO_SDK_FETCH_FROM_GIT))
    set(PICO_SDK_FETCH_FROM_GIT $ENV{PICO_SDK_FETCH_FROM_GIT})
    message("Using PICO_SDK_FETCH_FROM_GIT from environment ('${PICO_SDK_FETCH_FROM_GIT}')")
endif ()

if (DEFINED ENV{PICO_SDK_FETCH_FROM_GIT_PATH} AND (NOT PICO_SDK_FETCH_FROM_GIT_PATH))
    set(PICO_SDK_FETCH_FROM_GIT_PATH $ENV{PICO_SDK_FETCH_FROM_GIT_PATH})
    message("Using PICO_SDK_FETCH_FROM_GIT_PATH from environment ('${PICO_SDK_FETCH_FROM_GIT_PATH}')")
endif ()

if (NOT PICO_SDK_PATH)
    if (PICO_SDK_FETCH_FROM_GIT)
        include(FetchContent)
        set(FETCHCONTENT_BASE_DIR ${CMAKE_BINARY_DIR}/_deps)
        if (NOT PICO_SDK_FETCH_FROM_GIT_PATH)
            set(PICO_SDK_FETCH_FROM_GIT_PATH ${FETCHCONTENT_BASE_DIR}/pico-sdk)
        endif ()
        FetchContent_Declare(
            pico_sdk
            GIT_REPOSITORY https://github.com/raspberrypi/pico-sdk
            GIT_TAG master
        )
        if (NOT PICO_SDK_PATH)
            set(PICO_SDK_PATH ${FETCHCONTENT_BASE_DIR}/pico-sdk)
        endif ()
        FetchContent_MakeAvailable(pico_sdk)
    else ()
        message(FATAL_ERROR
            "PICO_SDK_PATH not set and PICO_SDK_FETCH_FROM_GIT not set.\n"
            "Set PICO_SDK_PATH to the location of the pico-sdk, or set "
            "PICO_SDK_FETCH_FROM_GIT=1 to auto-fetch.")
    endif ()
endif ()

include(${PICO_SDK_PATH}/pico_sdk_init.cmake)
