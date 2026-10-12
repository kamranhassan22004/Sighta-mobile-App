
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
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

const REFRESH_INTERVAL = 5000;
const STALE_AFTER = 20000;


function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters

  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );

  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(2)} km`;
}


export default function LiveTrackingScreen() {
  const { user } = useAuth();

  const [location, setLocation] = useState(null);
  const [guardianLocation, setGuardianLocation] = useState(null);
  const [showLiveRoute, setShowLiveRoute] = useState(false);
  const [mapHeight, setMapHeight] = useState(340);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gettingDirections, setGettingDirections] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const refreshRef = useRef(null);

  const dependentName = user?.dependent?.name || "Your loved one";

  // Calculate live distance between Guardian and Wearer
  const wearerLat = Number(location?.latitude);
  const wearerLng = Number(location?.longitude);

  const guardianLat = Number(guardianLocation?.latitude);
  const guardianLng = Number(guardianLocation?.longitude);

  const hasValidCoordinates =
    location?.latitude != null &&
    location?.longitude != null &&
    guardianLocation?.latitude != null &&
    guardianLocation?.longitude != null &&
    Number.isFinite(wearerLat) &&
    Number.isFinite(wearerLng) &&
    Number.isFinite(guardianLat) &&
    Number.isFinite(guardianLng) &&
    Math.abs(wearerLat) <= 90 &&
    Math.abs(guardianLat) <= 90 &&
    Math.abs(wearerLng) <= 180 &&
    Math.abs(guardianLng) <= 180;

  const distanceMeters = hasValidCoordinates
    ? calculateDistanceMeters(
      guardianLat,
      guardianLng,
      wearerLat,
      wearerLng
    )
    : null;


  useFocusEffect(
    useCallback(() => {
      let active = true;
      let requestInProgress = false;

      const fetchLiveLocation = async () => {
        if (!user?._id) {
          console.log("SIGHTA LOCATION ERROR:", {
            status: "NO_USER_ID",
            message: "Guardian user ID is missing",
          });

          if (active) {
            setConnectionError(true);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        if (requestInProgress) return;

        requestInProgress = true;

        try {
          const data = await getCurrentLocation(user._id);

          if (active) {
            setLocation(data);
            setConnectionError(false);
          }
        } catch (error) {
          // DEBUGGING: Show API error in Expo terminal
          console.log("SIGHTA LOCATION ERROR:", {
            status: error?.response?.status || error?.status || "NO_STATUS",
            message: error?.message || "Unknown error",
            code: error?.code || "NO_CODE",
          });

          if (active) {
            setConnectionError(true);
          }
        } finally {
          requestInProgress = false;

          if (active) {
            setLoading(false);
            setRefreshing(false);
            setCurrentTime(Date.now());
          }
        }
      };

      refreshRef.current = fetchLiveLocation;

      // Fetch immediately
      fetchLiveLocation();

      // Automatically refresh every 5 seconds
      const interval = setInterval(
        fetchLiveLocation,
        REFRESH_INTERVAL
      );

      return () => {
        active = false;
        clearInterval(interval);
        refreshRef.current = null;
      };
    }, [user?._id])
  );


  // Automatically track Guardian's phone location
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let subscription = null;

      const startGuardianTracking = async () => {
        try {
          const { status } =
            await Location.requestForegroundPermissionsAsync();

          if (!active) return;

          if (status !== "granted") {
            console.log(
              "SIGHTA: Guardian location permission denied"
            );
            return;
          }

          const watcher = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 5000,
              distanceInterval: 3,
            },
            (position) => {
              if (!active) return;

              setGuardianLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            }
          );

          if (active) {
            subscription = watcher;
          } else {
            watcher.remove();
          }
        } catch (error) {
          console.log(
            "SIGHTA GUARDIAN GPS ERROR:",
            error?.message || error
          );
        }
      };

      startGuardianTracking();

      return () => {
        active = false;

        if (subscription) {
          subscription.remove();
        }
      };
    }, [])
  );

  // Refresh button function
  const handleRefresh = () => {
    if (!refreshRef.current) return;

    setRefreshing(true);
    refreshRef.current();
  };


  const recordedTime = location?.recordedAt
    ? new Date(location.recordedAt).getTime()
    : NaN;

  const locationAge = currentTime - recordedTime;

  const isLive =
    !!location &&
    Number.isFinite(recordedTime) &&
    locationAge >= 0 &&
    locationAge <= STALE_AFTER &&
    !connectionError;

  const statusText = connectionError
    ? location
      ? "Connection Issue - Last Known Location"
      : "Connection Issue - Location Unavailable"
    : isLive
      ? "Live Tracking Active"
      : location
        ? "Last Known Location"
        : "Waiting for GPS Location";

  const handleGetDirections = async () => {
    if (!location) {
      return Alert.alert(
        "No location yet",
        `We don't have a location for ${dependentName}.`
      );
    }

    setGettingDirections(true);

    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access to get directions."
        );
        return;
      }

      const current =
        await Location.getCurrentPositionAsync({});

      const originLat = current.coords.latitude;
      const originLng = current.coords.longitude;

      const url =
        `https://www.google.com/maps/dir/?api=1` +
        `&origin=${originLat},${originLng}` +
        `&destination=${location.latitude},${location.longitude}` +
        `&travelmode=driving`;

      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Couldn't open Maps",
          "No maps app is available."
        );
      }
    } catch (error) {
      Alert.alert(
        "Something went wrong",
        "Couldn't get directions. Please try again."
      );
    } finally {
      setGettingDirections(false);
    }
  };

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
        subtitle={`Live Location - ${dependentName}`}
      />

      <View
        style={styles.mapContainer}
        onLayout={(event) => {
          const availableHeight =
            event.nativeEvent.layout.height - spacing.margin;

          if (availableHeight > 0) {
            setMapHeight(Math.round(availableHeight));
          }
        }}
      >

        <MapPreview
          latitude={location?.latitude}
          longitude={location?.longitude}
          guardianLatitude={guardianLocation?.latitude}
          guardianLongitude={guardianLocation?.longitude}
          label={dependentName}
          height={mapHeight}
          showRoute={showLiveRoute}
        />

      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {dependentName}
            </Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isLive
                      ? colors.success
                      : colors.outline,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color: isLive
                      ? colors.success
                      : colors.onSurfaceVariant,
                  },
                ]}
              >
                {statusText}
              </Text>
            </View>
          </View>

          {location?.recordedAt ? (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.updatedLabel}>
                Last updated
              </Text>

              <Text style={styles.updatedTime}>
                {formatTime(location.recordedAt)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Live distance between Guardian and Wearer */}
        <View style={styles.liveDistanceContainer}>
          <Ionicons
            name="location-outline"
            size={22}
            color={colors.primary}
          />

          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.liveDistanceLabel}>
              Distance from wearer
            </Text>

            <Text style={styles.liveDistanceValue}>
              {distanceMeters !== null
                ? formatDistance(distanceMeters)
                : "Waiting for both GPS locations..."}
            </Text>

            <Text style={styles.liveDistanceNote}>
              {distanceMeters !== null
                ? isLive
                  ? "Live GPS distance - updates automatically"
                  : "Last known GPS distance"
                : "Enable Guardian GPS to see distance"}
            </Text>
          </View>
        </View>


        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { flex: 1 },
            ]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons
              name="refresh"
              size={18}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />

            <Text style={styles.secondaryButtonText}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              {
                flex: 1,
                marginLeft: spacing.sm,
              },
            ]}
            onPress={() => setShowLiveRoute((previous) => !previous)}
            disabled={gettingDirections || !location}
          >
            <Ionicons
              name="navigate"
              size={18}
              color={colors.onPrimary}
              style={{ marginRight: 8 }}
            />

            <Text style={styles.buttonText}>
              {gettingDirections
                ? "Locating..."
                : "Directions"}
            </Text>
          </TouchableOpacity>
        </View>



        {location && !isLive ? (
          <Text style={styles.warning}>
            Live GPS updates are not currently available.
            Showing the last received location.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    padding: spacing.margin,
    paddingBottom: 0,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.margin,
    shadowColor: "#000066",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  name: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  statusText: {
    ...typography.bodyMd,
    flexShrink: 1,
  },

  updatedLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },

  updatedTime: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },

  liveDistanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF3FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },

  liveDistanceLabel: {
    fontSize: 13,
    color: "#5F6B85",
    marginBottom: 3,
  },

  liveDistanceValue: {
    fontSize: 23,
    fontWeight: "bold",
    color: "#080D65",
  },

  liveDistanceNote: {
    fontSize: 11,
    color: "#5F6B85",
    marginTop: 3,
  },


  buttonRow: {
    flexDirection: "row",
    marginTop: spacing.md,
  },

  button: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    ...typography.labelLg,
    color: colors.onPrimary,
    fontSize: 15,
  },

  secondaryButton: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    ...typography.labelLg,
    color: colors.primary,
    fontSize: 15,
  },

  coords: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  warning: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
