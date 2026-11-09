# 🌐 Glowix IoT Ecosystem

An end-to-end, multi-tenant IoT Fleet Management, Real-Time Monitoring, and Subscription Billing platform.

The ecosystem connects physical **ESP32 hardware nodes** to the cloud via **Firebase Firestore**, providing a **Web Admin Dashboard** for fleet management and a **Mobile Application** for tenant monitoring.

---

## ◈ System Architecture

```text
 ┌──────────────────────┐
 │   ESP32 Node         │
 │   - Physical Sensors │
 │   - Captive WiFi     │
 └──────────┬───────────┘
            │  HTTPS / WebSockets
            ▼
 ┌──────────────────────────────────────────────┐
 │             Firebase Cloud Backend           │
 │  - Cloud Firestore (Real-time DB)            │
 │  - Firebase Authentication                   │
 │  - Security Rules & Access Control           │
 └──────────┬───────────────────────────┬───────┘
            │                           │
            ▼                           ▼
 ┌──────────────────────┐    ┌──────────────────────┐
 │  Glowix Web Admin    │    │  IoT Connect Mobile  │
 │  - React 19 + Vite   │    │  - React Native/Expo │
 │  - Global Fleet Map  │    │  - Tenant Monitoring │
 │  - Subscriptions/MRR │    │  - In-App Renewal    │
 └──────────────────────┘    └──────────────────────┘
```

---

## ◈ Project Components

| Directory | Module | Technology Stack | Purpose |
| :--- | :--- | :--- | :--- |
| **[`glowix/`](./glowix)** | Web Admin Portal | React 19, TypeScript, Vite, Tailwind CSS, Recharts | Central management portal for administrators: client accounts, plans, billing, device assignments, and geospatial map tracking. |
| **[`Projet Iot/`](./Projet%20Iot)** | Mobile Application | React Native, Expo, React Navigation | Client-facing dark-mode mobile dashboard: live telemetry, threshold alerts, device status, and automated subscription renewal. |
| **[`esp32_firebase/`](./esp32_firebase)** | Embedded Firmware | C++, Arduino Core for ESP32, Firebase ESP Client | Edge firmware: on-device sensor sampling, local web captive portal for WiFi onboarding, threshold checks, and Firestore synchronization. |

---

## ◈ Key Capabilities

- **Multi-Tenant Isolation:** Zero-trust data segregation—clients only access devices linked to their specific `clientId`.
- **Real-Time Sensor Telemetry:** Streaming data pipeline for:
  - Temperature (°C)
  - Humidity (%)
  - CO2 & Gas Concentration (ppm / raw ADC)
  - Air Quality Index (AQI)
  - Ambient Light (lux)
  - Battery / Supply Voltage (V)
  - Barometric Pressure (hPa)
- **Automated Alerting Engine:** Edge-level and cloud-level threshold monitoring with automatic severity classification (`warning`, `critical`, `resolved`).
- **Subscription Lifecycle Management:** Tiered (flat) and per-device billing models with trial periods, payment tracking, and automated service locking for delinquent accounts.
- **Interactive Global Geospatial Map:** Google Maps Platform integration for pinpointing active nodes and client facilities worldwide.
- **Zero-Friction WiFi Provisioning:** On-board ESP32 captive portal (AP mode at `192.168.4.1`) allows WiFi credentials to be saved into non-volatile flash storage (`Preferences`).

---

## ◈ Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher) & **npm**
- **Expo CLI** (`npm install -g expo-cli`)
- **Arduino IDE** (v2.x) with the **ESP32 Board Package** installed
- A **Firebase Project** with Firestore and Authentication enabled

---

### 2. Configuration & Credentials

All sensitive credentials use template example files. Copy each example file to configure your local credentials:

#### A. Web Admin Portal (`glowix`)
```bash
cd glowix
cp .env.example .env
cp src/core/services/firebase.example.ts src/core/services/firebase.ts
```
Fill in your Firebase config in `src/core/services/firebase.ts` and your optional Google Maps API key in `.env`:
```env
GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key_here
```

#### B. Mobile Application (`Projet Iot`)
```bash
cd "Projet Iot"
cp Firebase.example.js Firebase.js
```
Update `Firebase.js` with your Firebase project keys.

#### C. ESP32 Node (`esp32_firebase`)
Open `esp32_firebase/esp32_firebase.ino` (or start from `esp32_firebase.example.ino`) and configure:
```cpp
#define API_KEY             "YOUR_FIREBASE_API_KEY"
#define FIREBASE_PROJECT_ID "YOUR_FIREBASE_PROJECT_ID"
String deviceId           = "dev2002"; // Hardware UUID registered in Firestore
```

---

### 3. Installation & Running

#### Run the Web Admin Portal (`glowix`)
```bash
cd glowix
npm install
npm run dev
```
The dashboard will be available at `http://localhost:3000`.

#### Run the Mobile Application (`Projet Iot`)
```bash
cd "Projet Iot"
npm install
npx expo start
```
Scan the QR code with the **Expo Go** app on Android or iOS.

#### Flash the ESP32 Hardware
1. Connect your ESP32 board via USB.
2. In Arduino IDE, install the `Firebase ESP Client` library by Mobizt.
3. Open `esp32_firebase/esp32_firebase.ino`.
4. Select your board (e.g., *ESP32 Dev Module*) and COM port.
5. Upload the sketch.
6. On first boot, connect to the WiFi access point `ESP32_SETUP` (password: `12345678`) and submit your local WiFi credentials via the web captive portal.

---

## ◈ Hardware Pinout (ESP32)

| Sensor / Component | Type | ESP32 GPIO | Description |
| :--- | :--- | :--- | :--- |
| **Temperature Sensor** | Analog / ADC | `GPIO 35` (ADC1_CH7) | Scaled analog temperature voltage |
| **MQ-135 Gas / Air Sensor** | Analog / ADC | `GPIO 34` (ADC1_CH6) | Gas concentration & air quality |
| **LDR Photoresistor** | Analog / ADC | `GPIO 32` (ADC1_CH4) | Ambient light measurement |
| **Battery Voltage Divider** | Analog / ADC | `GPIO 33` (ADC1_CH5) | 2:1 resistor divider for LiPo monitoring |
| **Reset / Factory Button** | Digital Input | `GPIO 0` (BOOT) | Hold for 5s to wipe saved WiFi settings |

*Note: All analog inputs use ADC1 channels, ensuring WiFi and analog sampling function simultaneously without conflict.*

---

## ◈ Firestore Data Collections

```text
├── clients/
│   └── {clientId}
│       ├── name, email, phone, createdAt
│       ├── address: { country, city, countryCode, flagUrl, coordinates: { lat, lng } }
│       └── subscription: { planId, status, billingCycle, startDate, endDate, paymentStatus }
│
├── devices/
│   └── {deviceId}
│       ├── hardwareId ("dev2002")
│       ├── clientId
│       ├── name, status ("active" | "inactive")
│       └── isPaid, lastSeen
│
├── telemetry/
│   └── {telemetryId}
│       ├── hardwareId, deviceId, clientId, timestamp
│       └── values: { temperature, humidity, co2, gas, airQuality, pressure, light, voltage }
│
├── alerts/
│   └── {alertId}
│       ├── clientId, deviceId, type, severity, message, timestamp, isSeen
│
└── plans/
    └── {planId}
        ├── name, price, maxDevices, pricingModel, features
```

---

## ◈ Security & Privacy

- **Sanitized Repositories:** No production API keys, passwords, or Firebase private secrets are committed to version control.
- **Root `.gitignore`:** Automatically ignores build folders (`dist/`, `build/`, `.expo/`), dependencies (`node_modules/`), local environment secrets (`.env*`), and private credential backups (`*.local.*`).
- **Granular Firestore Rules:** Defined in [`glowix/firestore.rules`](./glowix/firestore.rules) enforcing role-based client isolation and validation schemas.

---

## ◈ License

This project is open-source and available under the [MIT License](LICENSE).
