
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

import DashboardScreen from "../screens/DashboardScreen";
import LiveTrackingScreen from "../screens/LiveTrackingScreen";
import AlertScreen from "../screens/AlertScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";

import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PrivacySecurityScreen from "../screens/PrivacySecurityScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";

// NEW: Daily Activity Screen
import DailyActivityScreen from "../screens/DailyActivityScreen";

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{ headerShown: false }}
    >
      <ProfileStack.Screen
        name="ProfileHome"
        component={ProfileScreen}
      />

      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
      />

      {/* NEW: Daily Activity */}
      <ProfileStack.Screen
        name="DailyActivity"
        component={DailyActivityScreen}
      />

      <ProfileStack.Screen
        name="PrivacySecurity"
        component={PrivacySecurityScreen}
      />

      <ProfileStack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
      />
    </ProfileStack.Navigator>
  );
}

const iconMap = {
  Home: "home",
  Tracking: "location",
  Alerts: "warning",
  History: "time",
  Profile: "person",
};

export default function AppNavigator() {
  const { user } = useAuth();
  const accountDeviceKey = `${user?._id}:${user?.device?._id || user?.device?.deviceId || user?.device || "none"}`;
  return (
    <Tab.Navigator
      key={accountDeviceKey}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 0,
          height: 66,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: "#000066",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={
              focused
                ? iconMap[route.name]
                : `${iconMap[route.name]}-outline`
            }
            size={size ? size - 2 : 22}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
      />

      <Tab.Screen
        name="Tracking"
        component={LiveTrackingScreen}
      />

      <Tab.Screen
        name="Alerts"
        component={AlertScreen}
      />

      <Tab.Screen
        name="History"
        component={HistoryScreen}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
      />
    </Tab.Navigator>
  );
}
