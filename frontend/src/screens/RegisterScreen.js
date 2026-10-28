import React, { useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, typography } from "../theme/colors";
import { isValidEmail } from "../utils/helpers";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const requestLock = useRef(false);

  const handleRegister = async () => {
    if (requestLock.current || googleBusy) return;
    if (!name.trim()) return Alert.alert("Missing name", "Please enter your full name.");
    if (!isValidEmail(email)) return Alert.alert("Invalid email", "Please enter a valid email address.");
    if (password.length < 6) return Alert.alert("Weak password", "Password must be at least 6 characters.");
    if (password !== confirmPassword) return Alert.alert("Passwords don't match", "Please re-check your password.");

    requestLock.current = true;
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() });
    } catch (error) {
      Alert.alert("Registration failed", error.message || "Please try again.");
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>Set up your SIGHTA Guardian account.</Text>

        <Field icon="person-outline" label="Full Name" value={name} onChangeText={setName} placeholder="Enter Your Name" />
        <Field icon="mail-outline" label="Email" value={email} onChangeText={setEmail} placeholder="Enter Your Email" keyboardType="email-address" autoCapitalize="none" />
        <Field icon="call-outline" label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+92 0000 000000" keyboardType="phone-pad" />
        <Field icon="lock-closed-outline" label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
        <Field icon="lock-closed-outline" label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry />

        <TouchableOpacity
          style={[styles.button, (loading || googleBusy) && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading || googleBusy}
        >
          <Text style={styles.buttonText}>{loading ? "Creating Account…" : "Create Account"}</Text>
        </TouchableOpacity>

        <GoogleAuthButton disabled={loading} onBusyChange={setGoogleBusy} />

        <TouchableOpacity style={styles.signinWrap} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.signinText}>
            Already have an account? <Text style={styles.signinLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, label, ...inputProps }) {
  return (
    <View style={{ width: "100%" }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={18} color={colors.onSurfaceVariant} style={styles.inputIcon} />
        <TextInput style={styles.input} placeholderTextColor={colors.outline} {...inputProps} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: spacing.margin, paddingTop: spacing.xl, alignItems: "center" },
  backBtn: { alignSelf: "flex-start", marginBottom: spacing.md },
  title: { ...typography.headlineMd, color: colors.primary, textAlign: "center" },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginBottom: spacing.lg },
  label: { ...typography.labelLg, color: colors.onSurface, marginBottom: spacing.xs, marginTop: spacing.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.sm,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, paddingVertical: 12, ...typography.bodyMd, color: colors.onSurface },
  button: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonText: { ...typography.labelLg, color: colors.onPrimary, fontSize: 16 },
  signinWrap: { marginTop: spacing.lg, marginBottom: spacing.lg },
  signinText: { textAlign: "center", ...typography.bodyMd, color: colors.onSurfaceVariant },
  signinLink: { color: colors.primary, fontWeight: "700" },
});
