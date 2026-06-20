import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { ServerListScreen } from "../screens/ServerListScreen";
import { SessionListScreen } from "../screens/SessionListScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { QrScannerScreen } from "../screens/QrScannerScreen";

export type RootStackParamList = {
  ServerList: undefined;
  SessionList: { gatewayId: string };
  Chat: { sessionId: string };
  QrScanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ServerList">
        <Stack.Screen
          name="ServerList"
          component={ServerListScreen}
          options={{ title: t("navigation.gateways") }}
        />
        <Stack.Screen
          name="SessionList"
          component={SessionListScreen}
          options={{ title: t("navigation.sessions") }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: t("navigation.chat") }}
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
