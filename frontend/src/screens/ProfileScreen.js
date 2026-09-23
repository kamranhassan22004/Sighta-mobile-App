import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import { colors, spacing, radius, typography } from "../theme/colors";

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Profile" showLogo={false} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.onPrimary} />
          </View>
          <Text style={styles.name}>{user?.name || "Guardian"}</Text>
          <Text style={styles.role}>Primary Caregiver</Text>
        </View>

        <Section title="Contact Information">
          <InfoRow icon="mail-outline" label="Email" value={user?.email || "—"} />
          <InfoRow icon="call-outline" label="Phone" value={user?.phone || "Not set"} />
          <InfoRow icon="people-outline" label="Relationship" value={user?.dependent?.relationship || "Not set"} />
        </Section>

        <Section title="My SIGHTA User">
          <View style={styles.dependentCard}>
            <View style={styles.dependentAvatar}>
              <Ionicons name="glasses-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.dependentName}>{user?.dependent?.name || "Not linked yet"}</Text>
              <Text style={styles.dependentSub}>Device: SIGHTA Glasses</Text>
            </View>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedBadgeText}>{user?.device ? "Connected" : "Not linked"}</Text>
            </View>
          </View>
        </Section>

        <View style={styles.menu}>
          <MenuRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate("NotificationSettings")} />
          <MenuRow icon="lock-closed-outline" label="Privacy & Security" onPress={() => navigation.navigate("PrivacySecurity")} />
          <MenuRow icon="help-circle-outline" label="Help & Support" onPress={() => navigation.navigate("HelpSupport")} />
          <MenuRow icon="log-out-outline" label="Logout" onPress={handleLogout} danger />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceVariant} style={{ width: 26 }} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.onSurface} style={{ width: 28 }} />
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.outline} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.margin, paddingBottom: spacing.xl },
  profileHeader: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    borderWidth: 3,
    borderColor: colors.secondaryContainer,
  },
  name: { ...typography.headlineSm, color: colors.onSurface },
  role: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.labelMd, color: colors.onSurfaceVariant, textTransform: "uppercase", marginBottom: spacing.sm },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoLabel: { ...typography.labelMd, color: colors.onSurfaceVariant },
  infoValue: { ...typography.bodyMd, color: colors.onSurface },
  dependentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  dependentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  dependentName: { ...typography.labelLg, color: colors.onSurface },
  dependentSub: { ...typography.labelMd, color: colors.onSurfaceVariant },
  connectedBadge: { backgroundColor: colors.secondaryContainer, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  connectedBadgeText: { ...typography.labelMd, color: colors.onSecondaryContainer, fontWeight: "700" },
  menu: { backgroundColor: colors.surfaceContainerLowest, borderRadius: radius.lg, overflow: "hidden" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  menuLabel: { flex: 1, ...typography.bodyMd, color: colors.onSurface },
});