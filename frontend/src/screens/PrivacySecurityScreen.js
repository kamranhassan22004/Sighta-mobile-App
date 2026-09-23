import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import { colors, spacing, radius, typography } from "../theme/colors";

const SECTIONS = [
  {
    icon: "lock-closed-outline",
    title: "How your data is protected",
    body:
      "Your password is never stored in plain text — it's hashed using bcrypt before it touches our database. All communication between the app and our servers uses secure token-based authentication (JWT), so your session can't be hijacked by simply intercepting a request.",
  },
  {
    icon: "location-outline",
    title: "Location data",
    body:
      "Location updates from the SIGHTA glasses are only visible to the guardian account linked to that device. We do not share, sell, or use location data for any purpose other than displaying it to you in this app.",
  },
  {
    icon: "eye-off-outline",
    title: "Who can see this account",
    body:
      "Only you can access your guardian dashboard, alerts, and history. Each guardian account is isolated — no other user of SIGHTA Guardian can view your dependent's data.",
  },
  {
    icon: "trash-outline",
    title: "Deleting your data",
    body:
      "To request full deletion of your account and all associated data, contact our support team via the Help & Support screen. Deletion requests are processed within a reasonable timeframe.",
  },
];

export default function PrivacySecurityScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Privacy & Security" showLogo={false} onMenuPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name={section.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.margin, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.labelLg, color: colors.onSurface, marginBottom: spacing.xs },
  cardBody: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
});