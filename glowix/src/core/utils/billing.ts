import { Client, Plan, Device } from '../models/iot.types';

export const calculateClientBill = (client: Client, plans: Plan[], devices: Device[], ignoreTrial: boolean = false) => {
  // Priority 0: First Month Free logic
  if (!ignoreTrial && client.subscription.isFirstMonthFree) {
    const startDate = new Date(client.subscription.startDate).getTime();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    // If we are still within the first month, the bill is 0
    if (now - startDate < thirtyDaysMs) {
      return 0;
    }
  }

  // Priority 1: Custom Price Override
  if (client.subscription.customPrice !== undefined && client.subscription.customPrice !== null) {
    return client.subscription.customPrice;
  }

  const plan = plans.find(p => p.id === client.subscription.planId);
  const clientDevices = devices.filter(d => d.clientId === client.id);
  const deviceCount = clientDevices.length;
  
  if (!plan) return 299 + (deviceCount * 10); // Standard fallback

  let total = 0;
  if (plan.pricingModel === 'per_device') {
    total = plan.price * deviceCount;
  } else {
    total = plan.price; // Flat fee
  }

  // Yearly payment logic (e.g. Pay for 10 months, get 12)
  if (client.subscription.billingCycle === 'yearly') {
    return total * 10;
  }

  return total;
};

export const calculateMRR = (client: Client, plans: Plan[], devices: Device[]) => {
  const bill = calculateClientBill(client, plans, devices, false);
  
  // Normalize to monthly
  if (client.subscription.billingCycle === 'yearly') {
    return bill / 12;
  }
  return bill;
};

export const calculateProjectedMRR = (client: Client, plans: Plan[], devices: Device[]) => {
  const bill = calculateClientBill(client, plans, devices, true); // ignore trial
  
  // Normalize to monthly
  if (client.subscription.billingCycle === 'yearly') {
    return bill / 12;
  }
  return bill;
};
