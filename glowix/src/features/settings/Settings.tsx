import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Database, RefreshCcw, HardDrive, Key, Globe } from 'lucide-react';
import { useAuth } from '@/core/auth/auth-context';
import { toast } from 'sonner';
import { planService } from '@/core/services/data-service';

const Settings: React.FC = () => {
  const { user } = useAuth();

  const handleSeedData = async () => {
    toast.loading("Initializing default plans...");
    try {
      await planService.seedPlans();
      toast.dismiss();
      toast.success("Default subscription plans initialized.");
    } catch (err) {
      toast.dismiss();
      toast.error("Initialization failed.");
      console.error(err);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#f1f5f9] min-h-full">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Portal Architecture</h2>
        <p className="text-slate-500 font-mono text-[11px] uppercase tracking-wider mt-1">System Configuration & Data Scaffolding</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <ShieldCheck size={14} /> Admin Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Active Email</Label>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded font-mono text-xs text-slate-700">
                  {user?.email}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Access Role</Label>
                <div className="flex items-center space-x-2 text-green-600">
                  <span className="text-[10px] font-bold uppercase tracking-widest italic font-mono px-2 py-1 bg-green-50 rounded">Root Administrator</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-blue-100 bg-blue-50/10">
            <CardHeader className="bg-blue-50/50 border-b border-blue-100 py-4 px-6">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                <Database size={14} /> Subscription Plans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-[11px] text-slate-500 leading-relaxed italic">
                Initialize or sync the default tier plans for the subscription system.
              </p>
              <Button 
                onClick={handleSeedData}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full uppercase font-bold tracking-widest text-[10px] py-6 shadow-md"
              >
                <RefreshCcw size={14} className="mr-2" /> Initialize Default Plans
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-[12px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                Global Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {[
                { label: 'Data Retention', value: '90 Days', icon: HardDrive },
                { label: 'API Region', value: 'US-EAST-1', icon: Globe },
                { label: 'Encryption Standard', value: 'AES-256-GCM', icon: Key },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-700 font-bold bg-slate-50 px-2 py-1 rounded">{item.value}</span>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-50">
                <Button variant="ghost" className="w-full text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-900">
                  Update System Parameters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
