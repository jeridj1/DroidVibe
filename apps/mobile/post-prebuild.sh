#!/bin/bash
# DroidVibe Post-Prebuild Script
# This script runs after expo prebuild to ensure proper Android configuration

set -e

echo "[DroidVibe] Running post-prebuild configuration..."

# Navigate to mobile directory
cd "$(dirname "$0")"

# Check if android directory exists
if [ ! -d "android" ]; then
  echo "[DroidVibe] Android directory not found. Run 'expo prebuild --platform android' first."
  exit 1
fi

cd android

echo "[DroidVibe] Configuring Android project..."

# Copy gradle.properties if it doesn't exist or is different
if [ ! -f "gradle.properties" ] || ! grep -q "android.kotlinVersion=1.9.25" "gradle.properties"; then
  echo "[DroidVibe] Updating gradle.properties..."
  # Copy from parent directory
  if [ -f "../gradle.properties" ]; then
    cp "../gradle.properties" "gradle.properties"
    echo "[DroidVibe] Copied gradle.properties from parent directory"
  else
    # Create with required settings
    cat > gradle.properties << 'EOF'
# DroidVibe Gradle Properties
android.kotlinVersion=1.9.25
kotlin.code.style=official
kotlin.jvm.target.validation.mode=warning
org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=false
android.useAndroidX=true
android.enableJetifier=true
EOF
    echo "[DroidVibe] Created gradle.properties with required settings"
  fi
fi

# Ensure settings.gradle has proper autolinking
if [ ! -f "settings.gradle" ]; then
  echo "[DroidVibe] ERROR: settings.gradle not found"
  exit 1
fi

# Check for Expo autolinking
if ! grep -q "useExpoModules" "settings.gradle"; then
  echo "[DroidVibe] Adding Expo autolinking to settings.gradle..."
  # Add Expo autolinking if not present
  if ! grep -q "apply from.*ExpoModulesCorePlugin" "settings.gradle"; then
    # Insert after pluginManagement if it exists, otherwise at the end
    if grep -q "pluginManagement" "settings.gradle"; then
      # Find the end of pluginManagement and insert before it
      sed -i '/^}$/i\n// Expo autolinking
apply from: new File(["node", "--print", "require.resolve("expo-modules-core/package.json")"].execute().text.trim(), "scripts/autolinking.gradle")
useExpoModules(this)' settings.gradle
    else
      # Append to end of file
      cat >> settings.gradle << 'EOF'

// Expo autolinking
apply from: new File(["node", "--print", "require.resolve("expo-modules-core/package.json")"].execute().text.trim(), "scripts/autolinking.gradle")
useExpoModules(this)
EOF
    fi
    echo "[DroidVibe] Added Expo autolinking to settings.gradle"
  fi
fi

# Ensure native-usb module is included
if ! grep -q "native-usb" "settings.gradle"; then
  echo "[DroidVibe] Adding native-usb module to settings.gradle..."
  # Check if includeBuild exists for native-usb
  if ! grep -q "includeBuild.*native-usb" "settings.gradle"; then
    # Add after the app include
    sed -i '/include :'app'/a includeBuild("../../../packages/native-usb")' settings.gradle
    echo "[DroidVibe] Added native-usb module includeBuild"
  fi
fi

echo "[DroidVibe] Post-prebuild configuration complete!"
