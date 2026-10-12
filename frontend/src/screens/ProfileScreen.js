
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/authService";

import Header from "../components/Header";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../theme/colors";

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshProfile } = useAuth();
  // Device linked hona aur device online hona alag cheezein hain.
  const isDeviceLinked = Boolean(user?.device);

  // Agar device linked hai lekin SIGHTA user ka naam
  // database mein nahi hai, toh misleading "Not linked yet"
  // nahi dikhayenge.
  const sightaUserName = isDeviceLinked
    ? user?.dependent?.name?.trim() || "SIGHTA User"
    : "Not linked yet";
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [relationship, setRelationship] = useState(
    user?.dependent?.relationship || ""
  );

  useEffect(() => {
    if (!isEditing) {
      setName(user?.name || "");
      setPhone(user?.phone || "");
      setRelationship(
        user?.dependent?.relationship || ""
      );
    }
  }, [
    user?.name,
    user?.phone,
    user?.dependent?.relationship,
    isEditing,
  ]);

  const handleEdit = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setRelationship(
      user?.dependent?.relationship || ""
    );
    setIsEditing(true);
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setRelationship(
      user?.dependent?.relationship || ""
    );
    setIsEditing(false);
  };

  const handleSave = async () => {
    const cleanedName = name.trim();
    const cleanedPhone = phone.trim();
    const cleanedRelationship = relationship.trim();

    if (!cleanedName) {
      Alert.alert("Error", "Please enter your name.");
      return;
    }

    if (
      cleanedPhone &&
      !/^\+?[0-9\s()-]{7,20}$/.test(cleanedPhone)
    ) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid phone number."
      );
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      await updateProfile({
        name: cleanedName,
        phone: cleanedPhone,
        dependent: {
          relationship: cleanedRelationship,
        },
      });

      await refreshProfile();

      setIsEditing(false);

      Alert.alert(
        "Success",
        "Your profile has been updated successfully."
      );
    } catch (error) {
      console.log(
        "PROFILE UPDATE ERROR:",
        error?.response?.data?.message ||
        error?.message ||
        error
      );

      Alert.alert(
        "Update Failed",
        error?.response?.data?.message ||
        "Unable to update profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: logout,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Profile" showLogo={false} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons
              name="person"
              size={32}
              color={colors.onPrimary}
            />
          </View>

          <Text style={styles.name}>
            {user?.name || "Guardian"}
          </Text>

          <Text style={styles.role}>
            Primary Caregiver
          </Text>
        </View>

        {/* Contact Information */}
        <Section title="Contact Information">
          {isEditing ? (
            <>
              {/* Full Name */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>
                  Full Name
                </Text>

                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor={
                    colors.onSurfaceVariant
                  }
                  autoCapitalize="words"
                  editable={!saving}
                />
              </View>

              {/* Email is read-only */}
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={user?.email || "Not set"}
              />

              {/* Phone Number */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>
                  Phone Number
                </Text>

                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+923001234567"
                  placeholderTextColor={
                    colors.onSurfaceVariant
                  }
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  editable={!saving}
                  maxLength={20}
                />

                <Text style={styles.helperText}>
                  Include your country code if possible.
                </Text>
              </View>

              {/* Relationship */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>
                  Relationship with SIGHTA User
                </Text>

                <TextInput
                  style={styles.input}
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="e.g. Mother, Father, Sister"
                  placeholderTextColor={
                    colors.onSurfaceVariant
                  }
                  autoCapitalize="words"
                  editable={!saving}
                  maxLength={50}
                />

                <Text style={styles.helperText}>
                  Your relationship with the person
                  using SIGHTA Glasses.
                </Text>
              </View>

              {/* Save / Cancel */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator
                      color={colors.onPrimary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-outline"
                        size={18}
                        color={colors.onPrimary}
                      />

                      <Text style={styles.saveText}>
                        Save Changes
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <InfoRow
                icon="person-outline"
                label="Full Name"
                value={user?.name || "Not set"}
              />

              <InfoRow
                icon="mail-outline"
                label="Email"
                value={user?.email || "Not set"}
              />

              <InfoRow
                icon="call-outline"
                label="Phone"
                value={user?.phone || "Not set"}
              />

              <InfoRow
                icon="people-outline"
                label="Relationship"
                value={
                  user?.dependent?.relationship ||
                  "Not set"
                }
              />

              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEdit}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.onPrimary}
                />

                <Text style={styles.editButtonText}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Section>
        
        {/* My SIGHTA User */}
        <Section title="My SIGHTA User">
          <View style={styles.dependentCard}>
            <View style={styles.dependentAvatar}>
              <Ionicons
                name="glasses-outline"
                size={22}
                color={colors.primary}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: spacing.sm,
              }}
            >
              <Text style={styles.dependentName}>
                {sightaUserName}
              </Text>

              <Text style={styles.dependentSub}>
                {isDeviceLinked
                  ? "Device: SIGHTA Glasses"
                  : "No SIGHTA device linked"}
              </Text>
            </View>

            <View style={styles.connectedBadge}>
              <Text style={styles.connectedBadgeText}>
                {isDeviceLinked ? "Linked" : "Not linked"}
              </Text>
            </View>
          </View>
        </Section>

        {/* Profile Menu */}
        <View style={styles.menu}>
          <MenuRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() =>
              navigation.navigate(
                "NotificationSettings"
              )
            }
          />

          <MenuRow
            icon="lock-closed-outline"
            label="Privacy & Security"
            onPress={() =>
              navigation.navigate(
                "PrivacySecurity"
              )
            }
          />

          <MenuRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() =>
              navigation.navigate(
                "HelpSupport"
              )
            }
          />

          <MenuRow
            icon="log-out-outline"
            label="Logout"
            onPress={handleLogout}
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.onSurfaceVariant}
        style={{ width: 26 }}
      />

      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>
        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          danger
            ? colors.error
            : colors.onSurface
        }
        style={{ width: 28 }}
      />

      <Text
        style={[
          styles.menuLabel,
          danger && {
            color: colors.error,
          },
        ]}
      >
        {label}
      </Text>

      {!danger && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.outline}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.margin,
    paddingBottom: spacing.xl,
  },

  profileHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },

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

  name: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },

  role: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },

  section: {
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },

  infoLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },

  infoValue: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },

  inputCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },

  inputLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },

  input: {
    ...typography.bodyMd,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },

  helperText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },

  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 8,
  },

  editButtonText: {
    ...typography.labelLg,
    color: colors.onPrimary,
  },

  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },

  cancelText: {
    ...typography.labelLg,
    color: colors.onSurface,
  },

  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 6,
  },

  saveText: {
    ...typography.labelLg,
    color: colors.onPrimary,
  },

  disabledButton: {
    opacity: 0.6,
  },

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

  dependentName: {
    ...typography.labelLg,
    color: colors.onSurface,
  },

  dependentSub: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },

  connectedBadge: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },

  connectedBadgeText: {
    ...typography.labelMd,
    color: colors.onSecondaryContainer,
    fontWeight: "700",
  },

  menu: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },

  menuLabel: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
});
