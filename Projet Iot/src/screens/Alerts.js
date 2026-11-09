import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFirestore, collection, query, onSnapshot, doc, orderBy, where, updateDoc } from "firebase/firestore";
import firebase from "../../Firebase";
import { METRICS_CONFIG } from "../constants/metrics";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#00F5C4";
const BG = "#0A0E1A";
const CARD_BG = "#0F1628";
const BORDER = "#1E2A45";

export default function Alerts({ route }) {
  const clientId = route?.params?.clientId;
  const db = getFirestore(firebase);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      console.log("No clientId provided to Alerts screen.");
      setLoading(false);
      return;
    }

    let unsubscribe;

    const startListening = (useFallback = false) => {
      
      const q = useFallback 
        ? query(collection(db, "alerts"), where("clientId", "==", clientId))
        : query(collection(db, "alerts"), where("clientId", "==", clientId), orderBy("timestamp", "desc"));

      unsubscribe = onSnapshot(q, (snap) => {
        let alertList = [];
        snap.forEach((doc) => {
          const data = doc.data();
          alertList.push({ id: doc.id, ...data });
        });

        if (useFallback) {
          alertList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }

        setAlerts(alertList);
        setLoading(false);
      }, (error) => {
        if (!useFallback && (error.code === 'failed-precondition' || error.message.includes('index'))) {
          if (unsubscribe) unsubscribe();
          startListening(true);
        } else {
          setLoading(false);
        }
      });
    };

    startListening();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [clientId]);

  const [processing, setProcessing] = useState({});

  const getColor = (severity) => {
    const s = severity?.toLowerCase();
    if (s === "warning") return "#FFB800";
    if (s === "critical" || s === "danger") return "#FF3B5C";
    return PRIMARY;
  };

  const formatTime = (ts) => {
    if (!ts) return "Now";
    // Timestamp in ms
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAcknowledge = async (alertId) => {
    try {
      setProcessing(prev => ({ ...prev, [alertId]: true }));
      const alertRef = doc(db, "alerts", alertId);
      await updateDoc(alertRef, {
        isSeen: true,
        seenAt: Date.now()
      });
      // The Firestore listener will automatically remove it from the list
    } catch (error) {
      console.error("Acknowledgment Error:", error);
      Alert.alert("Error", "Could not clear notification.");
      setProcessing(prev => ({ ...prev, [alertId]: false }));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Background Grid */}
      <View style={styles.gridContainer}>
        {[...Array(6)].map((_, i) => (
          <View
            key={`v-${i}`}
            style={[styles.gridLine, { left: `${i * 20}%` }]}
          />
        ))}
        {[...Array(8)].map((_, i) => (
          <View
            key={`h-${i}`}
            style={[styles.gridLineH, { top: `${i * 14}%` }]}
          />
        ))}
      </View>

      {/* Glow */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>ALERTS</Text>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 50 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>✅ SYSTEM CLEAR</Text>
            <Text style={styles.emptySubText}>No active alerts detected in the database.</Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.card, { borderColor: getColor(item.severity) }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.level, { color: getColor(item.severity) }]}>
                    {item.severity?.toUpperCase()}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
                </View>

                <Text style={styles.device}>{item.deviceId === "SYSTEM" ? "SYSTEM ALERT" : `DEVICE: ${item.deviceId}`}</Text>
                <Text style={styles.message}>{item.message}</Text>
                
                <View style={styles.tagRow}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeTag}>{item.type?.toUpperCase()}</Text>
                    {item.value !== undefined && <Text style={styles.valueText}>Val: {item.value}</Text>}
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.seenBtn, processing[item.id] && { opacity: 0.5 }]} 
                    onPress={() => handleAcknowledge(item.id)}
                    disabled={processing[item.id]}
                  >
                    {processing[item.id] ? (
                      <ActivityIndicator size="small" color={PRIMARY} />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={14} color={PRIMARY} />
                        <Text style={styles.seenText}>VU</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    marginBottom: 20,
    textAlign: "center",
  },

  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  level: {
    fontWeight: "900",
    letterSpacing: 1,
  },

  time: {
    color: "#3A4460",
    fontSize: 10,
  },

  device: {
    color: "#E0E8FF",
    fontSize: 14,
    fontWeight: "800",
  },

  message: {
    color: "#AAB3D1",
    marginTop: 4,
    fontSize: 12,
  },

  type: {
    marginTop: 6,
    fontSize: 10,
    color: "#3A4460",
    letterSpacing: 1,
  },

  /* Background */
  gridContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.06,
  },

  gridLine: {
    position: "absolute",
    width: 1,
    height: "100%",
    backgroundColor: PRIMARY,
  },

  gridLineH: {
    position: "absolute",
    height: 1,
    width: "100%",
    backgroundColor: PRIMARY,
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
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  typeTag: {
    fontSize: 10,
    color: PRIMARY,
    fontWeight: "700",
    letterSpacing: 1,
    backgroundColor: "rgba(0, 245, 196, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  valueText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ackBadge: {
    backgroundColor: "rgba(0, 245, 196, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(0, 245, 196, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ackText: {
    color: "rgba(0, 245, 196, 0.5)",
    fontSize: 9,
    fontWeight: "800",
  },
  seenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(0, 245, 196, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 196, 0.3)",
  },
  seenText: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "900",
    marginLeft: 6,
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 8,
  },
  emptySubText: {
    color: "#3A4460",
    fontSize: 14,
    textAlign: "center",
  },
});