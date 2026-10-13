import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import * as devices from "../services/deviceService";
import { colors } from "../theme/colors";

export default function DeviceSharing({ styles }) {
  const { user, refreshProfile } = useAuth();
  const [sharing, setSharing] = useState({ owned: [], invitations: [] });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const data = await devices.getDeviceSharing();
    setSharing(data);
    setError("");
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    devices.getDeviceSharing().then(data => { if (active) { setSharing(data); setError(""); } })
      .catch(() => { if (active) setError("Unable to load device sharing."); });
    return () => { active = false; };
  }, [user?._id, load]));

  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await refreshProfile(); await load(); }
    catch (failure) { Alert.alert("Device Sharing", failure.message || "Please try again."); }
    finally { setBusy(false); }
  };
  const button = (label, action, key) => (
    <TouchableOpacity key={key} style={[styles.editButton, busy && styles.disabledButton]}
      disabled={busy} onPress={() => run(action)}>
      <Text style={styles.editButtonText}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View>
      {error ? <Text style={styles.helperText}>{error}</Text> : null}
      {sharing.owned.map(device => (
        <View key={device._id}>
          <Text style={styles.infoValue}>{device.deviceId}</Text>
          <Text style={styles.helperText}>Invite a guardian using their registered email.</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="Guardian email" placeholderTextColor={colors.onSurfaceVariant}
            keyboardType="email-address" autoCapitalize="none" editable={!busy} />
          {button("Invite Guardian", async () => {
            await devices.inviteGuardian(device.deviceId, email.trim());
            setEmail("");
            Alert.alert("Invitation Sent", "The guardian can accept from their Profile screen.");
          })}
          {device.guardians.map(guardian => (
            <View key={guardian._id}>
              <Text style={styles.infoValue}>{guardian.email} ({guardian.status === "accepted" ? "Authorized" : "Invited"})</Text>
              <TouchableOpacity style={styles.menuRow} disabled={busy} onPress={() => Alert.alert(
                "Revoke Access", "Remove this guardian's access and pending invitation?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Revoke", style: "destructive", onPress: () => run(() => devices.revokeGuardian(device.deviceId, guardian._id)) },
                ])}>
                <Text style={[styles.menuLabel, { color: colors.error }]}>Revoke Access</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
      {sharing.invitations.map(invitation => (
        <View key={invitation._id}>
          <Text style={styles.infoValue}>Invitation: {invitation.deviceId}</Text>
          {button("Accept Device Invitation", () => devices.acceptDeviceInvitation(invitation._id))}
        </View>
      ))}
      {!error && !sharing.owned.length && !sharing.invitations.length ? (
        <Text style={styles.helperText}>{user?.device ? "Device access is managed by the primary owner." : "Ask the device owner to invite your registered email."}</Text>
      ) : null}
    </View>
  );
}
