import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface Location {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
}

interface GlobalMapProps {
  locations: Location[];
  className?: string;
}

export const GlobalMap: React.FC<GlobalMapProps> = ({ locations, className }) => {
  if (!hasValidKey) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-3xl p-8 text-center ${className}`}>
        <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">Global Presence Offline</h3>
        <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
          Supply your <code className="bg-slate-200 px-1 rounded text-slate-700">GOOGLE_MAPS_PLATFORM_KEY</code> in .env to activate real-time geospatial node tracking.
        </p>
      </div>
    );
  }

  // Calculate bounds or center
  const defaultCenter = locations.length > 0 
    ? { lat: locations[0].lat, lng: locations[0].lng }
    : { lat: 20, lng: 0 }; // World viewish

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200 ${className}`}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={2}
          mapId="SaaS_Global_Presence"
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI
        >
          {locations.map((loc) => (
            <AdvancedMarker key={loc.id} position={{ lat: loc.lat, lng: loc.lng }} title={loc.label}>
              <Pin background={loc.color || "#2563eb"} glyphColor="#fff" borderColor="#1e40af" />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
};
