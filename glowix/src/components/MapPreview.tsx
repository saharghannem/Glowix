import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapPreviewProps {
  lat: number;
  lng: number;
  title: string;
  className?: string;
}

export const MapPreview: React.FC<MapPreviewProps> = ({ lat, lng, title, className }) => {
  if (!hasValidKey) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-xl p-6 text-center ${className}`}>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-widest">Maps Integration Required</p>
        <p className="text-xs text-slate-400 max-w-[200px]">Please provide a GOOGLE_MAPS_PLATFORM_KEY in .env to enable location services.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className}`}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={11}
          mapId="SaaS_Client_Map"
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI
        >
          <AdvancedMarker position={{ lat, lng }} title={title}>
            <Pin background="#2563eb" glyphColor="#fff" borderColor="#1e40af" />
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
};
