import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import StatusCard from "../components/StatusCard";
import MapPreview from "../components/MapPreview";
import Loader from "../components/Loader";
import { colors, spacing, radius, typography } from "../theme/colors";
import { getCurrentLocation } from "../services/locationService";
import { getAlerts } from "../services/alertService";
import { getDeviceStatus } from "../services/deviceService";
import { timeAgo } from "../utils/helpers";

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState(null);
  const [latestAlert, setLatestAlert] = useState(null);
  const [device, setDevice] = useState(null);

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [locationResult, alertsResult] = await Promise.allSettled([
        getCurrentLocation(user._id),
        getAlerts(user._id, 1, 1),
      ]);

      if (locationResult.status === "fulfilled") setLocation(locationResult.value);
      if (alertsResult.status === "fulfilled" && alertsResult.value.length > 0) {
        setLatestAlert(alertsResult.value[0]);
      }

      if (user.device) {
        const deviceId = user.device.deviceId || user.device;
        try {
          const deviceStatus = await getDeviceStatus(deviceId);
          setDevice(deviceStatus);
        } catch (e) {
          // Device may not be registered yet; dashboard still renders without it
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <Loader />;

  const dependentName = user?.dependent?.name || "Your loved one";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="SIGHTA Guardian" onBellPress={() => navigation.navigate("Alerts")} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] || "Guardian"}</Text>
        <Text style={styles.subGreeting}>Here's how {dependentName} is doing right now.</Text>

        <StatusCard
          label={`${dependentName}'s Status`}
          value={device?.status === "online" ? "Safe & Active" : "Status Unknown"}
          caption={location ? `Last seen ${timeAgo(location.recordedAt)}` : "No location data yet"}
          icon="person-circle-outline"
          badge={device?.status === "online" ? "Connected" : "Offline"}
          badgeTone={device?.status === "online" ? "success" : "error"}
        />

        <View style={styles.mapCard}>
          <Text style={styles.mapLabel}>Current Location</Text>
          <MapPreview
            latitude={location?.latitude}
            longitude={location?.longitude}
            label={dependentName}
            height={180}
          />
        </View>

        {latestAlert ? (
          <StatusCard
            label="Latest Alert"
            value={latestAlert.message}
            caption={timeAgo(latestAlert.triggeredAt)}
            icon="warning-outline"
            badge={latestAlert.type === "sos" ? "SOS" : undefined}
            badgeTone="error"
          />
        ) : (
          <StatusCard label="Latest Alert" value="No alerts yet" caption="You're all caught up" icon="checkmark-circle-outline" />
        )}

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <StatusCard
              label="Device"
              value={device?.status === "online" ? "Online" : "Offline"}
              caption={device ? `${device.batteryPercentage}% battery` : "Not registered"}
              icon="glasses-outline"
              badge={device?.status === "online" ? "Connected" : undefined}
              badgeTone="success"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.margin, paddingBottom: spacing.xl },
  greeting: { ...typography.headlineLg, color: colors.onSurface },
  subGreeting: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.lg },
  mapCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mapLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, textTransform: "uppercase", marginBottom: spacing.sm },
  row: { flexDirection: "row" },
});
