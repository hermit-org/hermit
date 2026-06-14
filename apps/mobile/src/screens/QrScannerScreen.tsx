import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Camera, CameraType } from "react-native-camera-kit";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useGatewayStore } from "../stores";
import type { RootStackParamList } from "../navigation/RootNavigator";

type QrScannerNavigation = NavigationProp<RootStackParamList, "QrScanner">;

function parseConnectionString(input: string): { url: string; sendUrl: string; token: string } | null {
  try {
    const trimmed = input.trim();
    const deepLinkMatch = trimmed.match(/^hermit:\/\/connect\?payload=(.+)$/);
    const json = deepLinkMatch ? decodeURIComponent(deepLinkMatch[1]) : trimmed;
    const parsed = JSON.parse(json) as { url?: string; sendUrl?: string; token?: string };
    if (!parsed.url || !parsed.token) return null;
    return {
      url: parsed.url,
      sendUrl: parsed.sendUrl || parsed.url.replace(/\/$/, "/send"),
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

export function QrScannerScreen(): React.JSX.Element {
  const navigation = useNavigation<QrScannerNavigation>();
  const { addGateway, setActiveGateway } = useGatewayStore();
  const [scanning, setScanning] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleBarcodeRead = (event: { nativeEvent?: { codeStringValue?: string } }) => {
    if (!scanning) return;

    const value = event.nativeEvent?.codeStringValue;
    if (!value) return;

    setScanning(false);
    const connection = parseConnectionString(value);

    if (!connection) {
      Alert.alert("Invalid QR code", "Could not parse connection data.");
      setScanning(true);
      return;
    }

    const gateway = addGateway({
      name: "Scanned Gateway",
      url: connection.url,
      sendUrl: connection.sendUrl,
      token: connection.token,
    });
    setActiveGateway(gateway.id);

    Alert.alert("Gateway added", "Connect to this gateway now?", [
      { text: "Later", style: "cancel", onPress: () => navigation.goBack() },
      {
        text: "Connect",
        onPress: () => {
          navigation.goBack();
          navigation.navigate("SessionList", { gatewayId: gateway.id });
        },
      },
    ]);
  };

  if (permissionDenied) {
    return (
      <View style={localStyles.center}>
        <Text style={localStyles.message}>Camera permission is required to scan QR codes.</Text>
        <TouchableOpacity style={localStyles.button} onPress={() => setPermissionDenied(false)}>
          <Text style={localStyles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={localStyles.container}>
      <Camera
        style={localStyles.camera}
        cameraType={CameraType.Back}
        scanBarcode
        onReadCode={handleBarcodeRead}
        showFrame
        frameColor="#007AFF"
        laserColor="#007AFF"
      />
      <View style={localStyles.overlay}>
        <Text style={localStyles.hint}>Point the camera at the Hermit QR code</Text>
        {!scanning && <ActivityIndicator style={localStyles.spinner} />}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hint: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  spinner: {
    marginTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
