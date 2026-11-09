import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc
} from "firebase/firestore";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import firebase, { db } from "../../Firebase";
import { METRICS_CONFIG, EXCLUDED_KEYS } from "../constants/metrics";

const PRIMARY = "#00F5C4";
const BG = "#0A0E1A";
const CARD_BG = "#0F1628";
const BORDER = "#1E2A45";

export default function Devices({ navigation, route }) {
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
      console.error("Error fetching devices:", error);
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

      return {
        ...dev,
        telemetry: tel,
        lastUpdate: tel.timestamp ? new Date(tel.timestamp).toLocaleTimeString() : (dev.lastSeen ? new Date(dev.lastSeen.seconds * 1000).toLocaleTimeString() : "--:--"),
        status: dev.status?.toUpperCase() || "INACTIVE"
      };
    });
  }, [devices, telemetry]);

  const effectiveStatus = useMemo(() => {
    if (!clientData?.subscription) return "LOCKED";

    const sub = clientData.subscription;
    const now = new Date();
    // Format expiration date string or timestamp
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

  const isLocked = effectiveStatus === "LOCKED";


  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [paymentStep, setPaymentStep] = useState('INPUT'); // 'INPUT' or 'SUMMARY'

  const [paymentData, setPaymentData] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });

  const getStatusColor = (status) => {
    if (status === "ACTIVE") return "#00F5C4";
    if (status === "INACTIVE") return "#3A4460";
    return "#FF3B5C";
  };

  const getGasColor = (gas) => {
    if (gas === "NORMAL") return "#00F5C4";
    if (gas === "WARNING") return "#FFB800";
    return "#FF3B5C";
  };

  const handleDevicePress = (device) => {
    navigation.navigate("Accueil", {
      deviceId: device.id,
      deviceName: device.name || device.hardwareId
    });
  };

  const handlePaySubscription = () => {
    console.log("handlePaySubscription triggered");
    // We proceed even if selectedDevice is null (Global Renewal case)
    if (
      !paymentData.cardName.trim() ||
      !paymentData.cardNumber.trim() ||
      !paymentData.expiry.trim() ||
      !paymentData.cvv.trim()
    ) {
      console.log("Validation failed: missing fields");
      Alert.alert(
        "Missing Fields",
        "Please fill in all payment information to continue."
      );
      return;
    }

    console.log("Validation passed, switching to SUMMARY step");
    setPaymentStep('SUMMARY');
  };

  const handleFinalizePayment = async () => {
    console.log("handleFinalizePayment triggered");
    try {
      setLoading(true);
      
      const totalPrice = clientData?.totalBill || 0; 
      
      // 1. Update the Client Subscription (Account Level)
      const clientRef = doc(db, "clients", clientId);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await updateDoc(clientRef, {
        "subscription.status": "active",
        "subscription.paymentStatus": "paid",
        "subscription.endDate": nextMonth.toISOString(),
        "subscription.paymentMethod": "Stripe"
      });

      // 2. Update All Devices for this client
      const batchUpdates = devices.map(d => {
        const dRef = doc(db, "devices", d.id);
        return updateDoc(dRef, { isPaid: true, status: "active" });
      });
      await Promise.all(batchUpdates);

      // Generate PDF Receipt
      const html = `
        <html>
          <body style="font-family: Arial; padding: 40px; background: #f4f4f4;">
            <div style="background: white; padding: 40px; border-radius: 10px; border: 1px solid #ddd;">
              <h1 style="color: #00F5C4;">GLOWIX - ACCOUNT RECEIPT</h1>
              <hr/>
              <p><strong>Client ID:</strong> ${clientId}</p>
              <p><strong>Payment Scope:</strong> Full Account Activation</p>
              <p><strong>Devices Covered:</strong> ${devices.length} Nodes</p>
              <p><strong>Amount Paid:</strong> ${totalPrice.toFixed(2)} EUR</p>
              <p><strong>Payment Status:</strong> PAID (SUCCESS)</p>
              <p><strong>Subscription Expiry:</strong> ${nextMonth.toLocaleDateString()}</p>
              <hr/>
              <p style="color: #666;">This receipt confirms the full renewal of your IoT fleet subscription.</p>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      setPaymentStep('INPUT');
      setShowSubscriptionModal(false);
      setLoading(false);

      Alert.alert(
        "Account Renewed", 
        "Your entire fleet has been successfully activated! Opening receipt...",
        [{ text: "OK", onPress: () => Sharing.shareAsync(uri) }]
      );

    } catch (error) {
      setLoading(false);
      console.error("Payment Error:", error);
      Alert.alert("Error", "Account renewal failed.");
    }
  };

  const handleTestFill = () => {
    setPaymentData({
      cardName: "TEST USER",
      cardNumber: "4242424242424242",
      expiry: "12/28",
      cvv: "123",
    });
  };

  const closeModal = () => {
    setShowSubscriptionModal(false);
    setSelectedDevice(null);
    setPaymentStep('INPUT');
    setPaymentData({
      cardName: "",
      cardNumber: "",
      expiry: "",
      cvv: "",
    });
  };

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
          <Text style={styles.tagline}>DEVICE MANAGEMENT</Text>

          <View style={styles.statusBar}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {devicesWithData.filter((d) => d.status === "ACTIVE").length} /{" "}
              {devicesWithData.length} DEVICES ONLINE
            </Text>
          </View>
        </View>

        {effectiveStatus === "ENDING_SOON" && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ RENEWAL DUE SOON</Text>
            <Text style={styles.warningSubtext}>Your subscription ends in less than 7 days.</Text>
          </View>
        )}

        {isLocked && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedTitle}>ACCOUNT LOCKED</Text>
            <Text style={styles.lockedText}>Controls disabled due to account standing.</Text>
            <TouchableOpacity
              style={styles.renewBtn}
              onPress={() => setShowSubscriptionModal(true)}
            >
              <Text style={styles.renewBtnText}>RENEW SUBSCRIPTION</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLine} />
              <Text style={styles.cardHeaderText}>ALL NODES</Text>
              <View style={styles.cardHeaderLine} />
            </View>

            {devicesWithData.length === 0 ? (
              <Text style={{ color: "#3A4460", textAlign: "center", marginTop: 20 }}>No devices found.</Text>
            ) : (
              devicesWithData.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={[
                    styles.deviceCard,
                    (device.isPaid === false || isLocked) && styles.deviceCardLocked
                  ]}
                  onPress={() => {
                    if (device.isPaid === false || isLocked) {
                      setShowSubscriptionModal(true);
                      return;
                    }

                    if (device.status === "INACTIVE") {
                      Alert.alert(
                        "Appareil Hors Ligne",
                        "Cet appareil n'est pas connecté. Veuillez le mettre sous tension pour accéder au monitoring."
                      );
                      return;
                    }

                    handleDevicePress(device);
                  }}
                  activeOpacity={0.8}
                >
                  {(device.isPaid === false || isLocked) && (
                    <View style={styles.lockOverlay}>
                      <Text style={styles.lockIcon}>🔒</Text>
                    </View>
                  )}
                  <View style={styles.deviceTop}>
                    <View style={styles.deviceLeft}>
                      <View
                        style={[
                          styles.deviceDot,
                          { backgroundColor: getStatusColor(device.status) },
                        ]}
                      />

                      <View>
                        <Text style={styles.deviceName}>{device.name || "UNNAMED DEVICE"}</Text>
                        <Text style={styles.deviceZone}>HW ID : {device.hardwareId || device.id}</Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { borderColor: (device.isPaid === false || isLocked) ? "#FF3B5C" : getStatusColor(device.status) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: (device.isPaid === false || isLocked) ? "#FF3B5C" : getStatusColor(device.status) },
                        ]}
                      >
                        {(device.isPaid === false || isLocked)
                          ? "ABONNEMENT INACTIF"
                          : device.status === "INACTIVE"
                            ? "CONNECTEZ L'APPAREIL"
                            : device.status}
                      </Text>
                    </View>
                  </View>

                  {device.status === "INACTIVE" && !(device.isPaid === false || isLocked) && (
                    <View style={styles.infoBanner}>
                      <Text style={styles.infoText}>⚠️ Vous devez connecter l'appareil pour voir les données.</Text>
                    </View>
                  )}

                  <View style={styles.deviceDivider} />

                  <View style={styles.miniSensors}>
                    {Object.keys(device.telemetry || {})
                      .filter(key => METRICS_CONFIG[key] && !EXCLUDED_KEYS.includes(key))
                      .slice(0, 4)
                      .map(key => {
                        const config = METRICS_CONFIG[key];
                        const val = device.telemetry[key];
                        return (
                          <View key={key} style={styles.miniSensor}>
                            <Text style={styles.miniIcon}>{config.icon}</Text>
                            <Text style={[styles.miniValue, { color: config.color }]}>
                              {typeof val === 'number' ? val.toFixed(key === 'temperature' ? 1 : 0) : val}
                              <Text style={styles.miniUnit}>{config.unit}</Text>
                            </Text>
                          </View>
                        );
                      })}
                    {Object.keys(device.telemetry || {}).filter(key => METRICS_CONFIG[key] && !EXCLUDED_KEYS.includes(key)).length === 0 && (
                      <Text style={{ color: "#3A4460", fontSize: 10 }}>NO DATA AVAILABLE</Text>
                    )}
                  </View>

                  <View style={styles.deviceBottom}>
                    <Text style={styles.lastUpdate}>
                      LAST UPDATE : {device.lastUpdate}
                    </Text>
                    <Text style={styles.arrowIcon}>›</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>● ... ●</Text>
        </View>
      </ScrollView>

      <Modal
        visible={showSubscriptionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>💳</Text>

            {paymentStep === 'INPUT' ? (
              <>
                <Text style={styles.modalTitle}>RENOUVELLEMENT COMPTE</Text>
                <Text style={styles.modalText}>
                  Votre abonnement pour vos {devices.length} devices doit être renouvelé.
                </Text>
                <Text style={styles.modalSubText}>
                  Un seul paiement active l'ensemble de votre flotte IoT.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOM DU TITULAIRE</Text>
                  <TextInput
                    style={styles.paymentInput}
                    placeholder="Ex: Oumaima Alaya"
                    placeholderTextColor="#3A4460"
                    value={paymentData.cardName}
                    onChangeText={(text) => setPaymentData({ ...paymentData, cardName: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NUMÉRO DE CARTE</Text>
                  <TextInput
                    style={styles.paymentInput}
                    placeholder="1234567890123456"
                    placeholderTextColor="#3A4460"
                    keyboardType="numeric"
                    maxLength={16}
                    value={paymentData.cardNumber}
                    onChangeText={(text) => setPaymentData({ ...paymentData, cardNumber: text.replace(/[^0-9]/g, "") })}
                  />
                </View>

                <View style={styles.paymentRow}>
                  <View style={styles.smallInputBox}>
                    <Text style={styles.inputLabel}>EXPIRATION</Text>
                    <TextInput
                      style={styles.paymentInput}
                      placeholder="MM/AA"
                      placeholderTextColor="#3A4460"
                      maxLength={5}
                      value={paymentData.expiry}
                      onChangeText={(text) => setPaymentData({ ...paymentData, expiry: text })}
                    />
                  </View>
                  <View style={styles.smallInputBox}>
                    <Text style={styles.inputLabel}>CVV</Text>
                    <TextInput
                      style={styles.paymentInput}
                      placeholder="123"
                      placeholderTextColor="#3A4460"
                      keyboardType="numeric"
                      maxLength={3}
                      secureTextEntry={true}
                      value={paymentData.cvv}
                      onChangeText={(text) => setPaymentData({ ...paymentData, cvv: text.replace(/[^0-9]/g, "") })}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.testBtn} onPress={handleTestFill} activeOpacity={0.8}>
                  <Text style={styles.testBtnText}>TEST FILL (AUTO)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.payBtn} onPress={handlePaySubscription} activeOpacity={0.8}>
                  <Text style={styles.payBtnText}>VALIDER LE PAIEMENT</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>RÉSUMÉ DU PAIEMENT</Text>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRowItem}>
                    <Text style={styles.summaryLabel}>Produit:</Text>
                    <Text style={styles.summaryValue}>Abonnement Compte (Tout)</Text>
                  </View>
                  <View style={styles.summaryRowItem}>
                    <Text style={styles.summaryLabel}>Devices:</Text>
                    <Text style={styles.summaryValue}>{devices.length} Nodes actifs</Text>
                  </View>
                  <View style={styles.summaryRowItem}>
                    <Text style={styles.summaryLabel}>Total Bill:</Text>
                    <Text style={[styles.summaryValue, { color: PRIMARY }]}>
                      {clientData?.totalBill?.toFixed(2) || "0.00"} EUR
                    </Text>
                  </View>
                  <View style={styles.summaryRowItem}>
                    <Text style={styles.summaryLabel}>Carte:</Text>
                    <Text style={styles.summaryValue}>**** **** **** {paymentData.cardNumber.slice(-4)}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.payBtn} onPress={handleFinalizePayment} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.payBtnText}>VERIFIE & PAYER</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backBtnModal} onPress={() => setPaymentStep('INPUT')}>
                  <Text style={styles.backBtnTextModal}>RETOUR</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>ANNULER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

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

  deviceCard: {
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },

  deviceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  deviceLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  deviceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  deviceName: {
    color: "#E0E8FF",
    fontSize: 15,
    fontWeight: "800",
  },

  deviceZone: {
    color: "#3A4460",
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  statusBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  deviceDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 12,
  },

  miniSensors: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  miniSensor: {
    alignItems: "center",
    flex: 1,
  },

  miniIcon: {
    color: "#3A4460",
    fontSize: 12,
    marginBottom: 4,
  },

  miniValue: {
    color: "#E0E8FF",
    fontSize: 12,
    fontWeight: "700",
  },

  miniUnit: {
    fontSize: 8,
    color: "#3A4460",
  },

  deviceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  lastUpdate: {
    color: "#3A4460",
    fontSize: 10,
    letterSpacing: 1,
  },

  arrowIcon: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "900",
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  modalCard: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: "center",
  },

  modalIcon: {
    fontSize: 36,
    marginBottom: 12,
  },

  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: "center",
  },

  modalText: {
    color: "#E0E8FF",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 8,
  },

  modalSubText: {
    color: "#3A4460",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },

  inputGroup: {
    width: "100%",
    marginBottom: 12,
  },

  inputLabel: {
    color: "#3A4460",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  paymentInput: {
    width: "100%",
    height: 46,
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#E0E8FF",
    fontSize: 13,
    fontWeight: "700",
  },

  paymentRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },

  smallInputBox: {
    flex: 1,
  },

  payBtn: {
    width: "100%",
    height: 50,
    backgroundColor: "rgba(0,245,196,0.15)",
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  payBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  cancelBtn: {
    width: "100%",
    height: 46,
    backgroundColor: "#080C18",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelBtnText: {
    color: "#3A4460",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  // ─── Effective Status Styles ──────────────────────────────────────────────
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
  lockedBanner: {
    backgroundColor: "rgba(255, 59, 92, 0.15)",
    marginHorizontal: 20,
    marginTop: 15,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FF3B5C",
    alignItems: "center",
  },
  lockedTitle: {
    color: "#FF3B5C",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  lockedText: {
    color: "#E0E8FF",
    fontSize: 12,
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 16,
  },
  renewBtn: {
    backgroundColor: "#FF3B5C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  renewBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  deviceCardLocked: {
    opacity: 0.6,
  },
  lockOverlay: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 10,
  },
  lockIcon: {
    fontSize: 18,
  },
  infoBanner: {
    backgroundColor: "rgba(0, 245, 196, 0.05)",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 196, 0.2)",
  },
  infoText: {
    color: "#E0E8FF",
    fontSize: 10,
    textAlign: "center",
    fontStyle: "italic",
  },
  testBtn: {
    backgroundColor: "rgba(0, 245, 196, 0.1)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderStyle: "dashed",
  },
  testBtnText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  summaryRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: "#3A4460",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  backBtnModal: {
    paddingVertical: 12,
    alignItems: "center",
  },
  backBtnTextModal: {
    color: "#3A4460",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: 'underline',
  }
});