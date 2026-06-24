#!/usr/bin/env python3
"""
Patch a React Native AndroidManifest.xml for the Hermit mobile app.

Adds:
- CAMERA permission for QR scanning
- usesCleartextTraffic="true" so local HTTP gateways (e.g. http://192.168.x.x:8787)
  work on Android 9+.
"""

import re
import sys


def main(manifest_path: str) -> None:
    with open(manifest_path) as f:
        text = f.read()

    # Add CAMERA permission if missing (place it right after the opening manifest tag)
    if "android.permission.CAMERA" not in text:
        text = re.sub(
            r"(<manifest[^>]*>)\n",
            r'\1\n    <uses-permission android:name="android.permission.CAMERA" />\n',
            text,
            count=1,
        )
        print("Added CAMERA permission")
    else:
        print("CAMERA permission already present")

    # Add usesCleartextTraffic to the application tag if missing
    if "usesCleartextTraffic" not in text:
        text = re.sub(
            r"(<application\s+)",
            r'\1android:usesCleartextTraffic="true" ',
            text,
            count=1,
        )
        print("Added usesCleartextTraffic attribute")
    else:
        print("usesCleartextTraffic attribute already present")

    with open(manifest_path, "w") as f:
        f.write(text)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path/to/AndroidManifest.xml>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
