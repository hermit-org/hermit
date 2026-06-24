import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { GatewayManagerScreen } from "../screens/GatewayManagerScreen";
import { AcpClientScreen } from "../screens/AcpClientScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { QrScannerScreen } from "../screens/QrScannerScreen";

export type RootStackParamList = {
  GatewayManager: undefined;
  AcpClient: { gatewayId: string };
  Settings: undefined;
  QrScanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="GatewayManager">
        <Stack.Screen
          name="GatewayManager"
          component={GatewayManagerScreen}
          options={{ title: t("navigation.gateways") }}
        />
        <Stack.Screen
          name="AcpClient"
          component={AcpClientScreen}
          options={{ title: t("navigation.chat") }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: t("navigation.settings") }}
        />
        <Stack.Screen
          name="QrScanner"
          component={QrScannerScreen}
          options={{ title: t("navigation.scanQr"), presentation: "modal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
