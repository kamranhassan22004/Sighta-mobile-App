import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { colors, radius, typography } from "../theme/colors";

// Renders a real Google Map on iOS/Android. On web (no native maps module),
// it falls back to a placeholder so `expo start --web` still runs for quick checks.
export default function MapPreview({ latitude, longitude, label, height = 260 }) {
  if (Platform.OS === "web" || !latitude || !longitude) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>
          {latitude && longitude ? `${label || "Location"}\n${latitude}, ${longitude}` : "Waiting for location…"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker coordinate={{ latitude, longitude }} title={label || "Current location"} pinColor={colors.primary} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { borderRadius: radius.xl, overflow: "hidden" },
  fallback: {
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fallbackText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center" },
});
