import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme/colors";
import { isValidEmail } from "../utils/helpers";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      return Alert.alert("Invalid email", "Please enter a valid email address.");
    }
    if (!password) {
      return Alert.alert("Missing password", "Please enter your password.");
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      // AppNavigator takes over automatically once `user` is set in AuthContext
    } catch (error) {
      Alert.alert("Sign in failed", error.message || "Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo}>
            <Ionicons name="shield-checkmark" size={30} color={colors.onPrimary} />
          </View>

          <Text style={styles.brand}>SIGHTA Guardian</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to stay connected with your loved one.</Text>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter Your Email"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.outline}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={styles.forgotWrap} onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? "Signing In…" : "Sign In"}</Text>
            {!loading && <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} style={{ marginLeft: 8 }} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signupWrap} onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signupText}>
              Don't have an account? <Text style={styles.signupLink}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.margin },
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
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: { ...typography.headlineSm, color: colors.primary, marginBottom: spacing.lg },
  title: { ...typography.headlineMd, color: colors.onSurface, textAlign: "center" },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  label: { ...typography.labelLg, color: colors.onSurface, alignSelf: "flex-start", marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 12, ...typography.bodyMd, color: colors.onSurface },
  forgotWrap: { alignSelf: "flex-end", marginBottom: spacing.lg },
  forgotText: { ...typography.labelLg, color: colors.primary },
  button: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 16 },
  signupWrap: { marginTop: spacing.lg },
  signupText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  signupLink: { color: colors.primary, fontWeight: "700" },
});
