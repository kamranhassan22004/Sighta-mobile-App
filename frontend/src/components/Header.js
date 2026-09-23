import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../theme/colors";

export default function Header({ title, subtitle, onBellPress, onMenuPress, showLogo = true }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {onMenuPress ? (
            <TouchableOpacity onPress={onMenuPress} hitSlop={10}>
              <Ionicons name="person-circle-outline" size={26} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : showLogo ? (
            <View style={styles.logoBadge}>
              <Image source={require("../../assets/logo-header.jpeg")} style={styles.logo} resizeMode="contain" />
            </View>
          ) : null}
        </View>

        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.side}>
          {onBellPress ? (
            <TouchableOpacity onPress={onBellPress} hitSlop={10}>
              <Ionicons name="notifications-outline" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 40, alignItems: "center" },
  center: { flex: 1, alignItems: "center" },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 3,
  },
  logo: { width: "100%", height: "100%" },
  title: { ...typography.headlineSm, color: colors.onPrimary },
  subtitle: { ...typography.labelMd, color: colors.primaryFixedDim, marginTop: 2 },
});