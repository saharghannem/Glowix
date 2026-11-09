import React, { useLayoutEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import firebase from "../../Firebase";

const PRIMARY = "#00F5C4";
const BG = "#0A0E1A";
const CARD_BG = "#0F1628";
const BORDER = "#1E2A45";

export default function Login({ navigation }) {
  const [focusedField, setFocusedField] = useState(null);

  const [userData, setUserData] = useState({
    email: "",
    password: "",
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const inputChangeHandler = (value, name) => {
    setUserData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const loginHandler = async () => {
    if (!userData.email || !userData.password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    try {
      const db = getFirestore(firebase);

      const q = query(
        collection(db, "clients"),
        where("email", "==", userData.email.trim().toLowerCase()),
        where("password", "==", userData.password.trim())
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("Erreur", "Compte incorrect");
        return;
      }

      const clientDoc = snap.docs[0];
      const client = clientDoc.data();

      navigation.replace("Main", {
        clientId: clientDoc.id,
        client: client,
      });
    } catch (error) {
      console.log(error);
      Alert.alert("Erreur", "Connexion impossible");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0, 20, 40, 60, 80, 100].map((pct, i) => (
          <View
            key={`v${i}`}
            style={[styles.gridLineV, { left: `${pct}%` }]}
          />
        ))}

        {[0, 14, 28, 42, 56, 70, 84, 98].map((pct, i) => (
          <View
            key={`h${i}`}
            style={[styles.gridLineH, { top: `${pct}%` }]}
          />
        ))}
      </View>

      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.brand}>GLOWIX</Text>

          <Text style={styles.tagline}>
            DEVICE MANAGEMENT PORTAL
          </Text>

          <View style={styles.statusBar}>
            <View style={styles.statusDot} />

            <Text style={styles.statusText}>
              SYSTEM ONLINE
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLine} />

            <Text style={styles.cardHeaderText}>
              AUTHENTICATE
            </Text>

            <View style={styles.cardHeaderLine} />
          </View>

          <View style={styles.inpV}>
            <Text style={styles.inpT}>
              USER ID / EMAIL
            </Text>

            <View
              style={[
                styles.inputWrapper,
                focusedField === "email" &&
                styles.inputFocused,
              ]}
            >
              <Text style={styles.inputIcon}>◈</Text>

              <TextInput
                style={styles.inpI}
                onChangeText={(txt) =>
                  inputChangeHandler(txt, "email")
                }
                value={userData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="user@iot-network.io"
                placeholderTextColor="#3A4460"
                onFocus={() =>
                  setFocusedField("email")
                }
                onBlur={() =>
                  setFocusedField(null)
                }
              />
            </View>
          </View>

          <View style={styles.inpV}>
            <Text style={styles.inpT}>
              ACCESS KEY
            </Text>

            <View
              style={[
                styles.inputWrapper,
                focusedField === "password" &&
                styles.inputFocused,
              ]}
            >
              <Text style={styles.inputIcon}>◉</Text>

              <TextInput
                style={styles.inpI}
                onChangeText={(txt) =>
                  inputChangeHandler(txt, "password")
                }
                value={userData.password}
                secureTextEntry
                placeholder="••••••••••••"
                placeholderTextColor="#3A4460"
                onFocus={() =>
                  setFocusedField("password")
                }
                onBlur={() =>
                  setFocusedField(null)
                }
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.btn}
            onPress={loginHandler}
            activeOpacity={0.85}
          >
            <View style={styles.btnInner}>
              <Text style={styles.btnT}>
                INITIALIZE SESSION
              </Text>

              <Text style={styles.btnArrow}>›</Text>
            </View>

            <View style={styles.btnGlow} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ● ENCRYPTED CONNECTION ●
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  gridLineV: {
    position: "absolute",
    width: 1,
    height: "100%",
    backgroundColor: PRIMARY,
    opacity: 0.06,
  },

  gridLineH: {
    position: "absolute",
    height: 1,
    width: "100%",
    backgroundColor: PRIMARY,
    opacity: 0.06,
  },

  orb1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(0,245,196,0.06)",
    top: -80,
    right: -80,
  },

  orb2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0,120,255,0.06)",
    bottom: 80,
    left: -60,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  iconWrapper: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  iconRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(0,245,196,0.3)",
  },

  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,245,196,0.15)",
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },

  iconText: {
    fontSize: 24,
    color: PRIMARY,
  },

  pulseDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },

  logo: {
    width: 180,
    height: 180,
    marginBottom: 10,
  },
  brand: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 6,
  },

  tagline: {
    fontSize: 10,
    color: "#3A4460",
    letterSpacing: 3,
    marginTop: 4,
  },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(0,245,196,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,245,196,0.2)",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
    color: PRIMARY,
    letterSpacing: 2,
    fontWeight: "700",
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  cardHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },

  cardHeaderText: {
    fontSize: 11,
    color: "#3A4460",
    letterSpacing: 3,
    marginHorizontal: 12,
    fontWeight: "700",
  },

  inpV: {
    marginBottom: 16,
  },

  inpT: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3A4460",
    letterSpacing: 2,
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#080C18",
    paddingHorizontal: 14,
    height: 50,
  },

  inputFocused: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(0,245,196,0.04)",
  },

  inputIcon: {
    fontSize: 14,
    color: "#3A4460",
    marginRight: 10,
  },

  inpI: {
    flex: 1,
    fontSize: 14,
    color: "#E0E8FF",
    letterSpacing: 0.5,
  },

  btn: {
    borderRadius: 8,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    overflow: "hidden",
    marginTop: 8,
  },

  btnInner: {
    flexDirection: "row",
    alignItems: "center",
  },

  btnT: {
    color: "#0A0E1A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  btnArrow: {
    color: "#0A0E1A",
    fontSize: 22,
    fontWeight: "900",
    marginTop: -2,
    marginLeft: 8,
  },

  btnGlow: {
    position: "absolute",
    bottom: 0,
    width: "60%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.4)",
  },

  footer: {
    alignItems: "center",
    marginTop: 24,
  },

  footerText: {
    fontSize: 10,
    color: "#1E2A45",
    letterSpacing: 1,
  },
});