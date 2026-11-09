import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowUpRight, ArrowDownRight, Activity, Zap, Shield, Sparkles, AlertCircle, Clock, Plus, Edit, Trash2, Loader2, Check } from 'lucide-react';
import { clientService, planService, deviceService } from '@/core/services/data-service';
import { Client, Plan, Device } from '@/core/models/iot.types';
import { calculateMRR } from '@/core/utils/billing';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface SubscriptionsProps {
  externalSearch?: string;
}

const Subscriptions: React.FC<SubscriptionsProps> = ({ externalSearch }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('0');
  const [planDevices, setPlanDevices] = useState('5');
  const [pricingModel, setPricingModel] = useState<'flat' | 'per_device'>('flat');

  useEffect(() => {
    const unsubClients = clientService.subscribeToClients(setClients);
    const unsubPlans = planService.subscribeToPlans(setPlans);
    const unsubDevices = deviceService.subscribeToDevices(setDevices);

    return () => {
      unsubClients();
      unsubPlans();
      unsubDevices();
    };
  }, []);

  const s = externalSearch?.toLowerCase() || '';
  const filteredPlans = plans.filter(p => 
    (p.name?.toLowerCase().includes(s) ?? false) || 
    (p.pricingModel?.toLowerCase().includes(s) ?? false) ||
    p.features?.some(f => f?.toLowerCase().includes(s))
  );

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await planService.createPlan({
        name: planName,
        price: Number(planPrice),
        maxDevices: Number(planDevices),
        pricingModel: pricingModel,
        features: ['Priority Support', 'Telemetry API', 'Access Logs']
      });
      toast.success("New subscription tier established.");
      setIsAddOpen(false);
      resetForm();
    } catch (err) {
      toast.error("Failed to establish plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setIsSubmitting(true);
    try {
      await planService.updatePlan(selectedPlan.id, {
        name: planName,
        price: Number(planPrice),
        maxDevices: Number(planDevices),
        pricingModel: pricingModel
      });
      toast.success("Tier updated successfully.");
      setIsEditOpen(false);
      resetForm();
    } catch (err) {
      toast.error("Modification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeletePlan = async (id: string, name: string) => {
    setIsSubmitting(true);
    try {
      await planService.deletePlan(id);
      toast.success(`${name} tier decommissioned.`);
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error("Deletion failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(String(plan.price));
    setPlanDevices(String(plan.maxDevices));
    setPricingModel(plan.pricingModel);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setPlanName('');
    setPlanPrice('0');
    setPlanDevices('5');
    setPricingModel('flat');
    setSelectedPlan(null);
  };

  const stats = {
    paid: clients.filter(c => c.subscription.status === 'active' && !c.subscription.isFirstMonthFree).length,
    expired: clients.filter(c => c.subscription.status === 'expired').length,
    trialing: clients.filter(c => c.subscription.status === 'active' && c.subscription.isFirstMonthFree).length,
  };

  const totalMRR = clients
    .filter(c => c.subscription.status === 'active' && !c.subscription.isFirstMonthFree)
    .reduce((acc, c) => acc + calculateMRR(c, plans, devices), 0);

  return (
    <div className="p-8 space-y-6 bg-[#f1f5f9] min-h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Subscription Fleet</h2>
          <p className="text-slate-500 font-mono text-[11px] uppercase tracking-wider mt-1">SaaS Recurring Revenue Monitoring</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => toast.success("Exporting ledger to CSV...")}
            variant="outline"
            className="border-slate-200 text-slate-600 rounded-md shadow-sm h-9 px-6 text-xs font-bold uppercase tracking-widest"
          >
            Export Ledger
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger
              render={
                <Button className="bg-[#0f172a] hover:bg-slate-800 text-white rounded-md shadow-sm h-9 px-6 text-xs font-bold uppercase tracking-widest">
                  <Plus size={14} className="mr-2" /> New Offer
                </Button>
              }
            />
            <DialogContent className="bg-white border-slate-200">
              <form onSubmit={handleAddPlan}>
                <DialogHeader>
                  <DialogTitle>Create New Tier</DialogTitle>
                  <DialogDescription className="font-mono text-[11px] uppercase">Marketplace SKU Setup</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="space-y-2">
                    <Label>Tier Name</Label>
                    <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Pro Suite" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-xs font-black uppercase text-slate-400">Pricing Model</Label>
                       <Select value={pricingModel} onValueChange={(val: any) => setPricingModel(val)}>
                         <SelectTrigger className="bg-slate-50 border-slate-200">
                           <SelectValue placeholder="Model" />
                         </SelectTrigger>
                         <SelectContent className="bg-white border-slate-200">
                           <SelectItem value="flat">Flat Fee</SelectItem>
                           <SelectItem value="per_device">Per Device</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase text-slate-400">Monthly Price ($)</Label>
                      <Input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} required className="bg-slate-50 border-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">Maximum Node Capacity</Label>
                    <Input type="number" value={planDevices} onChange={e => setPlanDevices(e.target.value)} placeholder="e.g. 50" required className="bg-slate-50 border-slate-200" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Deploy Offer"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mb-1">Monthly MRR</div>
            <Sparkles className="text-amber-500" size={16} />
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono mt-2">${totalMRR.toLocaleString()}</div>
          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">Live Revenue Projection</div>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mb-1">Paid Accounts</div>
            <Shield className="text-green-500" size={16} />
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono mt-2">{stats.paid}</div>
          <div className="mt-2 text-[10px] text-green-600 font-bold uppercase tracking-tighter">Settled Recurring</div>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm p-6 border-amber-100 bg-amber-50/10">
          <div className="flex justify-between items-start">
            <div className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mb-1">Trial Phase</div>
            <Clock className="text-amber-500" size={16} />
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono mt-2">{stats.trialing}</div>
          <div className="mt-2 text-[10px] text-amber-600 font-bold uppercase tracking-tighter">First Month Free</div>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm p-6 border-red-50">
          <div className="flex justify-between items-start">
            <div className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mb-1">Expired / Defaulters</div>
            <AlertCircle className="text-red-500" size={16} />
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono mt-2">{stats.expired}</div>
          <div className="mt-2 text-[10px] text-red-600 font-bold uppercase tracking-tighter">Access Blocked</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {filteredPlans.map((plan) => (
          <Card key={plan.id} className={`bg-white border-slate-200 shadow-sm overflow-hidden flex flex-col group`}>
            <div className={`p-4 border-b border-slate-100 bg-slate-50 text-slate-600 text-center relative`}>
              <h3 className="text-xs font-bold uppercase tracking-[2px]">{plan.name}</h3>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-amber-500" onClick={() => openEdit(plan)}>
                  <Edit size={12} />
                </Button>
                <Dialog open={confirmDeleteId === plan.id} onOpenChange={(open) => setConfirmDeleteId(open ? plan.id : null)}>
                  <DialogTrigger
                    render={
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </Button>
                    }
                  />
                  <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                      <DialogTitle>Decommission SKU</DialogTitle>
                      <DialogDescription className="font-mono text-[11px] uppercase text-red-500">Inventory Liquidation</DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                      <p className="text-sm text-slate-600">Remove <span className="font-bold text-slate-900">{plan.name}</span> from the marketplace?</p>
                      <p className="text-[10px] text-slate-400 mt-2 italic font-mono">Existing subscribers will retain access until renewal.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Abstain</Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => handleDeletePlan(plan.id, plan.name)}
                        disabled={isSubmitting}
                        className="bg-red-600 font-bold"
                      >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Decommission Offer"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <CardContent className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-4xl font-bold text-slate-900 font-mono tracking-tighter">
                ${plan.price}
                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">
                  {plan.pricingModel === 'per_device' ? '/dev/mo' : '/mo'}
                </span>
              </div>
              <div className="space-y-2 text-sm text-slate-500">
                <p className="font-bold text-slate-700">Capacity: {plan.maxDevices} Nodes</p>
                <div className="h-px w-8 bg-slate-100 mx-auto"></div>
                {plan.features.map(f => <p key={f} className="flex items-center justify-center gap-2 text-[11px]"><Check size={10} className="text-blue-500" /> {f}</p>)}
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-20 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-300">
             <Zap size={48} className="opacity-20 animate-pulse" />
             <p className="font-mono text-[11px] uppercase font-bold mt-4 tracking-widest">Awaiting SKU deployment...</p>
          </div>
        )}
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white border-slate-200">
          <form onSubmit={handleUpdatePlan}>
            <DialogHeader>
              <DialogTitle>Update Subscription Tier</DialogTitle>
              <DialogDescription className="font-mono text-[11px] uppercase">SKU Property Modification</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="space-y-2">
                <Label>Tier Name</Label>
                <Input value={planName} onChange={e => setPlanName(e.target.value)} required />
              </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">Pricing Model</Label>
                    <Select value={pricingModel} onValueChange={(val: any) => setPricingModel(val)}>
                      <SelectTrigger className="bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        <SelectItem value="flat">Flat Fee</SelectItem>
                        <SelectItem value="per_device">Per Device</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">Monthly Price ($)</Label>
                    <Input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} required className="bg-slate-50 border-slate-200" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Maximum Node Capacity</Label>
                  <Input type="number" value={planDevices} onChange={e => setPlanDevices(e.target.value)} required className="bg-slate-50 border-slate-200" />
                </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Commit Modification"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Card className="bg-white border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center space-y-4 mt-8 border-dashed">
         <CreditCard size={40} className="text-slate-200" />
         <div>
           <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Gateway Configuration Required</p>
           <p className="text-slate-400 text-[11px] italic font-mono mt-1">Stripe / Adyen Merchant Credentials not detected in environment</p>
         </div>
         <Button variant="outline" className="border-slate-200 text-slate-400 hover:text-slate-600 h-9 px-8 text-xs font-bold">
           Initialize Provider Setup
         </Button>
      </Card>
    </div>
  );
};

export default Subscriptions;
