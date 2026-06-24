#!/usr/bin/env python3
"""
Patch a React Native android/app/build.gradle to add a release signing config.

The script expects the standard RN 0.76 signingConfigs block and modifies it to
include a release config that reads credentials from environment variables. It
also points the release buildType at the release signing config.

Environment variables:
  ANDROID_KEYSTORE_PASSWORD  Keystore password
  ANDROID_KEY_ALIAS          Key alias
  ANDROID_KEY_PASSWORD       Key password
"""

import os
import sys


def main(build_file: str) -> None:
    with open(build_file) as f:
        text = f.read()

    old_signing = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }"""

    new_signing = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('hermit-release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }"""

    if old_signing not in text:
        print(
            "ERROR: Could not find the expected signingConfigs block in build.gradle",
            file=sys.stderr,
        )
        sys.exit(1)

    text = text.replace(old_signing, new_signing)

    # Point the release buildType at the release signing config
    text = text.replace(
        "signingConfig signingConfigs.debug\n            minifyEnabled enableProguardInReleaseBuilds",
        "signingConfig signingConfigs.release\n            minifyEnabled enableProguardInReleaseBuilds",
    )

    with open(build_file, "w") as f:
        f.write(text)

    print("Release signing config patched successfully")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path/to/android/app/build.gradle>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
