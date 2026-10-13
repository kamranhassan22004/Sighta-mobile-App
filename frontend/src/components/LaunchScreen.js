
import React from "react";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
} from "react-native";

export default function LaunchScreen({
  progress = 0,
  message = "Starting SIGHTA Guardian...",
}) {
  const percentage = Math.max(
    0,
    Math.min(100, Math.round(progress))
  );

  return (
    <ImageBackground
      source={require("../../assets/sighta-loading.png")}
      style={styles.background}
      resizeMode="stretch"
    >
      <View style={styles.loadingArea}>
        <Text style={styles.loadingTitle}>
          Loading SIGHTA Guardian...
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${percentage}%` },
            ]}
          />
        </View>

        <Text style={styles.percentage}>
          {percentage}%
        </Text>

        <Text style={styles.status}>
          {message}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#030C2D",
  },
  loadingArea: {
    position: "absolute",
    top: "67%",
    left: 30,
    right: 30,
    alignItems: "center",
  },
  loadingTitle: {
    color: "#DDE8FF",
    fontSize: 19,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
  },
  progressTrack: {
    width: "85%",
    height: 9,
    borderRadius: 20,
    backgroundColor: "#203A65",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 20,
    backgroundColor: "#22D3F8",
  },
  percentage: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 13,
  },
  status: {
    color: "#A7BBE2",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
