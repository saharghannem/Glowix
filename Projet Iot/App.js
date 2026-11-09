import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets, SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Login from "./src/screens/Login";
import Devices from "./src/screens/Devices";
import Accueil from "./src/screens/Accueil";
import Dashboard from "./src/screens/Dashboard";
import Alerts from "./src/screens/Alerts";
import ScanQR from "./src/screens/ScanQR";
import Profile from "./src/screens/Profile";
import DeviceConfig from "./src/screens/DeviceConfig";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs({ navigation, clientId, client }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0E1A",
          borderTopColor: "#1E2A45",
          borderTopWidth: 1,
          height: 72 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#00F5C4",
        tabBarInactiveTintColor: "#3A4460",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Dashboard") {
            iconName = focused ? "grid" : "grid-outline";
          } else if (route.name === "Devices") {
            iconName = focused ? "hardware-chip" : "hardware-chip-outline";
          } else if (route.name === "Alerts") {
            iconName = focused ? "notifications" : "notifications-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={Dashboard}
        initialParams={{ clientId, client }}
      />

      <Tab.Screen
        name="Devices"
        component={Devices}
        initialParams={{ clientId, client }}
        options={{ title: "Mes Devices" }}
      />

      <Tab.Screen
        name="Alerts"
        component={Alerts}
        initialParams={{ clientId, client }}
        options={{ title: "Alertes" }}
      />

      <Tab.Screen
        name="Profile"
        component={Profile}
        initialParams={{ clientId, client }}
        options={{ title: "Profil" }}
      />
    </Tab.Navigator>
  );
}

function MainStack({ route }) {
  const clientId = route?.params?.clientId;
  const client = route?.params?.client;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0E1A" },
      }}
    >
      <Stack.Screen name="Tabs">
        {(props) => <MainTabs {...props} clientId={clientId} client={client} />}
      </Stack.Screen>

      <Stack.Screen
        name="Accueil"
        component={Accueil}
        initialParams={{ clientId, client }}
      />

      <Stack.Screen
        name="ScanQR"
        component={ScanQR}
        initialParams={{ clientId, client }}
      />

      <Stack.Screen
        name="DeviceConfig"
        component={DeviceConfig}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0E1A" },
          }}
        >
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Main" component={MainStack} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}