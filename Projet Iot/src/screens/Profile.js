import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
} from "firebase/firestore";

import firebase from "../../Firebase";

const PRIMARY = "#00F5C4";
const BG = "#0A0E1A";
const CARD_BG = "#0F1628";
const BORDER = "#1E2A45";

export default function Profile({ navigation, route }) {
  const clientId = route?.params?.clientId;
  const db = getFirestore(firebase);

  const [client, setClient] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ─── Chargement profil Firestore ──────────────────────────────────────────
  useEffect(() => {
    if (!clientId) {
      Alert.alert("Erreur", "Client introuvable");
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "clients", clientId),
      (snap) => {
        if (snap.exists()) {
          setClient({ id: snap.id, ...snap.data() });
        } else {
          Alert.alert("Erreur", "Compte introuvable");
        }
      },
      (error) => {
        console.error(error);
        Alert.alert("Erreur", "Impossible de charger le profil");
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  // ─── Chargement des devices ───────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;

    const q = query(
      collection(db, "devices"),
      where("clientId", "==", clientId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const devList = [];
        snap.forEach((doc) => {
          devList.push({ id: doc.id, ...doc.data() });
        });
        setDevices(devList);
      },
      (error) => {
        console.error("Error fetching devices:", error);
      }
    );

    return () => unsubscribe();
  }, [clientId]);

  // ─── Changement de mot de passe ───────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!clientId || !client) {
      Alert.alert("Erreur", "Client introuvable");
      return;
    }
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erreur", "Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword === oldPassword) {
      Alert.alert("Erreur", "Le nouveau mot de passe doit être différent de l'ancien");
      return;
    }
    // Vérification ancien mot de passe contre Firestore
    if (oldPassword.trim() !== client.password) {
      Alert.alert("Erreur", "Ancien mot de passe incorrect");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "clients", clientId), {
        password: newPassword.trim(),
      });
      Alert.alert("Succès", "Mot de passe modifié avec succès");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de modifier le mot de passe");
    } finally {
      setLoading(false);
    }
  };

  // ─── Déconnexion ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.gridContainer}>
        {[...Array(6)].map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, { left: `${i * 20}%` }]} />
        ))}
        {[...Array(8)].map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLineH, { top: `${i * 14}%` }]} />
        ))}
      </View>

      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <View style={styles.iconRing} />
            <View style={styles.iconInner}>
              <Text style={styles.iconText}>⬡</Text>
            </View>
            <View style={[styles.pulseDot, { top: 0, right: 4 }]} />
            <View style={[styles.pulseDot, { bottom: 4, left: 0 }]} />
          </View>
          <Text style={styles.brand}>IoT CONNECT</Text>
          <Text style={styles.tagline}>USER PROFILE</Text>
          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>ACCOUNT ONLINE</Text>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader title="ACCOUNT INFO" />
          <InfoRow label="NAME" value={client?.name} />
          <InfoRow label="EMAIL" value={client?.email} />
          <InfoRow label="PHONE" value={client?.phone} />

          <SectionHeader title="MY DEVICES" />
          {devices.length === 0 ? (
            <Text style={styles.noDevicesText}>No devices linked to this account.</Text>
          ) : (
            devices.map((dev) => (
              <View key={dev.id} style={styles.deviceItem}>
                <View style={styles.deviceStatus(dev.status)} />
                <View>
                  <Text style={styles.deviceName}>{dev.hardwareId || dev.id}</Text>
                  <Text style={styles.deviceStatusText}>{dev.status?.toUpperCase()}</Text>
                </View>
                <Text style={styles.lastSeen}>
                  {dev.lastSeen ? new Date(dev.lastSeen.seconds * 1000).toLocaleDateString() : "Never"}
                </Text>
              </View>
            ))
          )}

          <SectionHeader title="CHANGE PASSWORD" />

          <TextInput
            style={styles.input}
            placeholder="Ancien mot de passe"
            placeholderTextColor="#3A4460"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Nouveau mot de passe"
            placeholderTextColor="#3A4460"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmer mot de passe"
            placeholderTextColor="#3A4460"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={BG} />
              : <Text style={styles.btnText}>UPDATE PASSWORD</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loading}
          >
            <Text style={styles.logoutText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>● PROFILE DATA ●</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderLine} />
      <Text style={styles.cardHeaderText}>{title}</Text>
      <View style={styles.cardHeaderLine} />
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "--"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  gridContainer: {
    position: "absolute", width: "100%", height: "100%", opacity: 0.06,
  },
  gridLine: {
    position: "absolute", width: 1, height: "100%", backgroundColor: PRIMARY,
  },
  gridLineH: {
    position: "absolute", height: 1, width: "100%", backgroundColor: PRIMARY,
  },

  orb1: {
    position: "absolute", width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(0,245,196,0.06)", top: -80, right: -80,
  },
  orb2: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(0,120,255,0.06)", bottom: 80, left: -60,
  },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 },

  header: { alignItems: "center", marginBottom: 32 },
  iconWrapper: {
    width: 72, height: 72, alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  iconRing: {
    position: "absolute", width: 72, height: 72, borderRadius: 36,
    borderWidth: 1, borderColor: "rgba(0,245,196,0.3)", borderStyle: "dashed",
  },
  iconInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(0,245,196,0.15)",
    borderWidth: 1, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  iconText: { fontSize: 24, color: PRIMARY },
  pulseDot: {
    position: "absolute", width: 8, height: 8,
    borderRadius: 4, backgroundColor: PRIMARY,
  },

  brand: { fontSize: 22, fontWeight: "900", color: "#FFFFFF", letterSpacing: 6 },
  tagline: { fontSize: 10, color: "#3A4460", letterSpacing: 3, marginTop: 4 },

  statusBar: {
    flexDirection: "row", alignItems: "center", marginTop: 12,
    backgroundColor: "rgba(0,245,196,0.08)",
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,245,196,0.2)",
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: PRIMARY, marginRight: 6,
  },
  statusText: { fontSize: 10, color: PRIMARY, letterSpacing: 2, fontWeight: "700" },

  card: {
    backgroundColor: CARD_BG, borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: BORDER,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    marginTop: 8, marginBottom: 18,
  },
  cardHeaderLine: { flex: 1, height: 1, backgroundColor: BORDER },
  cardHeaderText: {
    fontSize: 11, color: "#3A4460", letterSpacing: 3,
    marginHorizontal: 12, fontWeight: "700",
  },

  infoBox: {
    backgroundColor: "#080C18", borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  label: {
    color: "#3A4460", fontSize: 10, fontWeight: "800",
    letterSpacing: 2, marginBottom: 6,
  },
  value: { color: "#E0E8FF", fontSize: 15, fontWeight: "800" },

  noDevicesText: {
    color: "#3A4460",
    fontSize: 12,
    textAlign: "center",
    marginVertical: 10,
    fontStyle: "italic",
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#080C18",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  deviceStatus: (status) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: status === "active" ? PRIMARY : status === "error" ? "#FF3B5C" : "#3A4460",
    marginRight: 12,
  }),
  deviceName: {
    color: "#E0E8FF",
    fontSize: 14,
    fontWeight: "700",
  },
  deviceStatusText: {
    color: "#3A4460",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  lastSeen: {
    marginLeft: "auto",
    color: "#3A4460",
    fontSize: 10,
  },

  input: {
    height: 48, backgroundColor: "#080C18",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 14,
    color: "#E0E8FF", marginBottom: 12,
  },

  btn: {
    height: 50, backgroundColor: PRIMARY,
    borderRadius: 10, alignItems: "center",
    justifyContent: "center", marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: BG, fontSize: 13, fontWeight: "900", letterSpacing: 2 },

  logoutBtn: {
    height: 50, backgroundColor: "rgba(255,59,92,0.12)",
    borderWidth: 1, borderColor: "#FF3B5C",
    borderRadius: 10, alignItems: "center",
    justifyContent: "center", marginTop: 14,
  },
  logoutText: { color: "#FF3B5C", fontSize: 13, fontWeight: "900", letterSpacing: 2 },

  footer: { alignItems: "center", marginTop: 24 },
  footerText: { fontSize: 10, color: "#1E2A45", letterSpacing: 1 },
});
