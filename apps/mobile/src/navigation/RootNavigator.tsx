import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ServerListScreen } from "../screens/ServerListScreen";
import { SessionListScreen } from "../screens/SessionListScreen";
import { ChatScreen } from "../screens/ChatScreen";

export type RootStackParamList = {
  ServerList: undefined;
  SessionList: { gatewayId: string };
  Chat: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ServerList">
        <Stack.Screen
          name="ServerList"
          component={ServerListScreen}
          options={{ title: "Gateways" }}
        />
        <Stack.Screen
          name="SessionList"
          component={SessionListScreen}
          options={{ title: "Sessions" }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: "Chat" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
