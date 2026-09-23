import React, { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import AlertCard from "../components/AlertCard";
import Loader from "../components/Loader";
import { colors, spacing, radius, typography } from "../theme/colors";
import { getAlerts, markAlertRead } from "../services/alertService";

export default function AlertScreen({ navigation }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?._id) return;
    try {
      const data = await getAlerts(user._id);
      setAlerts(data);
    } catch (e) {
      // Keep whatever was previously loaded; empty state handles first-run
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePress = async (alert) => {
    if (!alert.isRead) {
      try {
        await markAlertRead(alert._id);
        setAlerts((prev) => prev.map((a) => (a._id === alert._id ? { ...a, isRead: true } : a)));
      } catch (e) {
        // Non-critical — user can still view the alert
      }
    }
    if (alert.type === "sos") {
      navigation.navigate("Tracking");
    }
  };

  if (loading) return <Loader />;

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="SIGHTA Guardian" />

      <View style={styles.headerBlock}>
        <Text style={styles.title}>Alerts</Text>
        <Text style={styles.subtitle}>Stay informed about important events.</Text>

        {unreadCount > 0 && (
          <View style={styles.newBanner}>
            <View style={styles.newDot} />
            <Text style={styles.newBannerText}>{unreadCount} New Alert{unreadCount > 1 ? "s" : ""}</Text>
          </View>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.outline} />
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyText}>You'll see SOS, battery, and device alerts here as they happen.</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AlertCard alert={item} onPress={() => handlePress(item)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: { padding: spacing.margin, paddingBottom: spacing.sm },
  title: { ...typography.headlineLg, color: colors.onSurface },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2, marginBottom: spacing.md },
  newBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.errorContainer,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginRight: spacing.sm },
  newBannerText: { ...typography.labelLg, color: colors.onErrorContainer, fontWeight: "700" },
  list: { paddingHorizontal: spacing.margin, paddingBottom: spacing.xl },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyTitle: { ...typography.headlineSm, color: colors.onSurface, marginTop: spacing.md },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.xs },
});