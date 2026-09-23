import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/colors";
import { formatTime, formatDate, alertTypeLabel } from "../utils/helpers";

const iconForType = (type) => {
  switch (type) {
    case "sos":
      return "warning";
    case "low_battery":
      return "battery-dead-outline";
    case "device_offline":
      return "cloud-offline-outline";
    case "fall_detected":
      return "alert-circle-outline";
    default:
      return "information-circle-outline";
  }
};

export default function AlertCard({ alert, onPress }) {
  const isSos = alert.type === "sos";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconWrap, isSos && styles.iconWrapDanger]}>
        <Ionicons
          name={iconForType(alert.type)}
          size={20}
          color={isSos ? colors.error : colors.primary}
        />
      </View>

      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <View style={styles.rowBetween}>
          <Text style={styles.type}>{alertTypeLabel(alert.type)}</Text>
          {!alert.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
        <Text style={styles.time}>
          {formatDate(alert.triggeredAt)} · {formatTime(alert.triggeredAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: { backgroundColor: colors.errorContainer },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  type: { ...typography.labelLg, color: colors.onSurface },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
  time: { ...typography.labelMd, color: colors.outline, marginTop: spacing.xs },
});
