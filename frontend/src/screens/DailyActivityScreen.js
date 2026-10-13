
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../api/axiosConfig";
import Header from "../components/Header";
import { colors, spacing, radius, typography } from "../theme/colors";

const todayPK = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const changeDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export default function DailyActivityScreen({ navigation }) {
  const [date, setDate] = useState(todayPK());
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    try {
      setError("");

      const response = await api.get("/daily-summary/activity", {
        params: { date },
      });

      setActivity(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load daily activity."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    setActivity(null);
    loadActivity();
  }, [loadActivity]);

  const refresh = () => {
    setRefreshing(true);
    loadActivity();
  };

  const lastLocation = activity?.lastLocation;

  // Generate recap using real API data
  const getDailyRecap = () => {
    if (!activity) {
      return "Daily activity is unavailable.";
    }

    const isToday = date === todayPK();
    const prefix = isToday ? "Today" : `On ${date}`;

    const gps = activity.gpsUpdates;
    const events = activity.deviceEvents ?? 0;
    const sos = activity.sosAlerts ?? 0;

    const eventText =
      `${events} device event${events === 1 ? "" : "s"}`;

    const sosText =
      sos === 0
        ? "no SOS alerts"
        : `${sos} SOS alert${sos === 1 ? "" : "s"}`;

    if (gps === null || gps === undefined) {
      return (
        `${prefix}, GPS history is unavailable. ` +
        `${eventText} and ${sosText} were recorded.`
      );
    }

    const gpsText =
      `${gps} GPS update${gps === 1 ? "" : "s"}`;

    return (
      `${prefix}, SIGHTA recorded ` +
      `${gpsText}, ${eventText}, and ${sosText}.`
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Daily Activity"
        showLogo={false}
        onMenuPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
      >
        <Text style={styles.heading}>
          SIGHTA Daily Activity
        </Text>

        <Text style={styles.subtitle}>
          Real GPS and device records
        </Text>

        {/* Date Navigation */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            onPress={() => setDate(changeDate(date, -1))}
            style={styles.arrow}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.dateText}>
            {date}
          </Text>

          <TouchableOpacity
            disabled={date >= todayPK()}
            onPress={() => setDate(changeDate(date, 1))}
            style={styles.arrow}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={
                date >= todayPK()
                  ? colors.outlineVariant
                  : colors.primary
              }
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.description}>
              {error}
            </Text>

            <TouchableOpacity onPress={refresh}>
              <Text style={styles.retry}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Activity Statistics */}
            <View style={styles.grid}>
              <StatCard
                icon="location-outline"
                title="GPS Updates"
                value={activity?.gpsUpdates}
              />

              <StatCard
                icon="warning-outline"
                title="SOS Alerts"
                value={activity?.sosAlerts}
              />

              <StatCard
                icon="pulse-outline"
                title="Device Events"
                value={activity?.deviceEvents}
              />
            </View>

            {/* Last Recorded Location */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons
                  name="navigate-outline"
                  size={19}
                  color={colors.primary}
                />{" "}
                Last Recorded Location
              </Text>

              {lastLocation ? (
                <>
                  <Text style={styles.description}>
                    Latitude: {lastLocation.latitude}
                  </Text>

                  <Text style={styles.description}>
                    Longitude: {lastLocation.longitude}
                  </Text>

                  {lastLocation.address ? (
                    <Text style={styles.description}>
                      {lastLocation.address}
                    </Text>
                  ) : null}

                  <Text style={styles.muted}>
                    Recorded:{" "}
                    {lastLocation.recordedAt
                      ? new Date(
                          lastLocation.recordedAt
                        ).toLocaleString()
                      : "Time unavailable"}
                  </Text>
                </>
              ) : (
                <Text style={styles.description}>
                  No GPS location recorded on this date.
                </Text>
              )}
            </View>

            {/* Daily Recap - Real Data */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={colors.primary}
                />{" "}
                Daily Recap
              </Text>

              <Text style={styles.description}>
                {getDailyRecap()}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <View style={styles.statCard}>
      <Ionicons
        name={icon}
        size={23}
        color={colors.primary}
      />

      <Text style={styles.statValue}>
        {value === null || value === undefined
          ? "—"
          : value}
      </Text>

      <Text style={styles.statLabel}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.margin,
    paddingBottom: spacing.xl,
  },

  heading: {
    ...typography.titleLg,
    color: colors.onSurface,
  },

  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 5,
    marginBottom: 20,
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 18,
  },

  arrow: {
    padding: 8,
  },

  dateText: {
    ...typography.labelLg,
    color: colors.onSurface,
  },

  grid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: "center",
  },

  statValue: {
    fontSize: 25,
    fontWeight: "bold",
    color: colors.onSurface,
    marginTop: 8,
  },

  statLabel: {
    fontSize: 11,
    textAlign: "center",
    color: colors.onSurfaceVariant,
    marginTop: 5,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  cardTitle: {
    ...typography.titleMd,
    color: colors.onSurface,
    marginBottom: 12,
  },

  description: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },

  muted: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 12,
  },

  retry: {
    color: colors.primary,
    fontWeight: "bold",
    marginTop: 12,
  },
});
