import React, { useEffect, useState } from 'react';
import { Client, Device } from '@/core/models/iot.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { deviceService, clientService, telemetryService, planService } from '@/core/services/data-service';
import { MoreHorizontal, Plus, ShieldCheck, ShieldAlert, Users, Loader2, Phone, User, DollarSign, Edit, Trash2, Eye, ExternalLink, Thermometer, Droplets, Activity, Package, Search, Lock, Cpu } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TelemetryData, Plan } from '@/core/models/iot.types';
import { calculateClientBill } from '@/core/utils/billing';
import { getSubscriptionStatusText } from '@/core/utils/notifications';
import { MapPreview } from '@/components/MapPreview';

interface Country {
  name: string;
  code: string;
  flag: string;
  latlng: [number, number];
}

const FALLBACK_COUNTRIES: Country[] = [
  { name: "Afghanistan", code: "AF", flag: "https://flagcdn.com/w40/af.png", latlng: [33, 65] },
  { name: "Albania", code: "AL", flag: "https://flagcdn.com/w40/al.png", latlng: [41, 20] },
  { name: "Algeria", code: "DZ", flag: "https://flagcdn.com/w40/dz.png", latlng: [28, 3] },
  { name: "Argentina", code: "AR", flag: "https://flagcdn.com/w40/ar.png", latlng: [-34, -64] },
  { name: "Australia", code: "AU", flag: "https://flagcdn.com/w40/au.png", latlng: [-27, 133] },
  { name: "Austria", code: "AT", flag: "https://flagcdn.com/w40/at.png", latlng: [47.33, 13.33] },
  { name: "Belgium", code: "BE", flag: "https://flagcdn.com/w40/be.png", latlng: [50.83, 4] },
  { name: "Brazil", code: "BR", flag: "https://flagcdn.com/w40/br.png", latlng: [-10, -55] },
  { name: "Canada", code: "CA", flag: "https://flagcdn.com/w40/ca.png", latlng: [60, -95] },
  { name: "China", code: "CN", flag: "https://flagcdn.com/w40/cn.png", latlng: [35, 105] },
  { name: "Denmark", code: "DK", flag: "https://flagcdn.com/w40/dk.png", latlng: [56, 10] },
  { name: "Egypt", code: "EG", flag: "https://flagcdn.com/w40/eg.png", latlng: [27, 30] },
  { name: "France", code: "FR", flag: "https://flagcdn.com/w40/fr.png", latlng: [46, 2] },
  { name: "Germany", code: "DE", flag: "https://flagcdn.com/w40/de.png", latlng: [51, 9] },
  { name: "Greece", code: "GR", flag: "https://flagcdn.com/w40/gr.png", latlng: [39, 22] },
  { name: "India", code: "IN", flag: "https://flagcdn.com/w40/in.png", latlng: [20, 77] },
  { name: "Italy", code: "IT", flag: "https://flagcdn.com/w40/it.png", latlng: [42.83, 12.83] },
  { name: "Japan", code: "JP", flag: "https://flagcdn.com/w40/jp.png", latlng: [36, 138] },
  { name: "Kuwait", code: "KW", flag: "https://flagcdn.com/w40/kw.png", latlng: [29.33, 47.65] },
  { name: "Lebanon", code: "LB", flag: "https://flagcdn.com/w40/lb.png", latlng: [33.83, 35.83] },
  { name: "Libya", code: "LY", flag: "https://flagcdn.com/w40/ly.png", latlng: [25, 17] },
  { name: "Morocco", code: "MA", flag: "https://flagcdn.com/w40/ma.png", latlng: [32, -5] },
  { name: "Netherlands", code: "NL", flag: "https://flagcdn.com/w40/nl.png", latlng: [52.5, 5.75] },
  { name: "Norway", code: "NO", flag: "https://flagcdn.com/w40/no.png", latlng: [62, 10] },
  { name: "Oman", code: "OM", flag: "https://flagcdn.com/w40/om.png", latlng: [21, 57] },
  { name: "Poland", code: "PL", flag: "https://flagcdn.com/w40/pl.png", latlng: [52, 20] },
  { name: "Portugal", code: "PT", flag: "https://flagcdn.com/w40/pt.png", latlng: [39.5, -8] },
  { name: "Qatar", code: "QA", flag: "https://flagcdn.com/w40/qa.png", latlng: [25.3, 51.15] },
  { name: "Saudi Arabia", code: "SA", flag: "https://flagcdn.com/w40/sa.png", latlng: [25, 45] },
  { name: "Spain", code: "ES", flag: "https://flagcdn.com/w40/es.png", latlng: [40, -4] },
  { name: "Sweden", code: "SE", flag: "https://flagcdn.com/w40/se.png", latlng: [62, 15] },
  { name: "Switzerland", code: "CH", flag: "https://flagcdn.com/w40/ch.png", latlng: [47, 8] },
  { name: "Tunisia", code: "TN", flag: "https://flagcdn.com/w40/tn.png", latlng: [34, 9] },
  { name: "Turkey", code: "TR", flag: "https://flagcdn.com/w40/tr.png", latlng: [39, 35] },
  { name: "United Arab Emirates", code: "AE", flag: "https://flagcdn.com/w40/ae.png", latlng: [24, 54] },
  { name: "United Kingdom", code: "GB", flag: "https://flagcdn.com/w40/gb.png", latlng: [54, -2] },
  { name: "United States", code: "US", flag: "https://flagcdn.com/w40/us.png", latlng: [38, -97] }
];

interface ClientsProps {
  externalSearch?: string;
}

const Clients: React.FC<ClientsProps> = ({ externalSearch }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceTelemetry, setDeviceTelemetry] = useState<TelemetryData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (externalSearch !== undefined) {
      setSearchTerm(externalSearch);
    }
  }, [externalSearch]);

  useEffect(() => {
    let unsubTelemetry: (() => void) | undefined;
    if (selectedDevice) {
      unsubTelemetry = telemetryService.subscribeToTelemetry(
        selectedDevice.id,
        selectedDevice.hardwareId,
        setDeviceTelemetry
      );
    } else {
      setDeviceTelemetry([]);
    }
    return () => {
      if (unsubTelemetry) unsubTelemetry();
    };
  }, [selectedDevice]);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [contractTerm, setContractTerm] = useState('1y');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'pending'>('paid');
  const [newEndDate, setNewEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Manual');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Address state
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      const apiKey = (import.meta as any).env?.VITE_REST_COUNTRIES_API_KEY || 
                     process.env.VITE_REST_COUNTRIES_API_KEY || 
                     'rc_live_03e039c95191437bbbe9a754ecc6f50f';
      const urlParams = 'response_fields=names.common,codes.alpha_2,flag.emoji,flag.svg,flag.png,geo.latlng&limit=250';

      try {
        let res: Response | null = null;
        try {
          // 1. Try Vite local dev proxy (avoids browser CORS issues)
          res = await fetch(`/api/countries?${urlParams}`);
          if (!res.ok) throw new Error(`Proxy status: ${res.status}`);
        } catch {
          // 2. Direct REST Countries v5 API with user Bearer token
          res = await fetch(`https://api.restcountries.com/countries/v5?${urlParams}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          });
        }

        if (!res || !res.ok) {
          throw new Error(`Failed to load countries: ${res?.status}`);
        }

        const data = await res.json();
        // Support v5 { data: { objects: [...] } } and array formats
        const rawList = data?.data?.objects || (Array.isArray(data) ? data : []);
        if (!rawList || rawList.length === 0) {
          throw new Error("No countries in response");
        }

        const formatted: Country[] = rawList.map((c: any) => {
          const name = c.names?.common || c.name?.common || c.name || '';
          const code = c.codes?.alpha_2 || c.cca2 || c.code || '';
          const flag = c.flag?.svg || c.flag?.png || c.flags?.svg || c.flags?.png || 
                       (code ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : '');
          const latlng: [number, number] = c.geo?.latlng || c.latlng || [0, 0];
          return { name, code, flag, latlng };
        }).filter((c: Country) => c.name && c.code)
          .sort((a: Country, b: Country) => a.name.localeCompare(b.name));

        setCountries(formatted);
      } catch (err) {
        console.warn("REST Countries API unreachable, using fallback list:", err);
        setCountries(FALLBACK_COUNTRIES);
      } finally {
        setIsLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setCities([]);
      return;
    }
    const fetchCities = async () => {
      setIsLoadingCities(true);
      try {
        const countryName = countries.find(c => c.code === selectedCountry)?.name;
        if (!countryName) return;

        // Using countriesnow API for cities
        const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: countryName })
        });
        const data = await res.json();
        if (!data.error) {
          setCities(data.data.sort());
        } else {
          setCities([]);
        }
      } catch (err) {
        console.error("Failed to fetch cities", err);
        setCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    };
    fetchCities();
  }, [selectedCountry, countries]);

  useEffect(() => {
    const unsubClients = clientService.subscribeToClients(setClients);
    const unsubDevices = deviceService.subscribeToDevices(setDevices);
    const unsubPlans = planService.subscribeToPlans(setPlans);
    return () => {
      unsubClients();
      unsubDevices();
      unsubPlans();
    };
  }, []);

  const handleEditOpen = (client: Client) => {
    setSelectedClient(client);
    setNewName(client.name);
    setNewEmail(client.email);
    setNewPassword(client.password || '');
    setNewPhone(client.phone);
    setSelectedPlanId(client.subscription.planId || '');
    setBillingCycle(client.subscription.billingCycle || 'monthly');
    setCustomPrice(client.subscription.customPrice?.toString() || '');
    setPaymentStatus(client.subscription.paymentStatus || 'paid');
    setPaymentMethod(client.subscription.paymentMethod || 'Manual');

    // Format date for <input type="date" /> (YYYY-MM-DD)
    const date = new Date(client.subscription.endDate);
    const dateStr = date.toISOString().split('T')[0];
    setNewEndDate(dateStr);

    setSelectedCountry(client.address?.countryCode || '');
    setSelectedCity(client.address?.city || '');
    setIsEditOpen(true);
  };

  const handleViewOpen = (client: Client) => {
    setSelectedClient(client);
    setSelectedDevice(null);
    setIsViewOpen(true);
  };

  const getDeviceCount = (clientId: string) => devices.filter(d => d.clientId === clientId).length;
  const getClientDevices = (clientId: string) => devices.filter(d => d.clientId === clientId);

  const getPreviewBill = (planId: string, deviceCount: number, cycle: 'monthly' | 'yearly', customPriceVal?: string) => {
    if (customPriceVal && !isNaN(parseFloat(customPriceVal))) {
      return parseFloat(customPriceVal);
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return 0;

    let total = 0;
    if (plan.pricingModel === 'per_device') {
      total = plan.price * (deviceCount || 1);
    } else {
      total = plan.price;
    }

    if (cycle === 'yearly') {
      return total * 10;
    }
    return total;
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName || !newPhone || !newPassword || !selectedPlanId) {
      toast.error("Please fill all required fields, including the password and subscription offer.");
      return;
    }

    const calculateEndDate = (startDate: Date, cycle: 'monthly' | 'yearly') => {
      const d = new Date(startDate);
      if (cycle === 'yearly') {
        d.setFullYear(d.getFullYear() + 1);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d.toISOString();
    };

    setIsSubmitting(true);
    try {
      const now = new Date();
      const countryData = countries.find(c => c.code === selectedCountry);

      const endDateVal = newEndDate || calculateEndDate(now, billingCycle);
      const parsedCustomPrice = customPrice !== '' ? parseFloat(customPrice) : null;

      const clientPayload: any = {
        email: newEmail,
        password: newPassword,
        name: newName,
        phone: newPhone,
        createdAt: now.toISOString(),
        subscription: {
          status: 'active',
          startDate: now.toISOString(),
          endDate: endDateVal,
          planId: selectedPlanId,
          billingCycle: billingCycle,
          customPrice: parsedCustomPrice,
          isFirstMonthFree: true,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod
        },
        totalBill: getPreviewBill(selectedPlanId, 0, billingCycle, customPrice)
      };

      if (selectedCountry) {
        clientPayload.address = {
          country: countryData?.name || selectedCountry,
          city: selectedCity || '',
          countryCode: selectedCountry,
          flagUrl: countryData?.flag || `https://flagcdn.com/w40/${selectedCountry.toLowerCase()}.png`,
          coordinates: {
            lat: countryData?.latlng?.[0] ?? 0,
            lng: countryData?.latlng?.[1] ?? 0
          }
        };
      }

      await clientService.createClient(clientPayload);

      toast.success("Client account provisioned successfully.");
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to create client account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newEmail || !newName || !newPhone) return;

    setIsSubmitting(true);
    try {
      const countryData = countries.find(c => c.code === selectedCountry);
      const parsedCustomPrice = customPrice !== '' ? parseFloat(customPrice) : null;
      const deviceCount = getDeviceCount(selectedClient.id);

      const updatePayload: any = {
        name: newName,
        email: newEmail,
        password: newPassword,
        phone: newPhone,
        subscription: {
          ...selectedClient.subscription,
          planId: selectedPlanId,
          billingCycle: billingCycle,
          customPrice: parsedCustomPrice,
          paymentStatus: paymentStatus,
          endDate: newEndDate || selectedClient.subscription.endDate
        },
        totalBill: getPreviewBill(selectedPlanId, deviceCount, billingCycle, customPrice)
      };

      if (selectedCountry) {
        updatePayload.address = {
          country: countryData?.name || selectedCountry,
          city: selectedCity || '',
          countryCode: selectedCountry,
          flagUrl: countryData?.flag || `https://flagcdn.com/w40/${selectedCountry.toLowerCase()}.png`,
          coordinates: {
            lat: countryData?.latlng?.[0] ?? 0,
            lng: countryData?.latlng?.[1] ?? 0
          }
        };
      }

      await clientService.updateClient(selectedClient.id, updatePayload);

      // Sync devices if payment status changed
      if (selectedClient.subscription.paymentStatus !== paymentStatus) {
        await deviceService.syncDevicePaymentStatus(selectedClient.id, paymentStatus === 'paid');
      }

      toast.success("Client record updated.");
      setIsEditOpen(false);
      resetForm();
    } catch (err) {
      toast.error("Update failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  const handleDeleteClient = async (id: string, name: string) => {
    setIsSubmitting(true);
    try {
      await clientService.deleteClient(id);
      toast.success(`${name} and all linked devices deleted.`);
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error("Deletion failed. Access denied.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setNewPhone('');
    setSelectedPlanId('');
    setBillingCycle('monthly');
    setPaymentStatus('paid');
    setNewEndDate('');
    setPaymentMethod('Manual');
    setCustomPrice('');
    setSelectedCountry('');
    setSelectedCity('');
    setSelectedClient(null);
  };

  const toggleSubscription = async (client: Client) => {
    const newStatus = client.subscription.status === 'active' ? 'expired' : 'active';
    try {
      await clientService.updateClient(client.id, {
        subscription: {
          ...client.subscription,
          status: newStatus
        }
      });
      toast.info(`Subscription ${newStatus === 'active' ? 'activated' : 'suspended'} for ${client.email}`);
    } catch (err) {
      toast.error("Transaction failed. Check permissions.");
    }
  };

  const filteredClients = clients.filter(c => {
    const s = searchTerm?.toLowerCase() || '';
    const planName = plans.find(p => p.id === c.subscription?.planId)?.name?.toLowerCase() || '';
    return (
      (c.name?.toLowerCase().includes(s) ?? false) ||
      (c.email?.toLowerCase().includes(s) ?? false) ||
      (c.phone?.includes(s) ?? false) ||
      (c.address?.city?.toLowerCase().includes(s) ?? false) ||
      (c.address?.country?.toLowerCase().includes(s) ?? false) ||
      planName.includes(s) ||
      (c.subscription?.status?.toLowerCase().includes(s) ?? false)
    );
  });

  const latestTelemetry = deviceTelemetry[deviceTelemetry.length - 1];

  return (
    <div className="p-8 space-y-8 bg-[#f1f5f9]">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Client Registry</h2>
            <p className="text-slate-500 font-mono text-xs uppercase tracking-wider mt-1">Tenant Database Management</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
              <Input
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-blue-500 transition-all rounded-md shadow-sm"
              />
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger
                render={
                  <Button className="bg-[#0f172a] hover:bg-slate-800 text-white rounded-md shadow-sm px-6">
                    <Plus size={16} className="mr-2" /> Register New Client
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[425px] bg-white border-slate-200 max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleAddClient}>
                  <DialogHeader>
                    <DialogTitle className="text-slate-900">Onboard New Tenant</DialogTitle>
                    <DialogDescription className="text-slate-500 font-mono text-[11px] uppercase tracking-tighter pt-1">
                      Provision unique service account credentials
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-700">Full Name / Organization</Label>
                      <Input
                        id="name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="John Doe / TechCorp"
                        className="border-slate-200 text-slate-900"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700">Contact Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="partner@tenant.com"
                        className="border-slate-200 text-slate-900"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password text-slate-700">Mobile App Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="border-slate-200 text-slate-900"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700">Phone Number</Label>
                      <Input
                        id="phone"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="border-slate-200 text-slate-900"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Regional Base</Label>
                        <div className="flex gap-2">
                          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                            <SelectTrigger className="border-slate-200 text-slate-900 bg-white">
                              <SelectValue placeholder={isLoadingCountries ? "..." : "Cnt"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 max-h-[200px]">
                              {countries.map(c => (
                                <SelectItem key={c.code} value={c.code}>
                                  <div className="flex items-center gap-2">
                                    <img referrerPolicy="no-referrer" src={c.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />
                                    <span>{c.code}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {cities.length > 0 ? (
                            <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedCountry || isLoadingCities}>
                              <SelectTrigger className="border-slate-200 text-slate-900 bg-white capitalize">
                                <SelectValue placeholder={isLoadingCities ? "..." : "City"} />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200 max-h-[200px]">
                                {cities.map(city => (
                                  <SelectItem key={city} value={city} className="capitalize">{city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder={selectedCountry ? (isLoadingCities ? "Loading..." : "City") : "Select Cnt"}
                              value={selectedCity}
                              onChange={(e) => setSelectedCity(e.target.value)}
                              disabled={!selectedCountry}
                              className="border-slate-200 text-slate-900 bg-white capitalize h-9 text-xs"
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Service Offer</Label>
                        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                          <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                            <SelectValue placeholder="Offer" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            {plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Contract Term</Label>
                        <Select value={contractTerm} onValueChange={(val: any) => {
                          setContractTerm(val);
                          if (val !== 'custom') {
                            const d = new Date();
                            if (val === '1m') d.setMonth(d.getMonth() + 1);
                            if (val === '6m') d.setMonth(d.getMonth() + 6);
                            if (val === '1y') d.setFullYear(d.getFullYear() + 1);
                            setNewEndDate(d.toISOString().split('T')[0]);
                          }
                        }}>
                          <SelectTrigger className="border-slate-200 text-slate-900 bg-white">
                            <SelectValue placeholder="Select Term" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="1m">1 Month</SelectItem>
                            <SelectItem value="6m">6 Months</SelectItem>
                            <SelectItem value="1y">1 Year</SelectItem>
                            <SelectItem value="custom">Custom Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Billing Cycle</Label>
                        <Select value={billingCycle} onValueChange={(val: any) => setBillingCycle(val)}>
                          <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                            <SelectValue placeholder="Cycle" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Payment Status</Label>
                        <Select value={paymentStatus} onValueChange={(val: any) => setPaymentStatus(val)}>
                          <SelectTrigger className="border-slate-200 text-slate-900 bg-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-bold text-xs uppercase">Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="border-slate-200 text-slate-900 bg-white">
                            <SelectValue placeholder="Method" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="Manual">Manual Settlement</SelectItem>
                            <SelectItem value="Stripe">Stripe (Future)</SelectItem>
                            <SelectItem value="Bank">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 font-bold text-xs uppercase">End Date</Label>
                      <Input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        className="border-slate-200 text-slate-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="custom-price" className="text-slate-700 font-bold text-xs uppercase flex items-center gap-2">
                        Special Offer Override <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px]">Optional</Badge>
                      </Label>
                      <div className="relative group">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input
                          id="custom-price"
                          type="number"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          placeholder="Custom total price..."
                          className="pl-9 border-slate-200 text-slate-900 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {selectedPlanId && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-1 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-blue-600 tracking-widest">
                          <span>Financial Projections</span>
                          <DollarSign size={12} />
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-slate-500 italic">Total {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Cost:</span>
                          <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                            ${getPreviewBill(selectedPlanId, 1, billingCycle, customPrice)}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium tracking-tight">Calculation based on single unit onboarding.</p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full py-6 text-sm font-bold"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <ShieldCheck className="mr-2" size={16} />}
                      Authorize Provisioning
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contract Monitoring Notifications */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.filter(c => clientService.getEffectiveStatus(c) === 'expired').length > 0 && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <ShieldAlert className="text-rose-600" size={20} />
              </div>
              <div>
                <p className="text-rose-900 font-bold text-sm">Action Required: {clients.filter(c => clientService.getEffectiveStatus(c) === 'expired').length} Expired</p>
                <p className="text-rose-600 text-[10px] uppercase font-mono tracking-wider">Device operations suspended</p>
              </div>
            </div>
          )}
          {clients.filter(c => clientService.getEffectiveStatus(c) === 'ending-soon').length > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-700 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Activity className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="text-amber-900 font-bold text-sm">Warning: {clients.filter(c => clientService.getEffectiveStatus(c) === 'ending-soon').length} Renewals Due</p>
                <p className="text-amber-600 text-[10px] uppercase font-mono tracking-wider">Access expires within 7 days</p>
              </div>
            </div>
          )}
          {clients.filter(c => clientService.getEffectiveStatus(c) === 'unpaid').length > 0 && (
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-1000 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-orange-900 font-bold text-sm">{clients.filter(c => clientService.getEffectiveStatus(c) === 'unpaid').length} Payments Overdue</p>
                <p className="text-orange-600 text-[10px] uppercase font-mono tracking-wider">Control functions locked</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[12px] uppercase bg-slate-50 text-slate-500 font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-200">Tenant Identity</th>
                  <th className="px-6 py-4 border-b border-slate-200">Location</th>
                  <th className="px-6 py-4 border-b border-slate-200">Selected Plan</th>
                  <th className="px-6 py-4 border-b border-slate-200">Device Fleet</th>
                  <th className="px-6 py-4 border-b border-slate-200">Financials</th>
                  <th className="px-6 py-4 border-b border-slate-200">Contract</th>
                  <th className="px-6 py-4 border-b border-slate-200">Payment</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{client.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono italic">{client.email}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Phone size={10} /> {client.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {client.address ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {client.address.flagUrl && <img referrerPolicy="no-referrer" src={client.address.flagUrl} alt="" className="w-3.5 h-2.5 object-cover rounded-sm shadow-sm" />}
                            <span className="text-xs truncate max-w-[100px]">{client.address.country}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium capitalize">{client.address.city}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-mono italic">Location Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-blue-50 border-blue-100 text-blue-700 font-bold text-[10px] uppercase tracking-tighter">
                        {plans.find(p => p.id === client.subscription.planId)?.name || 'Standard'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-700 font-mono">{getDeviceCount(client.id)}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Units</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-900">${calculateClientBill(client, plans, devices)}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{client.subscription.billingCycle || 'monthly'}</span>
                        {client.subscription.customPrice !== undefined && client.subscription.customPrice !== null && (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] px-1 py-0 h-3 mt-1">Special Offer</Badge>
                        )}
                        {client.subscription.isFirstMonthFree && (
                          <span className={`text-[9px] uppercase font-bold tracking-tighter ${(Date.now() - new Date(client.subscription.startDate).getTime()) > (30 * 24 * 60 * 60 * 1000)
                            ? 'text-rose-600'
                            : 'text-green-600'
                            }`}>
                            {(Date.now() - new Date(client.subscription.startDate).getTime()) > (30 * 24 * 60 * 60 * 1000)
                              ? 'Trial Surpassed'
                              : 'Trial Active'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Badge variant="outline" className={`w-fit font-bold text-[10px] uppercase tracking-tighter ${clientService.getEffectiveStatus(client) === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          clientService.getEffectiveStatus(client) === 'expired' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                            clientService.getEffectiveStatus(client) === 'trial-expired' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                              clientService.getEffectiveStatus(client) === 'unpaid' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                'bg-blue-50 border-blue-100 text-blue-700'
                          }`}>
                          {clientService.getEffectiveStatus(client).replace('-', ' ')}
                        </Badge>
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap mt-1">
                          Expires: {new Date(client.subscription.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold uppercase tracking-widest ${client.subscription.paymentStatus === 'paid' ? 'text-emerald-500' :
                          client.subscription.paymentStatus === 'unpaid' ? 'text-rose-500' : 'text-amber-500'
                          }`}>
                          {client.subscription.paymentStatus || 'paid'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          via {client.subscription.paymentMethod || 'Manual'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => handleViewOpen(client)}
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-amber-600"
                          onClick={() => handleEditOpen(client)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Dialog open={confirmDeleteId === client.id} onOpenChange={(open) => setConfirmDeleteId(open ? client.id : null)}>
                          <DialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </Button>
                            }
                          />
                          <DialogContent className="bg-white border-slate-200">
                            <DialogHeader>
                              <DialogTitle>Critical Deletion</DialogTitle>
                              <DialogDescription className="text-[11px] font-mono uppercase text-red-500 font-bold">
                                Permanent Data Removal
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-6 space-y-4">
                              <p className="text-sm text-slate-600">Are you sure you want to decommission <span className="font-bold text-slate-900">{client.name}</span>?</p>
                              <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest leading-relaxed">
                                  Warning: This will automatically delete all {getDeviceCount(client.id)} devices linked to this account.
                                </p>
                              </div>
                            </div>
                            <DialogFooter className="gap-2 sm:gap-0">
                              <Button variant="outline" onClick={() => setConfirmDeleteId(null)} className="h-11">Abstain</Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleDeleteClient(client.id, client.name)}
                                disabled={isSubmitting}
                                className="bg-red-600 hover:bg-red-700 h-11 font-bold"
                              >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirm Deletion"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSubscription(client)}
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 h-8"
                        >
                          {client.subscription.status === 'active' ? 'Suspend' : 'Resume'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center space-y-2 text-slate-300">
                        <Users size={48} className="opacity-20" />
                        <p className="italic font-mono text-xs">Awaiting client synchronization...</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="text-[11px] text-slate-400 italic font-mono uppercase tracking-widest mt-4 flex justify-between items-center">
        <span>Showing {filteredClients.length} registered core accounts.</span>
      </div>

      {clients.filter(c => clientService.getEffectiveStatus(c) === 'expired' || c.subscription.status === 'terminated').length > 0 && (
        <div className="space-y-4 pt-8">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Ended Contracts Archive</h3>
            <Badge className="bg-slate-200 text-slate-600 border-none text-[10px]">History & Tracking</Badge>
          </div>
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden opacity-80 grayscale-[0.5] hover:grayscale-0 transition-all">
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase bg-slate-50 text-slate-400 font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Tenant</th>
                    <th className="px-6 py-3">Contract Span</th>
                    <th className="px-6 py-3">Final Plan</th>
                    <th className="px-6 py-3">Closure Status</th>
                    <th className="px-6 py-3 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {clients.filter(c => clientService.getEffectiveStatus(c) === 'expired' || c.subscription.status === 'terminated').map(client => (
                    <tr key={client.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-600">{client.name}</td>
                      <td className="px-6 py-3 text-slate-400">
                        {new Date(client.subscription.startDate).toLocaleDateString()} — {new Date(client.subscription.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        {plans.find(p => p.id === client.subscription.planId)?.name}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[9px]">
                          {client.subscription.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewOpen(client)} className="h-7 text-[10px] font-bold">
                          RECORDS
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border-slate-200 max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleUpdateClient}>
            <DialogHeader>
              <DialogTitle className="text-slate-900">Modify Tenant Record</DialogTitle>
              <DialogDescription className="text-slate-500 font-mono text-[11px] uppercase tracking-tighter pt-1">
                Updates will be propagated across the node network
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-700">Full Name / Organization</Label>
                <Input
                  id="edit-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="border-slate-200 text-slate-900"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-slate-700">Contact Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="border-slate-200 text-slate-900"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password" className="text-slate-700">Mobile App Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-slate-200 text-slate-900"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-slate-700">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="border-slate-200 text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">Country</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="border-slate-200 text-slate-900 bg-white">
                      <SelectValue placeholder="Select Country" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 max-h-[200px]">
                      {countries.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          <div className="flex items-center gap-2">
                            <img referrerPolicy="no-referrer" src={c.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />
                            <span>{c.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">City</Label>
                  {cities.length > 0 ? (
                    <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedCountry || isLoadingCities}>
                      <SelectTrigger className="border-slate-200 text-slate-900 bg-white capitalize">
                        <SelectValue placeholder={isLoadingCities ? "Loading..." : (selectedCountry ? "Select City" : "First select country")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 max-h-[200px]">
                        {cities.map(city => (
                          <SelectItem key={city} value={city} className="capitalize">{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={selectedCountry ? (isLoadingCities ? "Loading..." : "Enter city") : "First select country"}
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      disabled={!selectedCountry}
                      className="border-slate-200 text-slate-900 bg-white capitalize h-9 text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan" className="text-slate-700 font-bold text-xs uppercase">Subscription Offer</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                      <SelectValue placeholder="Select an offer" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex flex-col text-left py-1">
                            <span className="font-bold text-slate-800">{plan.name}</span>
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest">{plan.pricingModel === 'per_device' ? `$${plan.price}/dev` : `$${plan.price} Flat`}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cycle" className="text-slate-700 font-bold text-xs uppercase">Billing Cycle</Label>
                  <Select value={billingCycle} onValueChange={(val: any) => setBillingCycle(val)}>
                    <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                      <SelectValue placeholder="Cycle" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold text-xs uppercase">Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={(val: any) => setPaymentStatus(val)}>
                    <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold text-xs uppercase">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="border-slate-200 text-slate-900 bg-white shadow-sm">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="Manual">Manual Settlement</SelectItem>
                      <SelectItem value="Stripe">Stripe (Future)</SelectItem>
                      <SelectItem value="Bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold text-xs uppercase">Contract End Date</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="border-slate-200 text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-custom-price" className="text-slate-700 font-bold text-xs uppercase flex items-center gap-2">
                  Special Offer Override <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px]">Active</Badge>
                </Label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input
                    id="edit-custom-price"
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="Override total price..."
                    className="pl-9 border-slate-200 text-slate-900 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {selectedPlanId && selectedClient && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    <span>Financial Performance Projection</span>
                    <DollarSign size={12} />
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-slate-500 italic">Total for {getDeviceCount(selectedClient.id)} nodes:</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                      ${getPreviewBill(selectedPlanId, getDeviceCount(selectedClient.id), billingCycle, customPrice)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-slate-800 text-white w-full py-6 text-sm font-bold"
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <ShieldCheck className="mr-2" size={16} />}
                Commit Record Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-2xl bg-white border-slate-200 p-0 overflow-hidden">
          {selectedClient && (
            <div className="flex flex-col">
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold">{selectedClient.name}</h3>
                    <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mt-1">Tenant ID: {selectedClient.id}</p>
                  </div>
                  <Users className="text-blue-400 opacity-50" size={32} />
                </div>
              </div>
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block mb-1">Fleet Deployment</Label>
                    <div className="text-xl font-bold text-slate-900 font-mono">{getDeviceCount(selectedClient.id)} Active Nodes</div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block mb-1">Financial Standing</Label>
                    <div className="text-xl font-bold text-slate-900 font-mono">${calculateClientBill(selectedClient, plans, devices)}/{selectedClient.subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}</div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ShieldCheck size={80} />
                  </div>
                  <div className="relative space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[3px]">Active Contract Logistics</h4>
                      <Badge className={
                        clientService.getEffectiveStatus(selectedClient) === 'active' ? 'bg-emerald-500' :
                          clientService.getEffectiveStatus(selectedClient) === 'expired' ? 'bg-rose-500' :
                            clientService.getEffectiveStatus(selectedClient) === 'trial-expired' ? 'bg-orange-500' : 'bg-amber-500'
                      }>
                        {clientService.getEffectiveStatus(selectedClient).toUpperCase().replace('-', ' ')}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Effective Start</p>
                        <p className="text-sm font-bold text-slate-800">{new Date(selectedClient.subscription.startDate).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Termination Date</p>
                        <p className="text-sm font-bold text-slate-800">{new Date(selectedClient.subscription.endDate).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Time Remaining</p>
                        <p className="text-sm font-bold text-slate-800">
                          {Math.ceil((new Date(selectedClient.subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Days
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Payment Methodology</p>
                        <p className="text-xs font-medium text-slate-700">{selectedClient.subscription.paymentMethod || 'Manual Bank Settlement'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Escrow Status</p>
                        <p className={`text-xs font-black uppercase ${selectedClient.subscription.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {selectedClient.subscription.paymentStatus || 'VERIFICATION PENDING'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[3px]">Linked Device Inventory</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {getClientDevices(selectedClient.id).map(device => (
                      <div key={device.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg group hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-3">
                          <Cpu className="text-slate-400 group-hover:text-blue-500 transition-colors" size={16} />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{device.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{device.hardwareId}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[9px] border-none ${device.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {device.status.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                    {getClientDevices(selectedClient.id).length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                        <p className="text-[10px] text-slate-400 font-mono uppercase italic tracking-widest">No hardware registered</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedClient.address && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Regional Deployment Center</Label>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        {selectedClient.address.flagUrl && <img referrerPolicy="no-referrer" src={selectedClient.address.flagUrl} alt="" className="w-4 h-3 object-cover rounded-sm" />}
                        <span className="capitalize">{selectedClient.address.city}, {selectedClient.address.country}</span>
                      </div>
                    </div>
                    {selectedClient.address.coordinates && (
                      <MapPreview
                        lat={selectedClient.address.coordinates.lat}
                        lng={selectedClient.address.coordinates.lng}
                        title={selectedClient.name}
                        className="h-[200px]"
                      />
                    )}
                  </div>
                )}

                <div className="pt-6">
                  <Button variant="ghost" className="w-full text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest" onClick={() => setIsViewOpen(false)}>
                    Terminate Session
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
