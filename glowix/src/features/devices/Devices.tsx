import React, { useEffect, useState } from 'react';
import { Device, Client, TelemetryData } from '@/core/models/iot.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, MoreVertical, Plus, Radio, Server, Loader2, Cpu, Lock, ShieldAlert, ShieldCheck, LineChart, Thermometer, Droplets, Edit, Trash2, Eye, Search, Wind, Zap, MapPin, Gauge, Fuel, Power } from 'lucide-react';
import {
  LineChart as ReChartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { telemetryService, deviceService, clientService } from '@/core/services/data-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface DevicesProps {
  externalSearch?: string;
}

const Devices: React.FC<DevicesProps> = ({ externalSearch }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (externalSearch !== undefined) {
      setSearchTerm(externalSearch);
    }
  }, [externalSearch]);

  // Metric Metadata for context-aware UI
  const getMetricMeta = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes('temp')) return { icon: <Thermometer size={20} />, unit: '°C', color: 'bg-amber-500', hex: '#f59e0b', label: 'Temperature' };
    if (k.includes('humid')) return { icon: <Droplets size={20} />, unit: '%', color: 'bg-blue-500', hex: '#3b82f6', label: 'Humidity' };
    if (k.includes('gas') || k.includes('aqi')) return { icon: <Wind size={20} />, unit: 'ppm', color: 'bg-emerald-500', hex: '#10b981', label: 'Air Quality' };
    if (k.includes('volt') || k.includes('bat')) return { icon: <Zap size={20} />, unit: 'V', color: 'bg-yellow-500', hex: '#eab308', label: 'Voltage' };
    if (k.includes('gps') || k.includes('lat') || k.includes('lng')) return { icon: <MapPin size={20} />, unit: '', color: 'bg-indigo-500', hex: '#6366f1', label: 'Location' };
    if (k.includes('speed')) return { icon: <Gauge size={20} />, unit: 'km/h', color: 'bg-rose-500', hex: '#f43f5e', label: 'Velocity' };
    if (k.includes('fuel')) return { icon: <Fuel size={20} />, unit: '%', color: 'bg-orange-500', hex: '#f97316', label: 'Fuel Level' };
    if (k.includes('load') || k.includes('power')) return { icon: <Cpu size={20} />, unit: 'W', color: 'bg-purple-500', hex: '#a855f7', label: 'Load' };
    if (k.includes('freq')) return { icon: <Activity size={20} />, unit: 'Hz', color: 'bg-cyan-500', hex: '#06b6d4', label: 'Frequency' };
    if (k.includes('fan') || k.includes('status')) return { icon: <Power size={20} />, unit: '', color: 'bg-slate-500', hex: '#64748b', label: 'State' };
    
    return { icon: <Activity size={20} />, unit: '', color: 'bg-blue-600', hex: '#2563eb', label: key.replace(/([A-Z])/g, ' $1').trim() };
  };

  // Telemetry View State
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
  const [activeMetric, setActiveMetric] = useState<string>('');

  // Extract available metrics from the first telemetry entry
  const availableMetrics = (telemetry.length > 0 && telemetry[0].values) ? Object.keys(telemetry[0].values) : [];

  useEffect(() => {
    if (availableMetrics.length > 0 && !activeMetric) {
      setActiveMetric(availableMetrics[0]);
    }
  }, [availableMetrics, activeMetric]);

  useEffect(() => {
    const unsubDevices = deviceService.subscribeToDevices(setDevices);
    const unsubClients = clientService.subscribeToClients(setClients);
    return () => {
      unsubDevices();
      unsubClients();
    };
  }, []);

  const filteredDevices = devices.filter(d => {
    const client = clients.find(c => c.id === d.clientId);
    const matchesClient = filterClientId === 'all' || d.clientId === filterClientId;
    const s = searchTerm?.toLowerCase() || '';
    
    // Comprehensive search across device and linked client fields
    const matchesSearch = 
      (d.name?.toLowerCase().includes(s) ?? false) || 
      (d.hardwareId?.toLowerCase().includes(s) ?? false) ||
      (d.id?.toLowerCase().includes(s) ?? false) ||
      (d.status?.toLowerCase().includes(s) ?? false) ||
      (client?.name?.toLowerCase().includes(s) ?? false) ||
      (client?.email?.toLowerCase().includes(s) ?? false) ||
      (client?.phone?.includes(s) ?? false) ||
      (client?.address?.city?.toLowerCase().includes(s) ?? false) ||
      (client?.address?.country?.toLowerCase().includes(s) ?? false);
      
    return matchesClient && matchesSearch;
  });

  useEffect(() => {
    if (selectedDevice) {
      const unsub = telemetryService.subscribeToTelemetry(
        selectedDevice.id, 
        selectedDevice.hardwareId, 
        setTelemetry
      );
      return unsub;
    }
  }, [selectedDevice]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const isBlocked = (device: Device) => {
    const client = getClient(device.clientId);
    if (!client) return false;

    const status = clientService.getEffectiveStatus(client);
    return status === 'expired' || status === 'unpaid' || status === 'terminated';
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newHardwareId || !selectedClientId) {
      toast.error("Please fill all required fields, including the Hardware ID.");
      return;
    }

    setIsSubmitting(true);
    try {
      const client = getClient(selectedClientId);
      const isPaid = client?.subscription.paymentStatus === 'paid';

      await deviceService.createDevice({
        name: newName,
        hardwareId: newHardwareId,
        clientId: selectedClientId,
        status: 'inactive',
        isPaid: isPaid
      });
      
      toast.success("IoT Device initialized and linked.");
      setIsAddOpen(false);
      resetDeviceForm();
    } catch (err) {
      toast.error("Endpoint registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !newName || !newHardwareId || !selectedClientId) return;

    setIsSubmitting(true);
    try {
      await deviceService.updateDevice(editingDevice.id, {
        name: newName,
        hardwareId: newHardwareId,
        clientId: selectedClientId
      });
      toast.success("Device configuration updated.");
      setIsEditOpen(false);
      resetDeviceForm();
    } catch (err) {
      toast.error("Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteDevice = async (id: string, name: string) => {
    setIsSubmitting(true);
    try {
      await deviceService.deleteDevice(id);
      toast.success(`${name} decommissioned.`);
      setConfirmDeleteId(null);
      if (selectedDevice?.id === id) setSelectedDevice(null);
    } catch (err) {
      toast.error("Decommissioning failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (e: React.MouseEvent, device: Device) => {
    e.stopPropagation();
    setEditingDevice(device);
    setNewName(device.name);
    setNewHardwareId(device.hardwareId || '');
    setSelectedClientId(device.clientId);
    setIsEditOpen(true);
  };

  const resetDeviceForm = () => {
    setNewName('');
    setNewHardwareId('');
    setSelectedClientId('');
    setEditingDevice(null);
  };

  const latestTelemetry = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const selectedDeviceBlocked = selectedDevice ? isBlocked(selectedDevice) : false;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 bg-[#f1f5f9] min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Device Fleet</h1>
          <p className="text-slate-500 font-mono text-xs uppercase tracking-wider mt-1">Hardware asset inventory and status</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
            <Input 
              placeholder="Search hardware ID or name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-blue-500 transition-all rounded-md shadow-sm"
            />
          </div>

          <Select value={filterClientId} onValueChange={setFilterClientId}>
            <SelectTrigger className="w-[200px] bg-white border-slate-200 text-slate-700">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Registry Owners</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
 
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger
            render={
              <Button className="bg-[#0f172a] hover:bg-slate-800 text-white rounded-md shadow-sm px-6 h-10">
                <Plus size={16} className="mr-2" /> Register Device
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
            <form onSubmit={handleAddDevice}>
              <DialogHeader>
                <DialogTitle className="text-slate-900">Hardware Onboarding</DialogTitle>
                <DialogDescription className="text-slate-500 font-mono text-[11px] uppercase tracking-tighter pt-1">
                  Link physical assets to client accounts
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="space-y-2">
                  <Label htmlFor="hardwareId" className="text-slate-700">Hardware ID (Physical ID)</Label>
                  <Input 
                    id="hardwareId" 
                    value={newHardwareId} 
                    onChange={(e) => setNewHardwareId(e.target.value)}
                    placeholder="e.g. NODE-X-9982" 
                    className="border-slate-200 text-slate-900"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700">Device Human Name</Label>
                  <Input 
                    id="name" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Warehouse Hub 01" 
                    className="border-slate-200 text-slate-900"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">Assign to Tenant</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                    <SelectTrigger className="border-slate-200 text-slate-900">
                      <SelectValue placeholder="Select a registry client" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id} className="text-slate-900">
                          {client.email}
                        </SelectItem>
                      ))}
                      {clients.length === 0 && <SelectItem disabled value="none">No clients available</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || clients.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full py-6 text-sm font-bold"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Cpu className="mr-2" size={16} />}
                  Connect & Register
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>
 
      <div className="space-y-8">
        {selectedDevice ? (
          <Card className="border border-blue-200 bg-white overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-4 ring-1 ring-blue-500/10">
            <CardHeader className="bg-blue-600 p-6 text-white border-b-0 space-y-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Activity size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{selectedDevice.name}</h3>
                    <p className="text-[10px] text-blue-100 font-mono uppercase tracking-[2px] mt-0.5">Live Endpoint Telemetry • HW ID: {selectedDevice.hardwareId || selectedDevice.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedDeviceBlocked ? (
                    <Badge className="bg-amber-500 border-none text-white font-bold px-3 py-1 text-[9px] uppercase tracking-widest flex items-center gap-1">
                      <ShieldAlert size={10} />
                      Restricted Mode (Admin)
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-400 border-none text-white font-bold px-3 py-1 text-[9px] uppercase tracking-widest">Active Link</Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10"
                    onClick={() => setSelectedDevice(null)}
                  >
                    <Plus className="rotate-45" size={20} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  {telemetry.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {availableMetrics.map(metric => {
                        const lastEntry = telemetry[telemetry.length - 1];
                        const value = lastEntry?.values ? lastEntry.values[metric] : 0;
                        const isNumeric = typeof value === 'number';
                        const meta = getMetricMeta(metric);
                        const displayValue = isNumeric ? (value as number).toFixed(1) : String(value ?? 'N/A');
                        
                        return (
                          <div 
                            key={metric}
                            className={`bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all cursor-pointer ring-offset-2 hover:ring-2 hover:ring-blue-500/20 ${activeMetric === metric ? 'ring-2 ring-blue-500/10 border-blue-200 shadow-sm' : ''}`} 
                            onClick={() => isNumeric && setActiveMetric(metric)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl transition-colors ${activeMetric === metric ? `${meta.color} text-white` : 'bg-white text-slate-400 shadow-sm'}`}>
                                {meta.icon}
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">{meta.label}</p>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold font-mono text-slate-900">{displayValue}</span>
                                  {isNumeric && meta.unit && <span className="text-xs text-slate-400 font-medium">{meta.unit}</span>}
                                </div>
                              </div>
                            </div>
                            {!isNumeric && (
                              <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-400 uppercase tracking-tighter">Status</Badge>
                            )}
                          </div>
                        );
                      })}

                      <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg shadow-blue-200 flex flex-col justify-between h-32">
                        <div className="flex justify-between items-start">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Signal Strength</p>
                          <Radio size={16} className="animate-ping" />
                        </div>
                        <div>
                          <span className="text-3xl font-bold">98%</span>
                          <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div className="bg-white h-full w-[98%] rounded-full shadow-[0_0_10px_white]"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                      <p className="text-[10px] font-bold uppercase tracking-[2px] text-slate-400">Handshaking...</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500 rounded-lg">
                        <Activity size={14} className="text-white" />
                      </div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[2px] text-slate-400">Live Payload Log</h4>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono bg-white text-slate-400 border-slate-100">Descending by Timestamp</Badge>
                  </div>
                  
                  <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                    {telemetry.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all animate-in slide-in-from-right-4 duration-300">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="px-2 py-1 bg-slate-100 rounded-md">
                              <span className="text-[10px] font-mono font-bold text-slate-600">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-tighter leading-none mb-1">HW: {entry.hardwareId || 'N/A'}</span>
                              <span className="text-[8px] text-slate-300 font-mono leading-none">UUID: {entry.deviceId}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-600">Verified Packet</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          {Object.entries(entry.values || {}).map(([key, value]) => {
                            const meta = getMetricMeta(key);
                            const isNumeric = typeof value === 'number';
                            
                            return (
                              <div key={key} className="flex items-start gap-3 group">
                                <div className={`p-2 rounded-lg ${meta.color} bg-opacity-10 shrink-0`}>
                                  {React.cloneElement(meta.icon as React.ReactElement, { size: 12, className: meta.color.replace('bg-', 'text-') })}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mb-0.5 truncate">{meta.label}</p>
                                  <p className="text-sm font-mono font-bold text-slate-800 truncate">
                                    {isNumeric ? (value as number).toFixed(2) : String(value)}
                                    {isNumeric && meta.unit && <span className="text-[10px] ml-1 opacity-50">{meta.unit}</span>}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    
                    {telemetry.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                         <div className="animate-spin mb-4">
                           <Loader2 size={24} className="text-slate-300" />
                         </div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Listening for inbound packets...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-blue-600/5 border-2 border-dashed border-blue-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <Radio size={32} className="text-blue-500 opacity-50 animate-pulse" />
            </div>
            <p className="max-w-md text-xs font-bold uppercase tracking-widest text-slate-400 leading-relaxed">
              Select an endpoint device from the registry below to initialize the live data observation stream and system diagnostics.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device) => {
            const blocked = isBlocked(device);
            const isActive = selectedDevice?.id === device.id;
            
            return (
              <Card 
                key={device.id} 
                className={`bg-white border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer relative ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedDevice(device)}
              >
                {blocked && (
                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-white space-y-2 p-6 text-center group-hover:bg-slate-900/40 transition-colors">
                    <Lock size={24} className="text-red-400 opacity-80" />
                    <p className="text-[10px] font-bold uppercase tracking-widest bg-red-600/80 px-2 py-0.5 rounded">Access Terminated</p>
                    <p className="text-[9px] text-white/90 italic line-clamp-1">
                      {clientService.getEffectiveStatus(getClient(device.clientId)!) === 'unpaid' 
                        ? 'Payment overdue: Ledger lock applied' 
                        : 'Contract expired or terminated'}
                    </p>
                    <p className="text-[8px] text-white/70 font-mono">Owner: {getClient(device.clientId)?.name}</p>
                    <div className="mt-2 flex gap-2">
                       <Button variant="outline" size="sm" className="h-6 border-white/20 text-white hover:bg-white/10 uppercase text-[8px] px-2" onClick={(e) => { e.stopPropagation(); setSelectedDevice(device); }}>View Stream</Button>
                    </div>
                  </div>
                )}
                
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
                      <Server size={16} className={device.status === 'active' ? "text-blue-500" : "text-slate-400"} />
                    </div>
                    <div>
                      <CardTitle className="text-[14px] font-bold text-slate-800">{device.name}</CardTitle>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{device.hardwareId || device.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-400 hover:text-blue-500"
                      onClick={(e) => { e.stopPropagation(); setSelectedDevice(device); }}
                    >
                      <Eye size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-400 hover:text-amber-500"
                      onClick={(e) => openEditDialog(e, device)}
                    >
                      <Edit size={14} />
                    </Button>
                    <Dialog open={confirmDeleteId === device.id} onOpenChange={(open) => setConfirmDeleteId(open ? device.id : null)}>
                      <DialogTrigger
                        render={
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </Button>
                        }
                      />
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle>Critical Action: Decommission</DialogTitle>
                          <DialogDescription className="text-red-500 font-bold uppercase text-[10px] tracking-widest font-mono pt-1">Terminal hardware removal</DialogDescription>
                        </DialogHeader>
                        <div className="py-6">
                          <p className="text-sm text-slate-600">Are you sure you want to permanently disable <span className="font-bold text-slate-900">{device.name}</span> from the network ledger?</p>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Abstain</Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDeleteDevice(device.id, device.name)}
                            disabled={isSubmitting}
                            className="bg-red-600 font-bold"
                          >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Termination"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-slate-500 font-medium">Provisioned To</span>
                    <span className="font-semibold text-slate-700 truncate max-w-[150px] text-right">{getClient(device.clientId)?.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-slate-500 font-medium">Status</span>
                    <div className="flex flex-col items-end gap-1">
                       <Badge className={`font-bold text-[9px] ${
                         device.status === 'active' && !blocked 
                           ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                           : device.status === 'terminated'
                           ? 'bg-red-100 text-red-700 border-red-200'
                           : 'bg-slate-100 text-slate-600 border-slate-200'
                       }`}>
                        {device.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredDevices.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
              <Database size={32} className="mb-3 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No equipment found matching criteria</p>
            </div>
          )}
        </div>
      </div>


      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-slate-200">
          <form onSubmit={handleUpdateDevice}>
            <DialogHeader>
              <DialogTitle>Configure Hardware Node</DialogTitle>
              <DialogDescription className="text-blue-600 font-mono text-[11px] uppercase tracking-tighter pt-1">Update registry and link metadata</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="edit-hardwareId" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hardware ID</Label>
                <Input 
                  id="edit-hardwareId" 
                  value={newHardwareId} 
                  onChange={(e) => setNewHardwareId(e.target.value)}
                  className="h-11 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Human Name</Label>
                <Input 
                  id="edit-name" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-11 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Authorized Owner</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                  <SelectTrigger className="h-11 border-slate-200">
                    <SelectValue placeholder="Assign to client" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-slate-800 text-white w-full h-12 font-bold uppercase tracking-widest text-xs"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Commit Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};;

export default Devices;
