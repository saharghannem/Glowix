import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, Linking } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import WifiManager from "react-native-wifi-reborn";

export default function ScanQR({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleWifiWorkflow = (ssid, password) => {
    Alert.alert(
      "WiFi Setup Detected",
      `Do you want to connect to ${ssid}?`,
      [
        {
          text: "Connect",
          onPress: async () => {
            try {
              if (password) {
                await WifiManager.connectToProtectedSSID(ssid, password, false, false);
              } else {
                await WifiManager.connectToSSID(ssid);
              }
              
              setTimeout(() => {
                navigation.navigate("DeviceConfig");
              }, 2000);
            } catch (error) {
              console.error("WiFi Connection Error:", error);
              Alert.alert(
                "Connection Failed",
                "Could not connect automatically. Please connect manually to the WiFi and try again.",
                [
                  { text: "Try Manual", onPress: () => navigation.navigate("DeviceConfig") },
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }
          }
        },
        { text: "Cancel", style: "cancel", onPress: () => setScanned(false) }
      ]
    );
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    requestPermission();
    return (
      <View style={styles.center}>
        <Text>Camera permission required</Text>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;

    setScanned(true);

    try {
      // Check if it's a WiFi QR Code (WIFI: format)
      if (data.startsWith("WIFI:")) {
        const ssidMatch = data.match(/S:([^;]+);/);
        const passwordMatch = data.match(/P:([^;]+);/);
        
        const ssid = ssidMatch ? ssidMatch[1] : null;
        const password = passwordMatch ? passwordMatch[1] : null;

        if (ssid) {
          handleWifiWorkflow(ssid, password);
          return;
        }
      }

      // Existing Device ID logic
      let qrData;
      if (data.startsWith("{")) {
        qrData = JSON.parse(data);
      } else {
        qrData = { deviceId: data };
      }

      // Check if the JSON contains WiFi info (SSID and potentially Password)
      if (qrData.ssid || qrData.SSID) {
        const ssid = qrData.ssid || qrData.SSID;
        const password = qrData.password || qrData.pass || qrData.Password || null;
        
        handleWifiWorkflow(ssid, password);
        return;
      }

      if (qrData.deviceId) {
        navigation.navigate("Accueil", {
          deviceId: qrData.deviceId,
          deviceName: qrData.name || qrData.deviceName || qrData.deviceId
        });
      } else {
        Alert.alert("Error", "Invalid QR Code");
      }
    } catch (error) {
      Alert.alert("Error", "QR parsing failed");
    }

    setTimeout(() => {
      setScanned(false);
    }, 3000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <Text style={styles.text}>Scan Device QR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#00FFFF",
    borderRadius: 20,
  },

  text: {
    color: "#fff",
    marginTop: 20,
    fontSize: 18,
    fontWeight: "bold",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});