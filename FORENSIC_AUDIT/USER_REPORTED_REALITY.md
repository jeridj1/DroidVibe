# User-reported behavior and project target

This file records observations reported by the project owner during development. These are important test-context clues, but they are NOT independently verified facts. An auditor must reproduce or verify them before treating them as confirmed defects.

## Current target

The goal is an Android-native Arduino workstation that keeps the useful basic workflow of the existing Arduino-on-Android app available from the Play Store, while adding the substantially broader capabilities being developed in DroidVibe.

The intended direction includes local/offline compilation, USB board detection and flashing, serial monitoring, RP2040 logic-analyzer functionality, richer board support, AI-assisted coding/error help, and eventually deeper programmer/debugger capabilities. The project should remain practical on a phone rather than requiring a laptop for ordinary Arduino development.

## Known comparison point

The owner reports that the existing Arduino app from the Play Store works. DroidVibe should not be judged as though basic Arduino-on-Android functionality is inherently impossible. The useful question is what DroidVibe adds, how reliably it adds it, and whether the extra architecture is justified.

## DroidVibe observations

A recent installed DroidVibe APK was reported to compile/install, but the Compile experience produced red, missing-file-looking output and the application did not appear to do much beyond partially recognizing a connected board. An AI mode tab was visible.

The owner has also reported that automated coding assistance sometimes appeared to create unexpected commits or corrupted content, including a suspected `branch.ps1` problem after a URL-fetch failure. This needs direct Git/history verification. Do not assume the automation caused it without evidence.

The owner has observed a very large number of failed workflow runs over the project's history, reportedly more than twenty-five hundred. The exact count and failure distribution should be independently measured from GitHub Actions rather than copied as fact.

## Hardware/test context that may matter

Primary test phone is a Samsung Galaxy S23 Ultra on Verizon. The project is expected to operate as a phone-first Android application, including USB-OTG hardware access through a custom APK rather than Expo Go.

The owner wants the app to be useful with real Arduino-class boards and RP2040 hardware, not merely to display simulated/demo data.

## Auditor instruction

Treat every item above as a test hypothesis or user-observed symptom. Correlate it with source, logs, commits, and reproducible behavior. If the repository contradicts an observation, record both rather than silently choosing one.
