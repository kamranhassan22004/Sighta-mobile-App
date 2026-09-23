import React, { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Loader from "../components/Loader";
import { colors, spacing, radius, typography } from "../theme/colors";
import { getAlerts } from "../services/alertService";
import { getLocationHistory } from "../services/locationService";
import { formatTime, formatDate, alertTypeLabel } from "../utils/helpers";

const FILTERS = ["All", "Alerts", "Location", "Device"];

const iconForType = (type) => {
  switch (type) {
    case "sos":
      return { name: "warning", color: colors.error };
    case "location":
      return { name: "location", color: colors.primary };
    case "low_battery":
      return { name: "battery-half", color: "#d48700" };
    case "device_offline":
    case "device_online":
      return { name: "wifi", color: colors.success };
    default:
      return { name: "information-circle", color: colors.onSurfaceVariant };
  }
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");

  const load = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [alertsResult, locationResult] = await Promise.allSettled([
        getAlerts(user._id, 1, 30),
        getLocationHistory(user._id, 1, 15),
      ]);

      const alertItems =
        alertsResult.status === "fulfilled"
          ? alertsResult.value.map((a) => ({
              id: a._id,
              category: "Alerts",
              type: a.type,
              title: alertTypeLabel(a.type),
              description: a.message,
              time: a.triggeredAt,
            }))
          : [];

      const locationItems =
        locationResult.status === "fulfilled"
          ? locationResult.value.map((l) => ({
              id: l._id,
              category: "Location",
              type: "location",
              title: "Location Updated",
              description: l.address || `${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}`,
              time: l.recordedAt,
            }))
          : [];

      const merged = [...alertItems, ...locationItems].sort(
        (a, b) => new Date(b.time) - new Date(a.time)
      );
      setItems(merged);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    if (activeFilter === "All") return items;
    if (activeFilter === "Device") {
      return items.filter((i) => i.type === "low_battery" || i.type === "device_offline" || i.type === "device_online");
    }
    return items.filter((i) => i.category === activeFilter);
  }, [items, activeFilter]);

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="SIGHTA Guardian" />

      <View style={styles.headerBlock}>
        <Text style={styles.title}>Activity History</Text>
        <Text style={styles.subtitle}>Recent SIGHTA activity</Text>

        <View style={styles.chipsRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, activeFilter === f && styles.chipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={48} color={colors.outline} />
          <Text style={styles.emptyText}>Nothing to show for this filter yet.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const icon = iconForType(item.type);
            const isLast = index === filtered.length - 1;
            return (
              <View style={styles.row}>
                <View style={styles.timelineCol}>
                  <View style={[styles.iconCircle, { backgroundColor: icon.color + "22" }]}>
                    <Ionicons name={icon.name} size={16} color={icon.color} />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemTime}>{formatTime(item.time)}</Text>
                  </View>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                  <Text style={styles.itemDate}>{formatDate(item.time)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: { padding: spacing.margin, paddingBottom: spacing.sm },
  title: { ...typography.headlineLg, color: colors.onSurface },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2, marginBottom: spacing.md },
  chipsRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.labelLg, color: colors.onSurface },
  chipTextActive: { color: colors.onPrimary },
  list: { paddingHorizontal: spacing.margin, paddingBottom: spacing.xl },
  row: { flexDirection: "row" },
  timelineCol: { alignItems: "center", width: 40 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.outlineVariant, marginVertical: 4 },
  itemCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between" },
  itemTitle: { ...typography.labelLg, color: colors.onSurface },
  itemTime: { ...typography.labelMd, color: colors.onSurfaceVariant },
  itemDesc: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
  itemDate: { ...typography.labelMd, color: colors.outline, marginTop: spacing.xs },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.sm },
});