
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";

import Header from "../components/Header";
import StatusCard from "../components/StatusCard";
import MapPreview from "../components/MapPreview";
import Loader from "../components/Loader";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../theme/colors";

import { getCurrentLocation } from "../services/locationService";
import { getAlerts } from "../services/alertService";
import { getDeviceStatus } from "../services/deviceService";
import { timeAgo } from "../utils/helpers";

const LOCATION_REFRESH = 5000;
const DEVICE_REFRESH = 15000;
const ALERT_REFRESH = 30000;
const GPS_STALE_AFTER = 20000;

// Keep the newest GPS reading.
// An older API response must not overwrite a newer reading.
const keepNewestLocation = (previous, incoming) => {
  if (!previous) return incoming;
  if (!incoming) return previous;

  const oldTime = new Date(previous.recordedAt).getTime();
  const newTime = new Date(incoming.recordedAt).getTime();

  if (
    Number.isFinite(oldTime) &&
    (!Number.isFinite(newTime) || newTime < oldTime)
  ) {
    return previous;
  }

  return incoming;
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [location, setLocation] = useState(null);
  const [latestAlert, setLatestAlert] = useState(null);
  const [device, setDevice] = useState(null);

  const [locationError, setLocationError] = useState(false);
  const [alertsError, setAlertsError] = useState(false);

  const [currentTime, setCurrentTime] = useState(Date.now());

  const userId = user?._id;

  const deviceId =
    user?.device?.deviceId ||
    user?.device?._id ||
    (typeof user?.device === "string"
      ? user.device
      : null);

  const dependentName =
    user?.dependent?.name || "Your loved one";

  useFocusEffect(
    useCallback(() => {
      let active = true;

      let locationBusy = false;
      let deviceBusy = false;
      let alertsBusy = false;

      // Fetch latest GPS location
      const fetchLocation = async () => {
        if (!userId || locationBusy) return;

        locationBusy = true;

        try {
          const data = await getCurrentLocation(userId);

          if (active) {
            setLocation((previous) =>
              keepNewestLocation(previous, data)
            );

            setLocationError(false);
          }
        } catch (error) {
          console.log(
            "DASHBOARD GPS ERROR:",
            error?.message || error
          );

          if (active) {
            setLocationError(true);
          }
        } finally {
          locationBusy = false;

          if (active) {
            setCurrentTime(Date.now());
            setLoading(false);
          }
        }
      };

      // Fetch actual device status
      const fetchDevice = async () => {
        if (!deviceId) {
          if (active) setDevice(null);
          return;
        }

        if (deviceBusy) return;

        deviceBusy = true;

        try {
          const result = await getDeviceStatus(deviceId);

          if (active) {
            setDevice(result);
          }
        } catch (error) {
          console.log(
            "DASHBOARD DEVICE ERROR:",
            error?.message || error
          );

          if (active) {
            setDevice(null);
          }
        } finally {
          deviceBusy = false;
        }
      };

      // Fetch alerts
      const fetchAlerts = async () => {
        if (!userId || alertsBusy) return;

        alertsBusy = true;

        try {
          const result = await getAlerts(userId, 1, 1);

          if (active) {
            const alerts = Array.isArray(result)
              ? result
              : [];

            setLatestAlert(alerts[0] || null);
            setAlertsError(false);
          }
        } catch (error) {
          console.log(
            "DASHBOARD ALERT ERROR:",
            error?.message || error
          );

          if (active) {
            setAlertsError(true);
          }
        } finally {
          alertsBusy = false;
        }
      };

      // Initial requests
      fetchLocation();
      fetchDevice();
      fetchAlerts();

      // GPS refresh every 5 seconds
      const locationInterval = setInterval(
        fetchLocation,
        LOCATION_REFRESH
      );

      // Device refresh every 15 seconds
      const deviceInterval = setInterval(
        fetchDevice,
        DEVICE_REFRESH
      );

      // Alerts refresh every 30 seconds
      const alertsInterval = setInterval(
        fetchAlerts,
        ALERT_REFRESH
      );

      // Update elapsed time
      const timeInterval = setInterval(() => {
        if (active) {
          setCurrentTime(Date.now());
        }
      }, 5000);

      return () => {
        active = false;

        clearInterval(locationInterval);
        clearInterval(deviceInterval);
        clearInterval(alertsInterval);
        clearInterval(timeInterval);
      };
    }, [userId, deviceId])
  );

  // Manual pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);

    try {
      const requests = [];

      if (userId) {
        requests.push(
          getCurrentLocation(userId)
            .then((data) => {
              setLocation((previous) =>
                keepNewestLocation(previous, data)
              );
              setLocationError(false);
            })
            .catch(() => {
              setLocationError(true);
            })
        );

        requests.push(
          getAlerts(userId, 1, 1)
            .then((result) => {
              const alerts = Array.isArray(result)
                ? result
                : [];

              setLatestAlert(alerts[0] || null);
              setAlertsError(false);
            })
            .catch(() => {
              setAlertsError(true);
            })
        );
      }

      if (deviceId) {
        requests.push(
          getDeviceStatus(deviceId)
            .then(setDevice)
            .catch(() => setDevice(null))
        );
      }

      await Promise.all(requests);
      setCurrentTime(Date.now());
    } finally {
      setRefreshing(false);
    }
  };

  // =====================================
  // GPS LIVE STATUS
  // =====================================

  const recordedTime = location?.recordedAt
    ? new Date(location.recordedAt).getTime()
    : NaN;

  const gpsAge = currentTime - recordedTime;

  // GPS remains live for 20 seconds after
  // the last valid GPS reading.
  // Temporary API failures do not instantly
  // change the badge to Not Live.
  const isGpsLive =
    Boolean(location) &&
    Number.isFinite(recordedTime) &&
    gpsAge >= -5000 &&
    gpsAge <= GPS_STALE_AFTER;

  const isDeviceOnline = device?.status === "online";

  const hasLinkedDevice = Boolean(deviceId);

  const trackingStatus = isGpsLive
    ? "GPS Tracking Active"
    : locationError
      ? "Connection Issue"
      : location
        ? "Last Known Location"
        : "Waiting for GPS";

  const trackingBadge = isGpsLive
    ? "GPS Live"
    : "Not Live";

  // =====================================
  // DEVICE STATUS
  // =====================================

  const deviceStatusText = !hasLinkedDevice
    ? "Not Linked"
    : isDeviceOnline
      ? "Online"
      : device?.status === "offline"
        ? "Offline"
        : "Status Unavailable";

  // Battery percentage removed because
  // actual battery monitoring is not available.
  const deviceCaption = !hasLinkedDevice
    ? "Device not linked to account"
    : isDeviceOnline
      ? "Device connected"
      : "Check device connection";

  if (loading) return <Loader />;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <Header
        title="SIGHTA Guardian"
        onBellPress={() => navigation.navigate("Alerts")}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.greeting}>
          Hello, {user?.name?.split(" ")[0] || "Guardian"}
        </Text>

        <Text style={styles.subGreeting}>
          Here's how {dependentName} is doing right now.
        </Text>

        {/* Live GPS Tracking Status */}
        <StatusCard
          label={`${dependentName}'s Status`}
          value={trackingStatus}
          caption={
            location?.recordedAt
              ? `Last GPS update ${timeAgo(location.recordedAt)}`
              : "No GPS location received yet"
          }
          icon="person-circle-outline"
          badge={trackingBadge}
          badgeTone={isGpsLive ? "success" : "error"}
        />

        {/* Current Location Map */}
        <View style={styles.mapCard}>
          <Text style={styles.mapLabel}>
            Current Location
          </Text>

          <MapPreview
            latitude={location?.latitude}
            longitude={location?.longitude}
            label={dependentName}
            height={180}
          />
        </View>

        {/* Latest Alert */}
        {latestAlert ? (
          <StatusCard
            label="Latest Alert"
            value={latestAlert.message}
            caption={
              latestAlert.triggeredAt
                ? timeAgo(latestAlert.triggeredAt)
                : "Alert received"
            }
            icon="warning-outline"
            badge={
              latestAlert.type === "sos"
                ? "SOS"
                : undefined
            }
            badgeTone="error"
          />
        ) : (
          <StatusCard
            label="Latest Alert"
            value={
              alertsError
                ? "Alerts Unavailable"
                : "No Alerts Yet"
            }
            caption={
              alertsError
                ? "Unable to load alerts"
                : "No safety alerts have been received"
            }
            icon={
              alertsError
                ? "alert-circle-outline"
                : "checkmark-circle-outline"
            }
          />
        )}

        {/* Device Status */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <StatusCard
              label="SIGHTA Device"
              value={deviceStatusText}
              caption={deviceCaption}
              icon="glasses-outline"
              badge={
                isDeviceOnline
                  ? "Connected"
                  : undefined
              }
              badgeTone="success"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.margin,
    paddingBottom: spacing.xl,
  },

  greeting: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },

  subGreeting: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.lg,
  },

  mapCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  mapLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },

  row: {
    flexDirection: "row",
  },
});
