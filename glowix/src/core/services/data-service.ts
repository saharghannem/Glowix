import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Client, Device, TelemetryData, Alert, Plan } from '../models/iot.types';
import { toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error:', jsonError);
  throw new Error(jsonError);
}

/**
 * Recursively cleans Firestore payloads by removing keys with undefined values.
 * Firestore throws a runtime error if undefined is passed anywhere in an object.
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeFirestoreData) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Timestamp)) {
    const clean: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        clean[key] = sanitizeFirestoreData(val);
      }
    }
    return clean;
  }
  return data;
}

// Helper to wrap firestore operations with error handling
const handleAsync = async <T,>(promise: Promise<T>, op: OperationType, path: string): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    handleFirestoreError(error, op, path);
    throw error; // unreachable but satisfies TS
  }
};

export const clientService = {
  subscribeToClients: (callback: (clients: Client[]) => void) => {
    const path = 'clients';
    return onSnapshot(collection(db, path), (snapshot) => {
      const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      callback(clients);
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
  },

  createClient: async (client: Omit<Client, 'id' | 'totalBill'> & { totalBill?: number }) => {
    const path = 'clients';
    
    // Check for existing subscription by email
    const q = query(collection(db, path), where('email', '==', client.email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error('A subscription with this email already exists.');
    }
    
    // Business Logic: First month free for first-time registrants
    const now = new Date();
    const freeUntil = new Date();
    freeUntil.setMonth(now.getMonth() + 1);
    const billingStart = new Date(freeUntil);
    const billingEnd = new Date(billingStart);
    billingEnd.setFullYear(billingStart.getFullYear() + 1);

    const rawData = {
      ...client,
      subscription: {
        ...client.subscription,
        startDate: client.subscription.startDate || now.toISOString(),
        endDate: client.subscription.endDate || billingEnd.toISOString(),
        isFirstMonthFree: client.subscription.isFirstMonthFree ?? true,
        paymentStatus: client.subscription.paymentStatus || 'paid',
        status: client.subscription.status || 'active'
      },
      createdAt: client.createdAt || serverTimestamp(),
      totalBill: client.totalBill ?? 0,
      contractHistory: []
    };

    const data = sanitizeFirestoreData(rawData);
    const docRef = await handleAsync(addDoc(collection(db, path), data), OperationType.CREATE, path);
    return { id: docRef.id, ...data } as Client;
  },

  ensureClient: async (client: Omit<Client, 'id' | 'totalBill'> & { totalBill?: number }) => {
    const path = 'clients';
    const q = query(collection(db, path), where('email', '==', client.email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client;
    }
    return clientService.createClient(client);
  },

  getEffectiveStatus: (client: Client) => {
    const now = new Date();
    const endDate = new Date(client.subscription.endDate);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check trial status
    if (client.subscription.isFirstMonthFree) {
      const startDate = new Date(client.subscription.startDate).getTime();
      const trialDuration = 30 * 24 * 60 * 60 * 1000;
      if (now.getTime() - startDate > trialDuration && client.subscription.paymentStatus === 'unpaid') {
        return 'trial-expired';
      }
    }

    if (client.subscription.status === 'terminated') return 'terminated';
    if (client.subscription.paymentStatus === 'unpaid') return 'unpaid';
    if (now > endDate) return 'expired';
    if (diffDays <= 7 && diffDays > 0) return 'ending-soon';
    if (client.subscription.paymentStatus === 'pending') return 'pending';
    
    return client.subscription.status;
  },

  checkSubscriptionAlerts: async (clients: Client[]) => {
    const path = 'alerts';
    for (const client of clients) {
      const status = clientService.getEffectiveStatus(client);
      let message = '';
      let severity: 'critical' | 'warning' | 'info' = 'info';
      let eventKey = '';

      if (status === 'trial-expired') {
        message = `Trial period expired for organization "${client.name}". Payment required.`;
        severity = 'critical';
        eventKey = `trial-expired-${client.id}`;
      } else if (status === 'expired') {
        message = `Contract for organization "${client.name}" has expired. Services restricted.`;
        severity = 'critical';
        eventKey = `expired-${client.id}`;
      } else if (status === 'unpaid') {
        message = `Organization "${client.name}" has an unpaid balance. Please settle payment to avoid interruption.`;
        severity = 'critical';
        eventKey = `unpaid-${client.id}`;
      } else if (status === 'ending-soon') {
        message = `Subscription for "${client.name}" is about to end (less than 7 days remaining).`;
        severity = 'warning';
        eventKey = `ending-soon-${client.id}`;
      } else if (status === 'pending') {
        message = `Payment for "${client.name}" is pending. Monitor for settlement.`;
        severity = 'info';
        eventKey = `pending-payment-${client.id}`;
      }

      if (eventKey) {
        try {
          // Check if this alert already exists
          const q = query(
            collection(db, path), 
            where('eventKey', '==', eventKey)
          );
          const snapshot = await getDocs(q);
          
          const existingAlerts = snapshot.docs.map(d => d.data());
          const hasUnseen = existingAlerts.some(d => !d.isSeen);
          
          // Only create if there's no unseen alert of this type,
          // OR if the last one was more than 24 hours ago (if it was seen)
          const latestAlert = existingAlerts.sort((a,b) => b.timestamp - a.timestamp)[0];
          const oneDay = 24 * 60 * 60 * 1000;
          const isStale = latestAlert && (Date.now() - latestAlert.timestamp > oneDay);
          
          if (!hasUnseen && (!latestAlert || isStale)) {
            await telemetryService.createAlert({
              deviceId: 'SYSTEM',
              clientId: client.id,
              message,
              timestamp: Date.now(),
              type: 'status',
              value: 0,
              isSeen: false,
              severity,
              eventKey
            });
          }
        } catch (error) {
          console.warn('Subscription alert check failed:', error);
        }
      }
    }
  },

  updateClient: async (id: string, updates: Partial<Client>) => {
    const path = `clients/${id}`;
    const cleanUpdates = sanitizeFirestoreData(updates);
    return handleAsync(updateDoc(doc(db, 'clients', id), cleanUpdates), OperationType.UPDATE, path);
  },

  deleteClient: async (id: string) => {
    const path = `clients/${id}`;
    // Cascade delete: find all devices for this client
    const devicePath = 'devices';
    const q = query(collection(db, devicePath), where('clientId', '==', id));
    const snapshot = await getDocs(q);
    
    // Perform deletions
    const deletions = snapshot.docs.map(d => handleAsync(deleteDoc(doc(db, devicePath, d.id)), OperationType.DELETE, `${devicePath}/${d.id}`));
    deletions.push(handleAsync(deleteDoc(doc(db, 'clients', id)), OperationType.DELETE, path));
    
    return Promise.all(deletions);
  }
};

export const planService = {
  subscribeToPlans: (callback: (plans: Plan[]) => void) => {
    const path = 'plans';
    return onSnapshot(collection(db, path), (snapshot) => {
      const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
      callback(plans);
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
  },

  createPlan: async (plan: Omit<Plan, 'id'>) => {
    const path = 'plans';
    
    // Check for existing plan Name
    const q = query(collection(db, path), where('name', '==', plan.name));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error('A plan with this name already exists.');
    }

    return handleAsync(addDoc(collection(db, path), plan), OperationType.CREATE, path);
  },

  ensurePlan: async (plan: Omit<Plan, 'id'>) => {
    const path = 'plans';
    const q = query(collection(db, path), where('name', '==', plan.name));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Plan;
    }
    return planService.createPlan(plan);
  },

  updatePlan: async (id: string, updates: Partial<Plan>) => {
    const path = `plans/${id}`;
    return handleAsync(updateDoc(doc(db, 'plans', id), updates), OperationType.UPDATE, path);
  },

  deletePlan: async (id: string) => {
    const path = `plans/${id}`;
    return handleAsync(deleteDoc(doc(db, 'plans', id)), OperationType.DELETE, path);
  },

  seedPlans: async () => {
    const path = 'plans';
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      const defaultPlans: Omit<Plan, 'id'>[] = [
        {
          name: 'Starter Tier',
          price: 29,
          maxDevices: 5,
          pricingModel: 'flat',
          features: ['Real-time Telemetry', '5 Node Limit', 'Basic Support']
        },
        {
          name: 'Professional',
          price: 15,
          maxDevices: 50,
          pricingModel: 'per_device',
          features: ['Advanced Analytics', '50 Node Limit', 'Email Alerts', 'Priority Support']
        },
        {
          name: 'Enterprise Matrix',
          price: 10,
          maxDevices: 500,
          pricingModel: 'per_device',
          features: ['Global Node Presence', 'Infinite Scaling', 'Dedicated API', '24/7 Phone Support']
        }
      ];
      for (const plan of defaultPlans) {
        await addDoc(collection(db, path), plan);
      }
    }
  }
};

export const deviceService = {
  subscribeToDevices: (callback: (devices: Device[]) => void) => {
    const path = 'devices';
    return onSnapshot(collection(db, path), (snapshot) => {
      const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
      callback(devices);
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
  },

  createDevice: async (device: Omit<Device, 'id' | 'lastSeen'> & { lastSeen?: string }) => {
    const path = 'devices';
    
    // Check for existing device name for this client
    const qName = query(collection(db, path), where('name', '==', device.name), where('clientId', '==', device.clientId));
    const snapshotName = await getDocs(qName);
    if (!snapshotName.empty) {
      throw new Error('A device with this name already exists for this organization.');
    }

    // Check for existing hardware ID
    const qHardware = query(collection(db, path), where('hardwareId', '==', device.hardwareId));
    const snapshotHardware = await getDocs(qHardware);
    if (!snapshotHardware.empty) {
      throw new Error('This hardware ID is already registered in the system.');
    }

    const data = sanitizeFirestoreData({
      status: 'inactive',
      isPaid: true,
      lastSeen: new Date().toISOString(),
      ...device
    });

    const docRef = await handleAsync(addDoc(collection(db, path), data), OperationType.CREATE, path);
    return { id: docRef.id, ...data } as Device;
  },

  ensureDevice: async (device: Omit<Device, 'id' | 'lastSeen'> & { lastSeen?: string }) => {
    const path = 'devices';
    const q = query(collection(db, path), where('hardwareId', '==', device.hardwareId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Device;
    }
    return deviceService.createDevice(device);
  },

  syncDevicePaymentStatus: async (clientId: string, isPaid: boolean) => {
    const path = 'devices';
    const q = query(collection(db, path), where('clientId', '==', clientId));
    const snapshot = await getDocs(q);
    
    const updates = snapshot.docs.map(d => 
      handleAsync(updateDoc(doc(db, path, d.id), { isPaid }), OperationType.UPDATE, `${path}/${d.id}`)
    );
    
    return Promise.all(updates);
  },

  updateDevice: async (id: string, updates: Partial<Device>) => {
    const path = `devices/${id}`;
    return handleAsync(updateDoc(doc(db, 'devices', id), sanitizeFirestoreData(updates)), OperationType.UPDATE, path);
  },

  deleteDevice: async (id: string) => {
    const path = `devices/${id}`;
    return handleAsync(deleteDoc(doc(db, 'devices', id)), OperationType.DELETE, path);
  }
};

export const telemetryService = {
  subscribeToTelemetry: (deviceId: string, hardwareId: string | undefined, callback: (data: TelemetryData[]) => void) => {
    const path = 'telemetry';
    // Fetch a larger window to ensure we catch enough data for in-memory filtering
    // Since we don't have composite indexes for every device, we fetch the latest global activity
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc'),
      limit(1000) 
    );
    
    return onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs
          .map(doc => doc.data() as TelemetryData)
          .filter(d => {
            // Match by either internal Firestore ID or physical Hardware ID
            return d.deviceId === deviceId || 
                   (hardwareId && d.deviceId === hardwareId) || 
                   (hardwareId && d.hardwareId === hardwareId);
          });
        callback(data.reverse()); // Chronological for charts
      },
      (error) => {
        if (error.code === 'failed-precondition') {
          toast.error("Telemetry index build required. Filtering in-memory...");
        } else {
          handleFirestoreError(error, OperationType.GET, path);
        }
      }
    );
  },

  subscribeToAlerts: (callback: (alerts: Alert[]) => void, limitCount: number = 100, includeSeen: boolean = false) => {
    const path = 'alerts';
    
    // If we only want unseen, we should ideally filter by isSeen in the query
    // But this requires composite index (isSeen + timestamp).
    // Let's try the direct query first, then fallback to memory filter of a larger set
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc'),
      limit(includeSeen ? limitCount : 300) // Increase fetch size if we need to filter in-memory
    );
    
    return onSnapshot(q, 
      (snapshot) => {
        let alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
        if (!includeSeen) {
          alerts = alerts.filter(a => !a.isSeen);
        }
        callback(alerts.slice(0, limitCount));
      },
      (error) => {
        if (error.code === 'failed-precondition') {
          // If index is missing, fetch without order as fallback
          onSnapshot(collection(db, path), (snapshot) => {
             let alerts = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Alert))
                .sort((a, b) => b.timestamp - a.timestamp);
             
             if (!includeSeen) {
               alerts = alerts.filter(a => !a.isSeen);
             }
             callback(alerts.slice(0, limitCount));
          });
        } else {
          handleFirestoreError(error, OperationType.GET, path);
        }
      }
    );
  },

  markAlertAsSeen: async (alertId: string) => {
    const path = `alerts/${alertId}`;
    return handleAsync(updateDoc(doc(db, 'alerts', alertId), { isSeen: true }), OperationType.UPDATE, path);
  },

  createAlert: async (alert: Omit<Alert, 'id'>) => {
    const path = 'alerts';
    return handleAsync(addDoc(collection(db, path), alert), OperationType.CREATE, path);
  }
};
