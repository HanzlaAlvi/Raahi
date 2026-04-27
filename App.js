import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ───────────── FCM + Alarm ───────────── */
import useFCMPushToken from "./frontend/hooks/useFCMPushToken";
import AlarmHandler from "./frontend/Transporter/components/AlarmHandler";
import { createAlarmChannel } from "./frontend/Transporter/services/alarmChannel";

/* ───────────── Screens ───────────── */

// Onboarding
import Onboarding from "./frontend/screens/Onboarding";
import WelcomeScreen from "./frontend/screens/WelcomeScreen";
import HelloScreen from "./frontend/screens/HelloScreen";
import DashboardRegisterScreen from "./frontend/screens/DashboardRegisterScreen";

// Auth
import LoginScreen from "./frontend/auth/LoginScreen";

// Forget Password
import ForgetPasswordScreen from "./frontend/auth/ForgetPasswordScreen";
import OTPVerificationScreen from "./frontend/auth/OTPVerificationScreen";
import ResetPasswordScreen from "./frontend/auth/ResetPasswordScreen";

// Transporter
import TransporterRegisterScreen from "./frontend/Transporter/auth/TransporterRegisterScreen";
import TransporterDashboardScreen from "./frontend/Transporter/TransporterDashboard";

// Driver
import DriverDashboardScreen from "./frontend/Driver/DriverDashboardScreen";
import DriverAssignedRoutesScreen from "./frontend/Driver/DriverAssignedRoutesScreen";
import DriverRegistrationScreen from "./frontend/Driver/auth/DriverRegistrationScreen";

// Passenger
import PassengerAppNavigation from "./frontend/Passenger/src/navigation/PassengerAppNavigation";
import PassengerRequestScreen from "./frontend/Passenger/src/screens/auth/PassengerRequestScreen";
import AlertScreen from "./frontend/Passenger/src/screens/notifications/AlertScreen";

// Context
import { AuthProvider } from "./frontend/context/AuthContext";

/* ───────────── Navigation ───────────── */
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

/* ───────────── Transporter Drawer ───────────── */
function TransporterDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerStyle: { backgroundColor: "#fff", width: 240 },
        drawerActiveTintColor: "#439b4e",
        drawerLabelStyle: { fontSize: 15, fontWeight: "600" },
      }}
    >
      <Drawer.Screen
        name="TransporterDashboard"
        component={TransporterDashboardScreen}
        options={{
          title: "Dashboard",
          drawerIcon: ({ color }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

/* ───────────── Driver Drawer ───────────── */
function DriverDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerStyle: { backgroundColor: "#fff", width: 240 },
        drawerActiveTintColor: "#439b4e",
        drawerLabelStyle: { fontSize: 15, fontWeight: "600" },
      }}
    >
      <Drawer.Screen
        name="DriverDashboard"
        component={DriverDashboardScreen}
        options={{
          title: "Dashboard",
          drawerIcon: ({ color }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="DriverAssignedRoutes"
        component={DriverAssignedRoutesScreen}
        options={{
          title: "Assigned Routes",
          drawerIcon: ({ color }) => (
            <Ionicons name="map-outline" size={22} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

/* ───────────── Root App ───────────── */
export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);

  /* FCM init */
  useFCMPushToken();

  /* Alarm + onboarding check */
  useEffect(() => {
    createAlarmChannel();

    (async () => {
      try {
        const value = await AsyncStorage.getItem("hasSeenOnboarding");
        setIsFirstLaunch(value === null);
      } catch {
        setIsFirstLaunch(false);
      }
    })();
  }, []);

  /* Loading screen */
  if (isFirstLaunch === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#439b4e" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Welcome"
          screenOptions={{ headerShown: false }}
        >
          {/* ───── Onboarding ───── */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen name="HelloScreen" component={HelloScreen} />
          <Stack.Screen
            name="DashboardRegister"
            component={DashboardRegisterScreen}
          />

          {/* ───── Auth ───── */}
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* ───── Forget Password Flow ───── */}
          <Stack.Screen
            name="ForgetPassword"
            component={ForgetPasswordScreen}
          />
          <Stack.Screen
            name="OTPVerification"
            component={OTPVerificationScreen}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
          />

          {/* ───── Transporter ───── */}
          <Stack.Screen
            name="TransporterRegister"
            component={TransporterRegisterScreen}
          />
          <Stack.Screen name="Transporter" component={TransporterDrawer} />

          {/* ───── Driver ───── */}
          <Stack.Screen
            name="DriverRegister"
            component={DriverRegistrationScreen}
          />
          <Stack.Screen name="Driver" component={DriverDrawer} />

          {/* ───── Passenger ───── */}
          <Stack.Screen
            name="PassengerRequestScreen"
            component={PassengerRequestScreen}
          />
          <Stack.Screen
            name="PassengerAppNavigation"
            component={PassengerAppNavigation}
          />
          <Stack.Screen name="AlertScreen" component={AlertScreen} />
        </Stack.Navigator>

        {/* Global Alarm Handler */}
        <AlarmHandler />
      </NavigationContainer>
    </AuthProvider>
  );
}