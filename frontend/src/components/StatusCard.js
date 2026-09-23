import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/colors";

export default function StatusCard({ label, value, caption, icon, badge, badgeTone = "success" }) {
  const badgeColors =
    badgeTone === "success"
      ? { bg: colors.secondaryContainer, text: colors.onSecondaryContainer }
      : { bg: colors.errorContainer, text: colors.error };

  const accentColor = badgeTone === "success" ? colors.secondary : badge ? colors.error : colors.primary;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.text }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.valueRow}>
        {icon ? (
          <View style={[styles.iconCircle, { backgroundColor: accentColor + "1f" }]}>
            <Ionicons name={icon} size={20} color={accentColor} />
          </View>
        ) : null}
        <Text style={styles.value}>{value}</Text>
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    shadowColor: "#000066",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 0.5, textTransform: "uppercase" },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { ...typography.labelMd, fontWeight: "700" },
  valueRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.base },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.base,
  },
  value: { ...typography.headlineMd, color: colors.onSurface },
  caption: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
});