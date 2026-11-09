export const METRICS_CONFIG = {
  temperature: { label: "Température", unit: "°C", icon: "🌡️", color: "#FF6B6B", isGauge: true, max: 60 },
  humidity: { label: "Humidité", unit: "%", icon: "💧", color: "#38BDF8", isGauge: true, max: 100 },
  battery: { label: "Batterie", unit: "%", icon: "🔋", color: "#00E5A0", isGauge: true, max: 100 },
  co2: { label: "CO2", unit: "ppm", icon: "☁️", color: "#A78BFA", hasHistory: true },
  gas: { label: "Gaz", unit: "", icon: "🔥", color: "#FFB800" },
  gasValue: { label: "Valeur Gaz", unit: "", icon: "📟", color: "#FFB800" },
  airQuality: { label: "Qualité Air", unit: "AQI", icon: "🌫️", color: "#22D3EE" },
  pressure: { label: "Pression", unit: "hPa", icon: "🧭", color: "#38BDF8" },
  light: { label: "Lumière", unit: "lux", icon: "💡", color: "#FACC15" },
  noise: { label: "Bruit", unit: "dB", icon: "🔊", color: "#FB7185" },
  dust: { label: "Poussière", unit: "µg/m³", icon: "🟤", color: "#D97706" },
  smoke: { label: "Fumée", unit: "", icon: "💨", color: "#94A3B8" },
  smokeStatus: { label: "Statut Fumée", unit: "", icon: "🚨", color: "#F87171" },
  flame: { label: "Flamme", unit: "", icon: "🔥", color: "#FF3B5C" },
  flameStatus: { label: "Statut Flamme", unit: "", icon: "🔥", color: "#FF3B5C" },
  motion: { label: "Mouvement", unit: "", icon: "🏃", color: "#00E5A0", isBoolean: true },
};

export const EXCLUDED_KEYS = ["deviceId", "status", "lastUpdate", "timestamp", "clientId", "id", "name", "zone", "isPaid", "lastSeen"];
