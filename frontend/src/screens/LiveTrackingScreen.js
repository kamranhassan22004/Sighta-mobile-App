import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import MapPreview from "../components/MapPreview";
import Loader from "../components/Loader";
import { colors, spacing, radius, typography } from "../theme/colors";
import { getCurrentLocation } from "../services/locationService";
import { formatTime, timeAgo } from "../utils/helpers";

export default function LiveTrackingScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gettingDirections, setGettingDirections] = useState(false);

  const dependentName = user?.dependent?.name || "Your loved one";

  const load = useCallback(async () => {
    if (!user?._id) return;
    try {
      const data = await getCurrentLocation(user._id);
      setLocation(data);
    } catch (e) {
      // No location yet — fine, screen shows the empty state via MapPreview
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleGetDirections = async () => {
    if (!location) {
      return Alert.alert("No location yet", `We don't have a recent location for ${dependentName}.`);
    }

    setGettingDirections(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access so we can give you directions from where you are."
        );
        setGettingDirections(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const originLat = current.coords.latitude;
      const originLng = current.coords.longitude;

      const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${location.latitude},${location.longitude}&travelmode=driving`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Couldn't open Maps", "No maps app is available to handle directions.");
      }
    } catch (error) {
      Alert.alert("Something went wrong", "Couldn't get your current location. Please try again.");
    } finally {
      setGettingDirections(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="SIGHTA Guardian" subtitle={`Live Location - ${dependentName}`} />

      <View style={styles.mapContainer}>
        <MapPreview
          latitude={location?.latitude}
          longitude={location?.longitude}
          label={dependentName}
          height={340}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.name}>{dependentName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: location ? colors.success : colors.outline }]} />
              <Text style={styles.statusText}>{location ? "Location Active" : "No Recent Location"}</Text>
            </View>
          </View>
          {location ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.updatedLabel}>Last updated</Text>
              <Text style={styles.updatedTime}>{formatTime(location.recordedAt)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={handleRefresh} disabled={refreshing}>
            <Ionicons name="refresh" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryButtonText}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { flex: 1, marginLeft: spacing.sm }]}
            onPress={handleGetDirections}
            disabled={gettingDirections || !location}
          >
            <Ionicons name="navigate" size={18} color={colors.onPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>{gettingDirections ? "Locating…" : "Directions"}</Text>
          </TouchableOpacity>
        </View>

        {location ? (
          <Text style={styles.coords}>
            {location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
            {"  ·  "}
            {timeAgo(location.recordedAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: { flex: 1, padding: spacing.margin, paddingBottom: 0 },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.margin,
    shadowColor: "#000066",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { ...typography.headlineSm, color: colors.onSurface },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { ...typography.bodyMd, color: colors.success },
  updatedLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  updatedTime: { ...typography.headlineSm, color: colors.onSurface },
  buttonRow: { flexDirection: "row", marginTop: spacing.md },
  button: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 15 },
  secondaryButton: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { ...typography.labelLg, color: colors.primary, fontSize: 15 },
  coords: { ...typography.labelMd, color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.sm },
});