/**
 * Type definitions for the IoT SaaS platform.
 */

export type SubscriptionStatus = 'active' | 'expired' | 'pending' | 'unpaid' | 'ending-soon' | 'terminated';

export interface Subscription {
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  planId?: string;
  isFirstMonthFree?: boolean;
  billingCycle: 'monthly' | 'yearly';
  customPrice?: number | null;
  paymentMethod?: string;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  maxDevices: number; // For tiered plans
  pricingModel: 'flat' | 'per_device';
  features: string[];
}

export interface Client {
  id: string;
  email: string;
  name: string;
  phone: string;
  password?: string;
  createdAt: string;
  address?: {
    country: string;
    city: string;
    countryCode: string;
    flagUrl?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  subscription: Subscription;
  totalBill: number;
  contractHistory?: Subscription[];
}

export interface Device {
  id: string;
  hardwareId: string;
  name: string;
  clientId: string;
  status: 'active' | 'inactive' | 'terminated' | 'error';
  isPaid: boolean;
  lastSeen: string;
}

export interface TelemetryData {
  deviceId: string;
  hardwareId: string;
  values: Record<string, number | string | boolean>;
  timestamp: number;
}

export interface Alert {
  id: string;
  deviceId: string;
  clientId?: string;
  message: string;
  timestamp: number;
  type: 'temperature' | 'humidity' | 'status';
  value: number;
  isSeen?: boolean;
  severity?: 'critical' | 'warning' | 'info';
  eventKey?: string;
}
