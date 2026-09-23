import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "../components/Header";
import { colors, spacing, radius, typography } from "../theme/colors";

const FAQS = [
  {
    q: "Why does the Dashboard say my loved one is Offline?",
    a: "This means the SIGHTA glasses haven't synced with our servers recently, or the device hasn't been registered yet. Check that the glasses are powered on and connected to Wi-Fi/Bluetooth.",
  },
  {
    q: "How do I get directions to my loved one?",
    a: "Open the Tracking tab and tap the Directions button. This opens your phone's maps app with a route from your current location to their last known location.",
  },
  {
    q: "Will I be notified if there's an SOS while my phone is locked?",
    a: "Not yet — background push notifications are still being set up for this app. For now, SOS alerts appear when you open the app.",
  },
  {
    q: "How do I change my notification preferences?",
    a: "Go to Profile > Notifications, toggle the alert types you want, and tap Save Changes.",
  },
];

export default function HelpSupportScreen({ navigation }) {
  const handleEmailSupport = () => {
    Linking.openURL("mailto:sightaguardian@gmail.com?subject=SIGHTA Support Request");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Help & Support" showLogo={false} onMenuPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQS.map((item) => (
          <View key={item.q} style={styles.faqCard}>
            <Text style={styles.question}>{item.q}</Text>
            <Text style={styles.answer}>{item.a}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.contactButton} onPress={handleEmailSupport}>
          <Ionicons name="mail-outline" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
          <Text style={styles.contactButtonText}>Email Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.margin, paddingBottom: spacing.xl },
  sectionTitle: { ...typography.labelMd, color: colors.onSurfaceVariant, textTransform: "uppercase", marginBottom: spacing.sm },
  faqCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  question: { ...typography.labelLg, color: colors.onSurface, marginBottom: spacing.xs },
  answer: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 21 },
  contactButton: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  contactButtonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 16 },
});