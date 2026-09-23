import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import { colors, spacing, radius, typography } from "../theme/colors";
import * as authService from "../services/authService";

const DEFAULTS = {
  sosAlerts: true,
  lowBattery: true,
  deviceOffline: true,
  dailySummary: false,
};

export default function NotificationSettingsScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const [settings, setSettings] = useState({ ...DEFAULTS, ...(user?.notificationSettings || {}) });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ notificationSettings: settings });
      await refreshProfile();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't save settings", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Notifications" showLogo={false} onMenuPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <ToggleRow
          icon="warning-outline"
          label="SOS Alerts"
          description="Immediate emergency alerts from the SIGHTA device"
          value={settings.sosAlerts}
          onChange={() => toggle("sosAlerts")}
        />
        <ToggleRow
          icon="battery-half-outline"
          label="Low Battery"
          description="Get notified when the device battery drops below 20%"
          value={settings.lowBattery}
          onChange={() => toggle("lowBattery")}
        />
        <ToggleRow
          icon="cloud-offline-outline"
          label="Device Offline"
          description="Get notified if the glasses disconnect unexpectedly"
          value={settings.deviceOffline}
          onChange={() => toggle("deviceOffline")}
        />
        <ToggleRow
          icon="today-outline"
          label="Daily Summary"
          description="A daily recap of location and activity"
          value={settings.dailySummary}
          onChange={() => toggle("dailySummary")}
        />

        <TouchableOpacity style={[styles.button, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ icon, label, description, value, onChange }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.primary} style={{ width: 30 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.outlineVariant, true: colors.primaryFixedDim }}
        thumbColor={value ? colors.primary : "#ffffff"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.margin, paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: { ...typography.labelLg, color: colors.onSurface },
  rowDescription: { ...typography.labelMd, color: colors.onSurfaceVariant, marginTop: 2 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  buttonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 16 },
});