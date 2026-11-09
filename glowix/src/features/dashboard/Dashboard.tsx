import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  Database, 
  Thermometer, 
  Users, 
  Droplets,
  TrendingUp,
  ShieldCheck,
  Zap,
  Globe,
  Wifi,
  Map as MapIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import { telemetryService, clientService, deviceService, planService } from '../../core/services/data-service';
import { Client, Device, TelemetryData, Alert, Plan } from '../../core/models/iot.types';
import { calculateClientBill, calculateMRR, calculateProjectedMRR } from '../../core/utils/billing';
import { GlobalMap } from '@/components/GlobalMap';
import { getDaysRemaining } from '../../core/utils/notifications';

interface DashboardProps {
  externalSearch?: string;
  onNavigate?: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ externalSearch, onNavigate }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('device_01');
  const [spectralData, setSpectralData] = useState<{level: number, count: number}[]>([]);
  const [fleetTelemetry, setFleetTelemetry] = useState<TelemetryData[]>([]);

  useEffect(() => {
    // Subscription for global telemetry to build distribution
    const unsub = telemetryService.subscribeToTelemetry('all_devices', undefined, setFleetTelemetry);
    return () => unsub();
  }, []);

  useEffect(() => {
    // Generate distribution from real fleet telemetry
    if (fleetTelemetry.length > 0) {
      const bins: Record<number, number> = {};
      // RSSI range typically -100 to -30
      for (let i = -100; i <= -30; i += 5) {
        bins[i] = 0;
      }

      fleetTelemetry.forEach(t => {
        const rssi = t.values?.rssi as number;
        if (rssi) {
          const bin = Math.floor(rssi / 5) * 5;
          if (bin in bins) bins[bin]++;
          else if (rssi <= -100) bins[-100]++;
          else if (rssi >= -30) bins[-30]++;
        }
      });

      const data = Object.entries(bins).map(([level, count]) => ({
        level: parseInt(level),
        count
      })).sort((a,b) => a.level - b.level);
      
      setSpectralData(data);
    } else {
      // Fallback/Loading state for spectral flux
      setSpectralData(Array.from({ length: 15 }, (_, i) => ({
        level: -100 + (i * 5),
        count: 0
      })));
    }
  }, [fleetTelemetry]);

  useEffect(() => {
    const unsubClients = clientService.subscribeToClients(setClients);
    const unsubDevices = deviceService.subscribeToDevices(setDevices);
    const unsubAlerts = telemetryService.subscribeToAlerts(setAlerts, 20, true);
    const unsubPlans = planService.subscribeToPlans(setPlans);
    
    return () => {
      unsubClients();
      unsubDevices();
      unsubAlerts();
      unsubPlans();
    };
  }, []);

  const s = externalSearch?.toLowerCase() || '';
  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = (a.message?.toLowerCase().includes(s) ?? false) || 
                         (a.deviceId?.toLowerCase().includes(s) ?? false);
    const isCriticalOrWarning = a.severity === 'critical' || a.severity === 'warning';
    return matchesSearch && isCriticalOrWarning;
  }).slice(0, 10);

  const filteredRecentDevices = devices.filter(d => {
    const client = clients.find(c => c.id === d.clientId);
    return (d.name?.toLowerCase().includes(s) ?? false) || (client?.email?.toLowerCase().includes(s) ?? false);
  }).slice(0, 6);

  useEffect(() => {
    if (selectedDeviceId) {
      const device = devices.find(d => d.id === selectedDeviceId);
      const unsubTele = telemetryService.subscribeToTelemetry(
        selectedDeviceId, 
        device?.hardwareId, 
        setTelemetry
      );
      return () => unsubTele();
    }
  }, [selectedDeviceId, devices]);

  // Financial Calculations
  const liveMRR = clients.reduce((acc, c) => {
    // Only count MRR if they are actually PAID
    if (c.subscription.paymentStatus === 'paid') {
      return acc + calculateMRR(c, plans, devices);
    }
    return acc;
  }, 0);

  const projectedMRR = clients.reduce((acc, c) => acc + calculateProjectedMRR(c, plans, devices), 0);
  
  const trialPhaseClients = clients.filter(c => {
    if (!c.subscription.isFirstMonthFree) return false;
    const startDate = new Date(c.subscription.startDate).getTime();
    return (Date.now() - startDate) < (30 * 24 * 60 * 60 * 1000) && c.subscription.paymentStatus === 'paid';
  });

  const paidAccounts = clients.filter(c => 
    c.subscription.paymentStatus === 'paid' && 
    c.subscription.status === 'active'
  );

  const expiredOrDefaulters = clients.filter(c => 
    c.subscription.paymentStatus === 'unpaid' || 
    c.subscription.status === 'expired' ||
    c.subscription.status === 'terminated'
  );

  const stats = [
    { label: 'Projected MRR', value: `$${projectedMRR.toLocaleString()}`, icon: TrendingUp, trend: 'Contracted', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Live Revenue', value: `$${liveMRR.toLocaleString()}`, icon: Zap, trend: 'Settled', color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Paid Accounts', value: paidAccounts.length, icon: ShieldCheck, trend: 'Healthy', color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Delinquent', value: expiredOrDefaulters.length, icon: AlertTriangle, trend: 'At Risk', color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: 'Trialing', value: trialPhaseClients.length, icon: Activity, trend: 'Free Phase', color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Total Nodes', value: devices.length, icon: Database, trend: 'Hardware', color: 'text-slate-500', bg: 'bg-slate-50' },
  ];

  const deviceDistribution = [
    { name: 'Active', value: devices.filter(d => d.status === 'active' && !d.isBlocked).length, color: '#10b981' },
    { name: 'Offline', value: devices.filter(d => d.status === 'inactive').length, color: '#94a3b8' },
    { name: 'Blocked', value: devices.filter(d => d.isBlocked).length, color: '#f43f5e' },
  ];

  const locations = clients
    .filter(c => c.address?.coordinates)
    .map(c => ({
      id: c.id,
      lat: c.address!.coordinates!.lat,
      lng: c.address!.coordinates!.lng,
      label: c.name,
      color: c.subscription.status === 'active' ? '#2563eb' : '#94a3b8'
    }));

  return (
    <div className="p-8 space-y-8 bg-[#f8fafc] min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end"
      >
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Glowix <span className="text-blue-600">Fleet Control</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Subscription Fleet Operations & Intelligence Center.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-white px-3 py-1 gap-2 border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest shadow-sm">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20"></div>
             Core Systems: Live
          </Badge>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 shadow-sm`}>
                    <stat.icon size={20} />
                  </div>
                  <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-mono text-[10px] uppercase border-none">
                    {stat.trend}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">{stat.label}</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1 font-mono tracking-tighter">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Analytics */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/40 overflow-hidden h-full">
            <CardHeader className="border-b border-slate-50 p-6 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Activity size={18} className="text-blue-600 animate-pulse" />
                  Signal Flux Distribution
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs text-balance">Real-time spectral analysis of fleet-wide signal strength (RSSI).</CardDescription>
              </div>
              <div className="flex items-center gap-6">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Scanning Grid</span>
                    <span className="text-[11px] font-mono text-blue-600">Global Fleet</span>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white h-[400px]">
              <div className="h-full w-full py-4 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spectralData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorSpectral" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="level" 
                      stroke="#94a3b8" 
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      unit="dBm"
                      label={{ value: 'Signal Level (RSSI)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      axisLine={false} 
                      tickLine={false}
                      label={{ value: 'Node Count', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#1e293b', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area 
                      type="step" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSpectral)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Fleet Density</span>
                </div>
                <span className="italic uppercase tracking-tighter">Samples: {fleetTelemetry.length} Nodes</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Network Map Visualizer */}
        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
        >
          <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/40 h-full flex flex-col">
            <CardHeader className="p-6 border-b border-slate-50">
              <CardTitle className="text-lg font-bold">Global Presence</CardTitle>
              <CardDescription className="text-xs">Approximate geographic node distribution.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-6">
              <GlobalMap 
                locations={locations}
                className="aspect-square h-full min-h-[300px]"
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Global Registry Table */}
      <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col">
        <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Recent Ledger Entries</CardTitle>
            <CardDescription>Most recent client and hardware activity recorded.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-widest h-8">Export Log</Button>
          </div>
        </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 font-bold tracking-widest border-b border-slate-100">
                    <th className="px-6 py-4">Protocol Node</th>
                    <th className="px-6 py-4">Tenant Email</th>
                    <th className="px-6 py-4 text-center">Health</th>
                    <th className="px-6 py-4 text-right">Synchronization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRecentDevices.map((device) => {
                    const client = clients.find(c => c.id === device.clientId);
                    return (
                      <tr key={device.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                              <Zap size={14} />
                            </div>
                            <span className="text-[13px] font-bold text-slate-700">{device.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[12px] text-slate-500">{client?.email || '--'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            <div className={`w-2 h-2 rounded-full ${device.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-300'}`}></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

export default Dashboard;
