import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
} from "react-native-svg";

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from "firebase/firestore";
import app from "../../Firebase";
import { METRICS_CONFIG, EXCLUDED_KEYS } from "../constants/metrics";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;
const CHART_H = 110;
const MAX_POINTS = 20;

function SparkLine({ data, color, gradientId, unit, label, icon }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: (i / (MAX_POINTS - 1)) * CHART_W,
    y: CHART_H - ((v - min) / range) * (CHART_H - 20) - 10,
  }));

  const pathD = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, "");

  const areaD = `${pathD} L${pts[pts.length - 1].x},${CHART_H} L0,${CHART_H} Z`;
  const lastVal = data[data.length - 1];
  const lastPt = pts[pts.length - 1];

  return (
    <View style={chartStyles.wrapper}>
      <View style={chartStyles.header}>
        <Text style={chartStyles.icon}>{icon}</Text>
        <View>
          <Text style={chartStyles.chartLabel}>{label}</Text>
          <Text style={[chartStyles.chartValue, { color }]}>
            {lastVal}
            <Text style={chartStyles.unit}> {unit}</Text>
          </Text>
        </View>
        <View
          style={[
            chartStyles.badge,
            { borderColor: color + "55", backgroundColor: color + "15" },
          ]}
        >
          <Text style={[chartStyles.badgeText, { color }]}>LIVE</Text>
          <View style={[chartStyles.liveDot, { backgroundColor: color }]} />
        </View>
      </View>

      <Svg width={CHART_W} height={CHART_H} style={{ marginTop: 8 }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {[0.25, 0.5, 0.75].map((ratio, i) => (
          <Line
            key={i}
            x1={0}
            y1={CHART_H * ratio}
            x2={CHART_W}
            y2={CHART_H * ratio}
            stroke="#1E293B"
            strokeWidth="1"
          />
        ))}

        <Path d={areaD} fill={`url(#${gradientId})`} />
        <Path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={lastPt.x} cy={lastPt.y} r={5} fill={color} />
        <Circle cx={lastPt.x} cy={lastPt.y} r={9} fill={color} fillOpacity={0.2} />
      </Svg>
    </View>
  );
}

function GaugeCircle({ value, max, color, label, icon }) {
  const SIZE = 90;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const numValue = Number(value) || 0;
  const pct = Math.min(numValue / max, 1);
  const dash = pct * CIRC;

  return (
    <View style={gaugeStyles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#1E293B"
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          fill="#fff"
          fontSize="18"
          fontWeight="bold"
        >
          {value === "--" ? "—" : value}
        </SvgText>
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          fill="#64748B"
          fontSize="10"
        >
          {icon}
        </SvgText>
      </Svg>
      <Text style={gaugeStyles.label}>{label}</Text>
    </View>
  );
}

function ParamCard({ label, value, unit, icon, color }) {
  return (
    <View style={styles.paramCard}>
      <Text style={styles.paramIcon}>{icon}</Text>
      <Text style={styles.paramLabel}>{label}</Text>
      <Text style={[styles.paramValue, { color }]}>
        {value ?? "--"}
        <Text style={styles.paramUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

export default function Accueil({ route, navigation }) {
  const deviceId = route?.params?.deviceId || "DEV001";

  const [refreshing, setRefreshing] = useState(false);
  const [sensorData, setSensorData] = useState({
    deviceId,
    status: "WAITING",
    lastUpdate: "--",
  });

  const [history, setHistory] = useState({});

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const db = getFirestore(app);
    const q = query(
      collection(db, "telemetry"),
      where("deviceId", "==", deviceId),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const docData = doc.data();
        const sensorValues = docData.values || {};

        setSensorData({
          ...sensorValues,
          deviceId: docData.deviceId || deviceId,
          status: "ONLINE",
          lastUpdate: docData.timestamp ? new Date(docData.timestamp).toLocaleTimeString() : "Now"
        });

        // Update history for all numeric metrics dynamically
        setHistory((prev) => {
          const newHistory = { ...prev };
          Object.keys(sensorValues).forEach((key) => {
            const val = Number(sensorValues[key]);
            if (!isNaN(val) && !EXCLUDED_KEYS.includes(key)) {
              if (!newHistory[key]) {
                // Initialize with some dummy data for better curve start or just empty
                newHistory[key] = [val];
              } else {
                newHistory[key] = [...newHistory[key].slice(-MAX_POINTS + 1), val];
              }
            }
          });
          return newHistory;
        });
      } else {
        setSensorData((prev) => ({ ...prev, status: "NO DATA" }));
      }
    }, (error) => {
      console.error("Accueil: Firestore error:", error);
      setSensorData((prev) => ({ ...prev, status: "ERROR" }));
    });

    return () => unsubscribe();
  }, [deviceId]);

  const isOnline =
    sensorData.status === "ONLINE" ||
    sensorData.status === "online" ||
    sensorData.status === "ACTIVE" ||
    sensorData.status === "active";

  const statusColor =
    sensorData.status === "DANGER"
      ? "#FF3B5C"
      : sensorData.status === "WARNING"
      ? "#FFB800"
      : isOnline
      ? "#00E5A0"
      : "#F87171";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(false)}
            tintColor="#00E5A0"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.subtitle}>{route?.params?.deviceName || "IoT Device"}</Text>
              <Text style={styles.title}>LIVE{"\n"}INSIGHTS</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.timeText}>{timeStr}</Text>
            <View
              style={[
                styles.statusPill,
                {
                  borderColor: statusColor + "55",
                  backgroundColor: statusColor + "15",
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.pulseDot,
                  {
                    backgroundColor: statusColor,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {isOnline ? "EN LIGNE" : sensorData.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.deviceCard}>
          <Text style={styles.deviceLabel}>DEVICE</Text>
          <Text style={styles.deviceId}>{sensorData.deviceId}</Text>

          <View style={styles.deviceDivider} />

          <View style={styles.gaugesRow}>
            {Object.keys(METRICS_CONFIG)
              .filter((key) => METRICS_CONFIG[key].isGauge && sensorData[key] !== undefined)
              .map((key, i, arr) => (
                <React.Fragment key={key}>
                  <GaugeCircle
                    value={sensorData[key]}
                    max={METRICS_CONFIG[key].max}
                    color={METRICS_CONFIG[key].color}
                    label={METRICS_CONFIG[key].label}
                    icon={METRICS_CONFIG[key].icon}
                  />
                  {i < arr.length - 1 && <View style={styles.gaugeSep} />}
                </React.Fragment>
              ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>PARAMÈTRES DISPONIBLES</Text>

        <View style={styles.paramsGrid}>
          {Object.keys(sensorData)
            .filter((key) => !EXCLUDED_KEYS.includes(key) && !METRICS_CONFIG[key]?.isGauge)
            .map((key) => {
              const config = METRICS_CONFIG[key] || {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                unit: "",
                icon: "📊",
                color: "#94A3B8",
              };

              let val = sensorData[key];
              if (config.isBoolean) {
                val = val === 1 || val === true || val === "1" ? "OUI" : "NON";
              }

              return (
                <ParamCard
                  key={key}
                  label={config.label}
                  value={val}
                  unit={config.unit}
                  icon={config.icon}
                  color={config.color}
                />
              );
            })}
        </View>

        <Text style={styles.sectionTitle}>COURBES EN TEMPS RÉEL</Text>

        {Object.keys(history).map((key) => {
          const config = METRICS_CONFIG[key] || {
            label: key.charAt(0).toUpperCase() + key.slice(1),
            unit: "",
            icon: "📊",
            color: "#94A3B8",
          };

          return (
            <SparkLine
              key={key}
              data={history[key]}
              color={config.color}
              gradientId={`${key}Grad`}
              unit={config.unit}
              label={config.label}
              icon={config.icon}
            />
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>● Firebase RTDB — Temps réel</Text>
          <Text style={styles.footerText}>↻ Auto-refresh actif</Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const chartStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#0D1B2A",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { fontSize: 28 },
  chartLabel: {
    color: "#64748B",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  chartValue: {
    fontSize: 30,
    fontWeight: "800",
    marginTop: 2,
  },
  unit: {
    fontSize: 16,
    fontWeight: "400",
    color: "#64748B",
  },
  badge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const gaugeStyles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060E1A",
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    marginTop: 10,
  },

  subtitle: {
    color: "#38BDF8",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: 1,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  backBtnText: {
    color: "#00F5C4",
    fontSize: 30,
    fontWeight: "300",
    marginTop: -4,
  },

  headerRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  timeText: {
    color: "#334155",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  deviceCard: {
    backgroundColor: "#0D1B2A",
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },

  deviceLabel: {
    color: "#334155",
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 4,
  },

  deviceId: {
    color: "#38BDF8",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
  },

  deviceDivider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginVertical: 18,
  },

  gaugesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  gaugeSep: {
    width: 1,
    height: 70,
    backgroundColor: "#1E293B",
  },

  sectionTitle: {
    color: "#334155",
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 4,
  },

  paramsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  paramCard: {
    width: "48%",
    backgroundColor: "#0D1B2A",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },

  paramIcon: {
    fontSize: 24,
    marginBottom: 8,
  },

  paramLabel: {
    color: "#64748B",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  paramValue: {
    fontSize: 21,
    fontWeight: "800",
    marginTop: 6,
  },

  paramUnit: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "400",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },

  footerText: {
    color: "#1E3A5F",
    fontSize: 11,
  },
});