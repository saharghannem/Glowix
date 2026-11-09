import { Client } from '../models/iot.types';

export const getDaysRemaining = (endDate: string) => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getSubscriptionStatusText = (client: Client) => {
  const days = getDaysRemaining(client.subscription.endDate);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends Today';
  if (days <= 7) return `Offer ends in ${days}d`;
  return `${days} days left`;
};
