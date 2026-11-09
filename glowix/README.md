# Glowix Node & Fleet Management Platform

![Enterprise Plateform](/logo.svg)
## ◈ Introduction

**Glowix** is a production-grade, enterprise-ready IoT Fleet Management and SaaS Billing platform. It provides a unified interface for monitoring global device networks, managing client subscriptions, and analyzing real-time telemetry flux. Built with a focus on high-performance observability and security, Glowix empowers organizations to oversee thousands of decentralized nodes with millisecond precision.

---

## ◈ Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Firestore Architecture](#firestore-architecture)
4. [Core Systems](#core-systems)
    - [Real-time Telemetry](#real-time-telemetry)
    - [Client & Subscription Engine](#client--subscription-engine)
    - [Fleet Management](#fleet-management)
    - [Alerting & Audit Hub](#alerting--audit-hub)
5. [Technology Stack](#technology-stack)
6. [Data Flow & Integration](#data-flow--integration)
7. [Security Architecture](#security-architecture)
8. [Getting Started](#getting-started)
9. [Deployment & Scaling](#deployment--scaling)

---

## ◈ Architecture Overview

The platform follows a **Clean Architecture** pattern, enforcing a strict separation between domain logic, data infrastructure, and UI representation.

### High-Level Blueprint
- **Frontend (Presentation):** React 19 + Vite (SPA)
- **Styling:** Tailwind CSS 4.0
- **Backend (Infrastructure):** Firebase (Firestore + Auth)
- **Data Synchronicity:** Real-time WebSockets (Firestore `onSnapshot`)
- **Analytics Engine:** Automated health diagnostics and telemetry monitoring

---

## ◈ Directory Structure

### Root Configuration
- `.env.example`: Template for required environment variables (Firebase keys, etc.)
- `firebase-blueprint.json`: The **Intermediate Representation (IR)** of our data model. Defines entities (Client, Device, Telemetry) and their Firestore mappings.
- `firestore.rules`: Hardened attribute-based access control (ABAC) rules ensuring zero-trust security.
- `package.json`: Manifest of dependencies, including `motion`, `recharts`, `firebase`, and `shadcn`.
- `metadata.json`: Platform-level permissions and application identity.

### `/src` - The Source Core
The `src` directory is organized by feature and responsibility:

#### 📂 `src/core`
The backbone of the application.
- `auth/`: Contains `auth-context.tsx` which handles the global user state and Firebase session persistence.
- `models/`: Defines TypeScript interfaces and enums (e.g., `iot.types.ts`) used across the fleet.
- `services/`: The **Infrastructure Layer**.
    - `data-service.ts`: Abstraction for Firestore operations (CRUD + Real-time subscriptions). Handles error wrapping and schema validation.
    - `firebase.ts`: Initialization point for the Firebase SDK.
- `utils/`: Common helpers (`cn()` for Tailwind, date formatters, and mathematical utilities for telemetry distribution).
- `security_spec.md` (root): Detailed security invariants and penetration test plan.
- `firebase-blueprint.json` (root): Standardized data IR for schema consistency.

#### 📂 `src/features`
Modular domain-specific logic. Each folder represents a full feature slice.
- `auth/`: User authentication UI (Login/Logout).
- `clients/`: Management of the client registry, geographic distribution, and individual profiles.
- `dashboard/`: The mission control center. Includes the Signal Flux Distribution chart, Revenue Intelligence, and Global Presence map.
- `devices/`: Fleet-wide control panel. Handles device blocking, activation, and status monitoring.
- `notifications/`: The **Audit Hub**. Tracks critical incidents, system events, and filtered alert streams.
- `settings/`: Global configuration, profile management, and a Developer Environment for seeding demo data.
- `subscriptions/`: Billing engine. Manages plan tiers, MRR projections, and billing cycles.

#### 📂 `src/components`
Reusable UI components.
- `layout/`: Persistent structural components (Sidebar, TopBar).
- `ui/`: Primitives from shadcn/ui (Button, Card, Progress, Badge, etc.).
- `GlobalMap.tsx`: Interactive SVG/D3-powered visualization of node coordinates.

---

## ◈ Firestore Architecture

Glowix utilizes a flat, high-performance NoSQL schema optimized for real-time reads and timeseries telemetry.

### Collections & Schemas

| Path | Entity | Description |
| :--- | :--- | :--- |
| `/clients/{id}` | **Client** | Stores client profiles, contact info, and current subscription state. |
| `/plans/{id}` | **Plan** | Definition of subscription tiers (pricing models, device limits). |
| `/devices/{id}` | **Device** | Register of all IoT nodes, including lifecycle status and security flags. |
| `/telemetry/{id}` | **Telemetry** | Timeseries flux data containing sensor readings and signal metrics. |
| `/alerts/{id}` | **Alert** | Immutable log of threshold violations and system critical incidents. |

### Database Structure Details

#### 1. Clients (`/clients`)
```typescript
interface Client {
  name: string;
  email: string;
  phone: string;
  createdAt: Timestamp;
  totalBill: number;
  address: {
    country: string;
    city: string;
    countryCode: string;
    flagUrl: string;
    coordinates: { lat: number; lng: number; };
  };
  subscription: {
    status: 'active' | 'expired' | 'pending' | 'unpaid' | 'terminated';
    startDate: Timestamp;
    endDate: Timestamp;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    paymentStatus: 'paid' | 'unpaid' | 'pending';
  };
}
```

#### 2. Devices (`/devices`)
```typescript
interface Device {
  name: string;
  clientId: string;
  status: 'active' | 'inactive' | 'terminated' | 'error';
  isPaid: boolean;
  isBlocked: boolean;
  lastSeen: Timestamp;
}
```

#### 3. Telemetry (`/telemetry`)
```typescript
interface TelemetryData {
  deviceId: string;
  timestamp: number;
  values: {
    [metric: string]: number | string; // e.g., { RSSI: -65, battery: 85 }
  };
}
```

#### 4. Alerts (`/alerts`)
```typescript
interface Alert {
  deviceId: string;
  clientId: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  value: number;
  timestamp: number;
}
```

### Data Entities
- **Client:** Includes nested objects for global coordinates and detailed contract history.
- **Telemetry:** Designed for high-frequency writes with dynamic `values` maps to support heterogeneous device types.
- **Alerts:** Relational links to both `deviceId` and `clientId` for efficient cross-referencing in the Audit Hub.

---

## ◈ Core Systems

### 1. Real-time Telemetry
The heart of Glowix is the **Telemetry Pipeline**. Devices emit data packages (RSSI, load, temperature) into Firestore. The `telemetryService` establishes a real-time listener:
- **Flux Distribution:** Uses specialized binning logic in `Dashboard.tsx` to generate a signal strength histogram.
- **History Tracking:** Visualizes device performance over time using `recharts`.

### 2. Client & Subscription Engine
A robust SaaS billing layer:
- **Status Lifecycle:** Tracks subscriptions through `active`, `expired`, `pending`, and `terminated` states.
- **Revenue Logic:** Calculates Projected vs. Live MRR (Monthly Recurring Revenue) based on plan tiers and billing cycles.

### 3. Fleet Management
Provides granular control over the edge:
- **Hardware Lockdown:** Remote blocking of compromised nodes.
- **Health Indicators:** Color-coded status badges reflecting real-time connectivity states.

---

## ◈ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js / TypeScript |
| **Framework** | React 19 (Functional Hooks) |
| **Build Tool** | Vite |
| **Database** | Google Cloud Firestore |
| **Auth** | Firebase Authentication |
| **Charts** | Recharts (D3-based) |
| **Animations** | Motion (formerly Framer Motion) |
| **Icons** | Lucide React |

---

## ◈ Data Flow & Integration

1. **User Action:** User clicks "Block Device" in `Devices.tsx`.
2. **Service Call:** `deviceService.updateDevice` is triggered.
3. **Database Write:** A secure transaction updates the `isBlocked` flag in Firestore.
4. **Subscription Sync:** All active dashboard sessions receive a real-time update via `onSnapshot`.
5. **UI Update:** The device status badge turns red immediately across the entire fleet without a page refresh.

---

## ◈ Security Architecture

Glowix implements a **Zero-Trust Security Model** as defined in `security_spec.md`:
- **Identity Integrity:** All writes must match the `request.auth.uid`.
- **Validation Blueprints:** Custom `isValid[Entity]` functions in Firestore rules prevent "Shadow Updates" or malformed data injection.
- **Action-Based Protection:** Updates use `affectedKeys().hasOnly()` gates to ensure only specific fields (like `status`) can be changed by certain roles.
- **PII Isolation:** Strict access control on PII (Personally Identifiable Information) in client profiles.

---

## ◈ Getting Started

### Prerequisites
- Node.js 18+
- A configured Firebase Project

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env`:
   ```bash
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_PROJECT_ID=your_id
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## ◈ Naming Conventions & Organization
- **PascalCase** for React Components (`Dashboard.tsx`).
- **camelCase** for utilities and service functions.
- **Feature-first** structure: Logic, UI, and hooks for a feature live together to ensure high cohesion.

---

## ◈ Future Improvements
- **Multi-region Relay Clusters:** Improved latency for global nodes.
- **Predictive Analytics:** Failure probability analysis based on telemetry patterns.
- **Hardware Root-of-Trust:** Direct TPM integration for device identity.

---

*Glowix Node & Fleet Management is a property of the Glowix Ecosystem. Built for performance, security, and global scale.*
