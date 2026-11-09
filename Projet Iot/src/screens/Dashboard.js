import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useMemo } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  limit,
} from "firebase/firestore";
import firebase from "../../Firebase";
import { METRICS_CONFIG, EXCLUDED_KEYS } from "../constants/metrics";

const PRIMARY = "#00F5C4";
const BG = "#0A0E1A";
const CARD_BG = "#0F1628";
const BORDER = "#1E2A45";

export default function Dashboard({ navigation, route }) {
  const clientId = route?.params?.clientId;
  const db = getFirestore(firebase);

  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Listen to Client Data (Subscription) ──────────────────────────────
  useEffect(() => {
    if (!clientId) return;

    const unsubscribe = onSnapshot(doc(db, "clients", clientId), (snap) => {
      if (snap.exists()) {
        setClientData(snap.data());
      }
    });

    return () => unsubscribe();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "devices"),
      where("clientId", "==", clientId)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const devList = [];
      snap.forEach((doc) => {
        devList.push({ id: doc.id, ...doc.data() });
      });
      setDevices(devList);
      setLoading(false);
    }, (error) => {
      console.error("Dashboard: Error fetching devices:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId]);

  // ─── Listen to Telemetry for each device ──────────────────────────────
  useEffect(() => {
    if (devices.length === 0) return;

    const unsubscribers = devices.map(device => {
      const q = query(
        collection(db, "telemetry"),
        where("deviceId", "==", device.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      return onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          // Extract dynamic data from the 'values' field
          const data = docData.values || {};
          setTelemetry(prev => ({
            ...prev,
            [device.id]: { ...data, timestamp: docData.timestamp }
          }));
        }
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [devices]);

  const devicesWithData = useMemo(() => {
    return devices.map(dev => {
      const tel = telemetry[dev.id] || {};
      
      let gasStatus = "NORMAL";
      if (tel.gas >= 100) gasStatus = "DANGER";
      else if (tel.gas >= 50) gasStatus = "WARNING";

      return {
        ...dev,
        status: dev.status?.toUpperCase() || "INACTIVE",
        temp: tel.temperature || 0,
        humidity: tel.humidity || 0,
        co2: tel.gas || 0,
        gas: gasStatus,
        lastUpdate: tel.timestamp ? new Date(tel.timestamp).toLocaleTimeString() : (dev.lastSeen ? new Date(dev.lastSeen.seconds * 1000).toLocaleTimeString() : "--:--")
      };
    });
  }, [devices, telemetry]);

  const effectiveStatus = useMemo(() => {
    if (!clientData?.subscription) return "ACTIVE"; // Default to active if data not loaded yet
    
    const sub = clientData.subscription;
    const now = new Date();
    const endDate = new Date(sub.endDate);
    
    const isActive = sub.status === 'active' && sub.paymentStatus === 'paid';
    const isWithinDates = now <= endDate;

    if (isActive && isWithinDates) {
      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) return "ENDING_SOON";
      return "ACTIVE";
    }
    return "LOCKED";
  }, [clientData]);

  const stats = useMemo(() => {
    const total = devicesWithData.length;
    const active = devicesWithData.filter((d) => d.status === "ACTIVE").length;
    const offline = devicesWithData.filter((d) => d.status !== "ACTIVE").length;
    const activeDevices = devicesWithData.filter((d) => d.status === "ACTIVE");

    // Calculate averages for all available metrics
    const averages = {};
    if (activeDevices.length > 0) {
      const allMetricKeys = new Set();
      Object.values(telemetry).forEach(data => {
        Object.keys(data).forEach(key => {
          if (!EXCLUDED_KEYS.includes(key) && !isNaN(Number(data[key]))) {
            allMetricKeys.add(key);
          }
        });
      });

      allMetricKeys.forEach(key => {
        const sum = activeDevices.reduce((acc, d) => {
          const deviceTelemetry = telemetry[d.id] || {};
          return acc + Number(deviceTelemetry[key] || 0);
        }, 0);
        averages[key] = (sum / activeDevices.length).toFixed(key === 'humidity' || key === 'battery' ? 0 : 1);
      });
    }

    const warningDevice = devicesWithData.find(
      (d) => d.gas === "DANGER" || d.gas === "WARNING" || Number(d.temp) > 35
    );

    const isCurrentlyLocked = effectiveStatus === "LOCKED" || devices.some(d => d.isPaid === false);

    const globalStatus = isCurrentlyLocked 
      ? "INACTIF"
      : warningDevice
        ? "WARNING"
        : offline > 0
          ? "PARTIAL"
          : "NORMAL";

    return {
      total,
      active,
      offline,
      averages,
      globalStatus,
      warningDevice,
    };
  }, [devicesWithData, effectiveStatus, devices]);

  const isLocked = effectiveStatus === "LOCKED" || devices.some(d => d.isPaid === false);

  const getStatusColor = (status) => {
    if (status === "NORMAL") return PRIMARY;
    if (status === "PARTIAL") return "#FFB800";
    if (status === "WARNING") return "#FFB800";
    if (status === "INACTIF") return "#FF3B5C";
    return "#FF3B5C";
  };

  const zones = useMemo(() => {
    const result = {};

    devices.forEach((device) => {
      if (!result[device.zone]) result[device.zone] = 0;
      result[device.zone] += 1;
    });

    return Object.entries(result);
  }, [devices]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

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
          <Text style={styles.tagline}>CLIENT DASHBOARD</Text>

          <View style={styles.statusBar}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(stats.globalStatus) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(stats.globalStatus) },
              ]}
            >
              SYSTEM {stats.globalStatus}
            </Text>
          </View>
        </View>

        {effectiveStatus === "ENDING_SOON" && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ RENEWAL DUE SOON</Text>
            <Text style={styles.warningSubtext}>Your subscription ends soon. Renewal recommended.</Text>
          </View>
        )}


        {loading ? (
          <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLine} />
              <Text style={styles.cardHeaderText}>OVERVIEW</Text>
              <View style={styles.cardHeaderLine} />
            </View>

            <View
              style={[
                styles.generalBox,
                { borderColor: getStatusColor(stats.globalStatus) },
              ]}
            >
              <Text style={styles.generalLabel}>GLOBAL STATUS</Text>

              <Text
                style={[
                  styles.generalValue,
                  { color: getStatusColor(stats.globalStatus) },
                ]}
              >
                {stats.globalStatus}
              </Text>

              <Text style={styles.updateText}>
                LAST SYNC : {devices[0]?.lastUpdate || "--:--"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{stats.total}</Text>
                <Text style={styles.summaryLabel}>DEVICES</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={[styles.summaryNumber, { color: PRIMARY }]}>
                  {stats.active}
                </Text>
                <Text style={styles.summaryLabel}>ACTIVE</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={[styles.summaryNumber, { color: "#FF3B5C" }]}>
                  {stats.offline}
                </Text>
                <Text style={styles.summaryLabel}>OFFLINE</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUICK SENSORS</Text>

              <View style={styles.grid}>
                {Object.keys(stats.averages).map((key) => {
                  const config = METRICS_CONFIG[key] || {
                    label: key.charAt(0).toUpperCase() + key.slice(1),
                    unit: "",
                    icon: "◈",
                    color: PRIMARY,
                  };
                  return (
                    <View key={key} style={styles.sensorCard}>
                      <Text style={[styles.sensorIcon, { color: config.color }]}>
                        {config.icon}
                      </Text>
                      <Text style={styles.sensorLabel}>AVG {config.label}</Text>
                      <Text style={styles.sensorValue}>
                        {stats.averages[key]} <Text style={styles.sensorUnit}>{config.unit}</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LAST ALERT</Text>

              <View
                style={[
                  styles.alertBox,
                  stats.warningDevice && {
                    borderColor: "rgba(255,184,0,0.4)",
                    backgroundColor: "rgba(255,184,0,0.08)",
                  },
                ]}
              >
                {stats.warningDevice ? (
                  <>
                    <Text style={[styles.alertTitle, { color: "#FFB800" }]}>
                      WARNING - {stats.warningDevice.name || stats.warningDevice.id}
                    </Text>

                    <Text style={styles.alertText}>
                      Abnormal value detected in this node.
                    </Text>

                    <Text style={styles.alertTime}>
                      LAST UPDATE : {stats.warningDevice.lastUpdate}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.alertText}>NO CRITICAL ALERT DETECTED</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DEVICES BY ZONE</Text>

              {zones.length === 0 ? (
                <Text style={{ color: "#3A4460", fontSize: 11 }}>No zones defined.</Text>
              ) : (
                zones.map(([zone, count]) => (
                  <View key={zone} style={styles.zoneRow}>
                    <Text style={styles.zoneName}>{zone || "DEFAULT"}</Text>
                    <Text style={styles.zoneCount}>{count} DEVICE(S)</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate("Devices")}
              >
                <Text style={styles.actionText}>VIEW DEVICES</Text>
                <Text style={styles.actionArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => navigation.navigate("Alerts")}
              >
                <Text style={styles.actionTextSecondary}>VIEW ALERTS</Text>
                <Text style={styles.actionArrowSecondary}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrBtn}
                onPress={() => navigation.navigate("ScanQR")}
              >
                <Text style={styles.qrIcon}>▣</Text>
                <Text style={styles.qrText}>SCAN QR CODE</Text>
                <Text style={styles.qrArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>● ...● </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

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

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
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
    borderStyle: "dashed",
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
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
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

  generalBox: {
    backgroundColor: "rgba(0,245,196,0.08)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },

  generalLabel: {
    fontSize: 10,
    color: "#3A4460",
    letterSpacing: 2,
    fontWeight: "700",
  },

  generalValue: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 6,
  },

  updateText: {
    color: "#3A4460",
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 4,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  summaryCard: {
    width: "31%",
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  summaryNumber: {
    color: "#E0E8FF",
    fontSize: 24,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#3A4460",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 4,
  },

  section: {
    marginTop: 10,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 10,
    color: "#3A4460",
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 8,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  sensorCard: {
    width: "48%",
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  sensorIcon: {
    color: PRIMARY,
    fontSize: 18,
    marginBottom: 8,
  },

  sensorLabel: {
    color: "#3A4460",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },

  sensorValue: {
    color: "#E0E8FF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },

  sensorUnit: {
    fontSize: 12,
    color: "#3A4460",
  },

  alertBox: {
    backgroundColor: "rgba(0,245,196,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,245,196,0.15)",
    borderRadius: 10,
    padding: 14,
  },

  alertTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  alertText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  alertTime: {
    color: "#3A4460",
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 6,
  },

  zoneRow: {
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  zoneName: {
    color: "#E0E8FF",
    fontSize: 13,
    fontWeight: "800",
  },

  zoneCount: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  actionBtn: {
    borderRadius: 8,
    height: 52,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    flexDirection: "row",
  },

  actionText: {
    color: BG,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  actionArrow: {
    color: BG,
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 8,
    marginTop: -2,
  },

  actionBtnSecondary: {
    borderRadius: 8,
    height: 52,
    backgroundColor: "rgba(0,245,196,0.12)",
    borderWidth: 1,
    borderColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
  },

  actionTextSecondary: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  actionArrowSecondary: {
    color: PRIMARY,
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 8,
    marginTop: -2,
  },

  qrBtn: {
    borderRadius: 8,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,245,196,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
  },

  qrIcon: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    marginRight: 10,
  },

  qrText: {
    color: "#E0E8FF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },

  qrArrow: {
    color: PRIMARY,
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 8,
    marginTop: -2,
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

  // ─── Warning Banner Styles ──────────────────────────────────────────────
  warningBanner: {
    backgroundColor: "rgba(255, 184, 0, 0.15)",
    marginHorizontal: 20,
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFB800",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  warningText: {
    color: "#FFB800",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  warningSubtext: {
    color: "#E0E8FF",
    fontSize: 10,
    opacity: 0.7,
  },
});