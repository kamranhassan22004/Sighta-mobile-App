import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import { getGoogleIdentityToken } from "../services/googleSignIn";
import { colors, spacing, radius, typography } from "../theme/colors";

export default function GoogleAuthButton({ disabled, onBusyChange }) {
  const { loginWithGoogle } = useAuth();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (disabled || locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const token = await getGoogleIdentityToken();
      if (token) await loginWithGoogle(token);
    } catch (error) {
      Alert.alert("Google sign-in", error.message || "Please try again.");
    } finally {
      locked.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return <View style={styles.section}>
    <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or continue with</Text><View style={styles.line} /></View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
      onPress={signIn} activeOpacity={0.7} style={[styles.button, (disabled || busy) && styles.disabled]}>
      <View style={styles.icon} accessible={false} importantForAccessibility="no-hide-descendants">
        {busy ? <ActivityIndicator color={colors.primary} size="small" /> : <Svg width={20} height={20} viewBox="0 0 48 48">
          <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.88 46.98 24.55z" />
          <Path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z" />
          <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </Svg>}
      </View>
      <Text style={styles.text}>Continue with Google</Text><View style={styles.balance} />
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  section: { width: "100%" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  or: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginHorizontal: spacing.sm },
  button: { width: "100%", minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.outlineVariant,
    borderRadius: radius.lg, backgroundColor: "#FFFFFF" },
  icon: { width: 24, alignItems: "center", justifyContent: "center" },
  balance: { width: 24 },
  text: { ...typography.labelLg, fontSize: 16, color: "#1F1F1F", textAlign: "center", flex: 1, marginHorizontal: 8 },
  disabled: { opacity: 0.6 },
});
