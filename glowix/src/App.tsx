import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './core/auth/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Dashboard from '@/features/dashboard/Dashboard';
import Clients from '@/features/clients/Clients';
import Devices from '@/features/devices/Devices';
import Subscriptions from '@/features/subscriptions/Subscriptions';
import Settings from '@/features/settings/Settings';
import Notifications from '@/features/notifications/Notifications';
import Login from '@/features/auth/Login';
import { Toaster } from '@/components/ui/sonner';
import { clientService, planService, telemetryService } from '@/core/services/data-service';
import { Client, Plan, Alert } from '@/core/models/iot.types';
import { getDaysRemaining } from '@/core/utils/notifications';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Bell, Command, Activity, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { motion } from 'motion/react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    if (user) {
      planService.seedPlans();
      const unsubClients = clientService.subscribeToClients(setClients);
      const unsubAlerts = telemetryService.subscribeToAlerts(setAlerts);
      return () => {
        unsubClients();
        unsubAlerts();
      };
    }
  }, [user]);

  useEffect(() => {
    if (clients.length > 0) {
      clientService.checkSubscriptionAlerts(clients);
    }
  }, [clients]);

  const notifications = [
    ...alerts.map(a => ({
      id: a.id,
      type: a.severity === 'critical' ? 'alert' : 'warning',
      message: a.deviceId === 'SYSTEM'
        ? `Alerte Système: ${a.message}`
        : `Critique: ${a.message} (Device: ${a.deviceId.slice(0, 5)})`
    }))
  ].filter(Boolean) as any[];

  const activeNotifications = notifications.filter(n => !dismissedAlertIds.includes(n.id || ''));

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedAlertIds(prev => [...prev, id]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white font-bold gap-4">
        <Activity size={48} className="text-blue-500 animate-pulse" />
        <span className="tracking-widest uppercase text-xs opacity-50">Initializing Core Systems</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex bg-[#f8fafc] min-h-screen text-slate-900 overflow-hidden h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} collapsed={isSidebarCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 flex-shrink-0">
          <div className="flex items-center gap-12 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="text-slate-400 hover:text-slate-900 transition-colors"
            >
              {isSidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            </Button>

            <div className="text-sm text-slate-500 hidden xl:block">
              Admin / <span className="text-slate-900 font-bold capitalize tracking-tight">{activeTab.replace('-', ' ')}</span>
            </div>

            <div className="relative max-w-md w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <Input
                placeholder="Search endpoints, clients, or audits..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-11 pr-24 bg-slate-50 border-slate-100 h-11 focus-visible:ring-blue-500 focus-visible:bg-white transition-all rounded-xl"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-400 font-mono font-bold">
                <Command size={10} /> K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [4, 12, 8, 14, 6][i % 5] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1 bg-blue-500/30 rounded-full"
                  />
                ))}
              </div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">System Status</span>
            </div>

            <div className="relative group">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
                <Bell size={20} />
                {activeNotifications.length > 0 && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                    {activeNotifications.length}
                  </div>
                )}
              </Button>

              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Alertes Système</h4>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest"
                  >
                    View All
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {activeNotifications.length > 0 ? activeNotifications.map((n, i) => (
                    <div
                      key={n.id || i}
                      onClick={() => setActiveTab('notifications')}
                      className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer group/item"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${n?.type === 'alert' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                        <div className="flex-1">
                          <span className="text-[11px] font-bold text-slate-700 leading-tight block">{n?.message}</span>
                        </div>
                        {n.id && (
                          <button
                            onClick={(e) => handleDismiss(e, n.id!)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-600 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest">Aucune alerte en cours</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pl-6 border-l border-slate-100">
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-bold text-slate-900 leading-tight">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active Tier</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[14px] font-bold shadow-lg shadow-blue-500/20">
                {(user?.email?.charAt(0) || 'A').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full">
          {activeTab === 'dashboard' && <Dashboard externalSearch={globalSearch} onNavigate={setActiveTab} />}
          {activeTab === 'clients' && <Clients externalSearch={globalSearch} />}
          {activeTab === 'devices' && <Devices externalSearch={globalSearch} />}
          {activeTab === 'notifications' && <Notifications externalSearch={globalSearch} />}
          {activeTab === 'subscriptions' && <Subscriptions externalSearch={globalSearch} />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
      <Toaster position="top-center" theme="light" />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
