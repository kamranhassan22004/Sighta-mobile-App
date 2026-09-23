import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/colors";
import * as authService from "../services/authService";

export default function VerifyCodeScreen({ navigation, route }) {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      return Alert.alert("Invalid code", "Please enter the 6-digit code sent to your email.");
    }
    setLoading(true);
    try {
      const data = await authService.verifyResetCode(email, code);
      navigation.navigate("ResetPassword", { resetToken: data.resetToken });
    } catch (error) {
      Alert.alert("Verification failed", error.message || "Please check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.forgotPassword(email);
      Alert.alert("Code sent", "A new code has been sent to your email.");
    } catch (error) {
      Alert.alert("Something went wrong", error.message || "Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.onPrimary} />
          </View>

          <Text style={styles.title}>Enter Code</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to{"\n"}{email}</Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={colors.outline}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
          </View>

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleVerify} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Verifying…" : "Verify Code"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendWrap} onPress={handleResend} disabled={resending}>
            <Text style={styles.resendText}>
              {resending ? "Resending…" : "Didn't get it? "}
              {!resending && <Text style={styles.resendLink}>Resend Code</Text>}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.margin },
  backBtn: { position: "absolute", top: spacing.xl, left: spacing.margin, zIndex: 1 },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000066",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.headlineMd, color: colors.onSurface, textAlign: "center" },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg },
  inputWrap: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: spacing.lg,
  },
  codeInput: {
    paddingVertical: 16,
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  button: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 16 },
  resendWrap: { marginTop: spacing.lg },
  resendText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  resendLink: { color: colors.primary, fontWeight: "700" },
});