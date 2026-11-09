import React from "react";
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeviceConfig({ navigation }) {
  const configUrl = "http://192.168.4.1";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configuration</Text>
      </View>

      <WebView 
        source={{ uri: configUrl }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#00F5C4" size="large" />
            <Text style={styles.loadingText}>Connecting to Device...</Text>
          </View>
        )}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A45",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#00F5C4",
    fontSize: 32,
    fontWeight: "300",
  },
  title: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0A0E1A",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#3A4460",
    marginTop: 16,
    fontSize: 14,
  }
});
