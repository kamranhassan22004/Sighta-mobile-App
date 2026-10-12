
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";

import { WebView } from "react-native-webview";
import { colors, radius, typography } from "../theme/colors";

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1"
  />

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />

  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
    }

    body {
      background: #e8eef7;
      font-family: Arial, sans-serif;
    }

    .legend {
      position: absolute;
      z-index: 1000;
      bottom: 25px;
      left: 10px;
      background: white;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      box-shadow: 0 1px 5px #999;
    }

    .legend-row {
      margin-bottom: 5px;
    }

    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 5px;
    }

    #routeStatus {
      display: none;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #333;
      max-width: 180px;
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <div class="legend">
    <div class="legend-row">
      <span class="dot" style="background:#1976D2"></span>
      SIGHTA Wearer
    </div>

    <div class="legend-row">
      <span class="dot" style="background:#16A34A"></span>
      Guardian
    </div>

    <div id="routeStatus"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    const map = L.map("map").setView([0, 0], 2);

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(map);

    let wearerMarker = null;
    let guardianMarker = null;

    let routeLayer = null;
    let routeEnabled = false;

    let lastRouteTime = 0;
    let lastRoutePoints = null;
    let routeRequestInProgress = false;
    let routeRequestVersion = 0;

    const ROUTE_INTERVAL = 15000;
    const MIN_MOVEMENT_METERS = 15;

    function setRouteStatus(message) {
      const element = document.getElementById("routeStatus");

      if (!routeEnabled) {
        element.style.display = "none";
        return;
      }

      element.style.display = "block";
      element.textContent = message;
    }

    function clearRoute() {
      if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
    }

    function updateCamera() {
      const points = [];

      if (wearerMarker) {
        points.push(wearerMarker.getLatLng());
      }

      if (guardianMarker) {
        points.push(guardianMarker.getLatLng());
      }

      if (
        routeEnabled &&
        routeLayer &&
        typeof routeLayer.getBounds === "function"
      ) {
        const routeBounds = routeLayer.getBounds();

        if (routeBounds.isValid()) {
          map.fitBounds(routeBounds, {
            padding: [45, 45],
            maxZoom: 17,
            animate: true
          });
          return;
        }
      }

      if (points.length === 2) {
        map.fitBounds(L.latLngBounds(points), {
          padding: [45, 45],
          maxZoom: 17,
          animate: true
        });
      } else if (points.length === 1) {
        map.setView(points[0], 17, {
          animate: true
        });
      }
    }

    function drawDirectLine(message) {
      if (!wearerMarker || !guardianMarker) return;

      clearRoute();

      routeLayer = L.polyline(
        [
          guardianMarker.getLatLng(),
          wearerMarker.getLatLng()
        ],
        {
          color: "#2563EB",
          weight: 4,
          opacity: 0.85,
          dashArray: "6, 8"
        }
      ).addTo(map);

      setRouteStatus(message);
      updateCamera();
    }

    function maybeUpdateRoute() {
      if (!routeEnabled) return;
      if (!wearerMarker || !guardianMarker) return;

      const wearer = wearerMarker.getLatLng();
      const guardian = guardianMarker.getLatLng();

      const distance = guardian.distanceTo(wearer);

      // If both people are very close, show a direct line.
      if (distance < 25) {
        routeRequestVersion++;
        lastRoutePoints = null;

        drawDirectLine(
          "Nearby - direct line"
        );
        return;
      }

      if (routeRequestInProgress) return;

      const now = Date.now();

      const currentPoints = {
        wearerLat: wearer.lat,
        wearerLng: wearer.lng,
        guardianLat: guardian.lat,
        guardianLng: guardian.lng
      };

      let movedEnough = true;

      if (lastRoutePoints) {
        const oldWearer = L.latLng(
          lastRoutePoints.wearerLat,
          lastRoutePoints.wearerLng
        );

        const oldGuardian = L.latLng(
          lastRoutePoints.guardianLat,
          lastRoutePoints.guardianLng
        );

        movedEnough =
          oldWearer.distanceTo(wearer) >= MIN_MOVEMENT_METERS ||
          oldGuardian.distanceTo(guardian) >= MIN_MOVEMENT_METERS;
      }

      if (!movedEnough && routeLayer) return;

      if (now - lastRouteTime < ROUTE_INTERVAL) return;

      lastRouteTime = now;
      lastRoutePoints = currentPoints;
      routeRequestInProgress = true;

      const requestVersion = ++routeRequestVersion;

      setRouteStatus("Updating live route...");

      const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        guardian.lng + "," + guardian.lat + ";" +
        wearer.lng + "," + wearer.lat +
        "?overview=full&geometries=geojson";

      fetch(url)
        .then(function(response) {
          if (!response.ok) {
            throw new Error("Routing service unavailable");
          }

          return response.json();
        })
        .then(function(data) {
          if (
            !routeEnabled ||
            requestVersion !== routeRequestVersion
          ) {
            return;
          }

          if (
            !data.routes ||
            data.routes.length === 0 ||
            !data.routes[0].geometry
          ) {
            throw new Error("No road route found");
          }

          const route = data.routes[0];

          clearRoute();

          routeLayer = L.geoJSON(
            route.geometry,
            {
              style: {
                color: "#2563EB",
                weight: 6,
                opacity: 0.85
              }
            }
          ).addTo(map);

          const distanceKm = route.distance / 1000;

          const distanceText =
            distanceKm < 1
              ? Math.round(route.distance) + " m"
              : distanceKm.toFixed(2) + " km";

          setRouteStatus(
            "Live road route - " + distanceText
          );

          updateCamera();
        })
        .catch(function(error) {
          if (
            !routeEnabled ||
            requestVersion !== routeRequestVersion
          ) {
            return;
          }

          console.log("SIGHTA ROUTE ERROR:", error);

          lastRoutePoints = null;

          drawDirectLine(
            "Road route unavailable - direct line only"
          );
        })
        .finally(function() {
          routeRequestInProgress = false;
        });
    }

    window.updateWearerLocation = function(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      if (!wearerMarker) {
        wearerMarker = L.circleMarker([lat, lng], {
          radius: 10,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#1976D2",
          fillOpacity: 1
        }).addTo(map);

        wearerMarker.bindPopup("SIGHTA Wearer");
      } else {
        wearerMarker.setLatLng([lat, lng]);
      }

      updateCamera();
      maybeUpdateRoute();
    };

    window.updateGuardianLocation = function(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      if (!guardianMarker) {
        guardianMarker = L.circleMarker([lat, lng], {
          radius: 10,
          color: "#FFFFFF",
          weight: 3,
          fillColor: "#16A34A",
          fillOpacity: 1
        }).addTo(map);

        guardianMarker.bindPopup("Guardian - You");
      } else {
        guardianMarker.setLatLng([lat, lng]);
      }

      updateCamera();
      maybeUpdateRoute();
    };

    window.setRouteEnabled = function(enabled) {
      const nextValue = Boolean(enabled);

      if (routeEnabled === nextValue) return;

      routeEnabled = nextValue;

      if (!routeEnabled) {
        routeRequestVersion++;
        clearRoute();
        setRouteStatus("");
        updateCamera();
        return;
      }

      lastRouteTime = 0;
      lastRoutePoints = null;

      setRouteStatus("Finding route...");

      maybeUpdateRoute();
    };

    window.ReactNativeWebView.postMessage("MAP_READY");
  </script>
</body>
</html>
`;

const MAP_SOURCE = { html: MAP_HTML };

export default function MapPreview({
  latitude,
  longitude,
  guardianLatitude,
  guardianLongitude,
  label,
  height = 260,
  showRoute = false,
}) {
  const webViewRef = useRef(null);

  const lat = Number(latitude);
  const lng = Number(longitude);

  const guardianLat = Number(guardianLatitude);
  const guardianLng = Number(guardianLongitude);

  const hasLocation =
    latitude != null &&
    longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const hasGuardianLocation =
    guardianLatitude != null &&
    guardianLongitude != null &&
    Number.isFinite(guardianLat) &&
    Number.isFinite(guardianLng) &&
    Math.abs(guardianLat) <= 90 &&
    Math.abs(guardianLng) <= 180;

  const updateMap = () => {
    if (!webViewRef.current) return;

    let script = "";

    if (hasLocation) {
      script += `
        window.updateWearerLocation(${lat}, ${lng});
      `;
    }

    if (hasGuardianLocation) {
      script += `
        window.updateGuardianLocation(
          ${guardianLat},
          ${guardianLng}
        );
      `;
    }

    script += `
      window.setRouteEnabled(${showRoute ? "true" : "false"});
    `;

    webViewRef.current.injectJavaScript(
      script + "\ntrue;"
    );
  };

  useEffect(() => {
    updateMap();
  }, [
    lat,
    lng,
    guardianLat,
    guardianLng,
    hasLocation,
    hasGuardianLocation,
    showRoute,
  ]);

  if (!hasLocation) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>
          Waiting for GPS location...
        </Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>
          {label || "SIGHTA Wearer"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrap, { height }]}>
      <WebView
        ref={webViewRef}
        source={MAP_SOURCE}
        style={styles.map}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === "MAP_READY") {
            console.log("SIGHTA LIVE MAP: Ready");
            updateMap();
          }
        }}
        onError={(event) => {
          console.log(
            "SIGHTA MAP ERROR:",
            event.nativeEvent.description
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: "#E8EEF7",
  },

  map: {
    flex: 1,
    backgroundColor: "#E8EEF7",
  },

  fallback: {
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  fallbackText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
});
