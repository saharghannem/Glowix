import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  ShieldCheck, 
  Trash2, 
  X,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { telemetryService, clientService, planService } from '../../core/services/data-service';
import { Client, Alert, Plan } from '../../core/models/iot.types';
import { getDaysRemaining } from '../../core/utils/notifications';
import { toast } from 'sonner';

interface NotificationsProps {
  externalSearch?: string;
}

const Notifications: React.FC<NotificationsProps> = ({ externalSearch }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'subscription'>('all');
  const [dismissedLocal, setDismissedLocal] = useState<string[]>([]);

  useEffect(() => {
    const unsubAlerts = telemetryService.subscribeToAlerts(setAlerts, 100, true);
    const unsubClients = clientService.subscribeToClients(setClients);
    const unsubPlans = planService.subscribeToPlans(setPlans);

    return () => {
      unsubAlerts();
      unsubClients();
      unsubPlans();
    };
  }, []);

  const handleMarkAsSeen = async (notif: Alert) => {
    try {
      await telemetryService.markAlertAsSeen(notif.id);
      toast.success("Alerte marquée comme vue.");
    } catch (error) {
      toast.error("Impossible de mettre à jour le statut.");
    }
  };

  const allNotifications = alerts
    .filter(n => !dismissedLocal.includes(n.id))
    .sort((a, b) => b.timestamp - a.timestamp);

  const s = externalSearch?.toLowerCase() || '';
  const filteredNotifications = allNotifications.filter(n => {
    const isSystem = n.deviceId === 'SYSTEM';
    const matchesSearch = n.message.toLowerCase().includes(s);
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'critical') return matchesSearch && n.severity === 'critical';
    if (filter === 'subscription') return matchesSearch && isSystem;
    return matchesSearch;
  });

  return (
    <div className="p-8 space-y-8 bg-[#f8fafc] min-h-screen">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Notification <span className="text-rose-600">Hub</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Audit log of system events and alerts.</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
          <Button 
            variant={filter === 'all' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setFilter('all')}
            className={`text-[10px] font-bold uppercase tracking-widest h-8 ${filter === 'all' ? 'bg-[#0f172a] text-white' : 'text-slate-500'}`}
          >
            All Logs
          </Button>
          <Button 
            variant={filter === 'critical' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setFilter('critical')}
            className={`text-[10px] font-bold uppercase tracking-widest h-8 ${filter === 'critical' ? 'bg-[#0f172a] text-white' : 'text-slate-500'}`}
          >
            Critical
          </Button>
          <Button 
            variant={filter === 'subscription' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setFilter('subscription')}
            className={`text-[10px] font-bold uppercase tracking-widest h-8 ${filter === 'subscription' ? 'bg-[#0f172a] text-white' : 'text-slate-500'}`}
          >
            Alertes Système
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-slate-200 bg-white shadow-xl shadow-slate-200/40">
          <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Incident Registry</CardTitle>
              <CardDescription>Comprehensive history of all detected system state changes.</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono tracking-tighter text-slate-400 border-slate-200">
              Total Entries: {filteredNotifications.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {filteredNotifications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filteredNotifications.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 100, height: 0 }}
                      transition={{ duration: 0.2 }}
                      layout
                      className="p-6 hover:bg-slate-50/80 transition-colors group"
                    >
                      <div className="flex gap-5">
                        <div className={`p-3 rounded-2xl shrink-0 h-fit ${
                          notif.severity === 'critical' ? 'bg-rose-100 text-rose-600 shadow-rose-200/50' : 
                          notif.severity === 'warning' ? 'bg-amber-100 text-amber-600 shadow-amber-200/50' : 
                          'bg-blue-100 text-blue-600 shadow-blue-200/50'
                        } shadow-lg shadow-current/10 animate-in fade-in zoom-in`}>
                          {notif.deviceId === 'SYSTEM' ? <CreditCard size={20} /> : <AlertTriangle size={20} />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold text-slate-900">{notif.message}</h4>
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] text-slate-400 font-mono italic flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(notif.timestamp).toLocaleString()}
                              </span>
                              <Button
                                onClick={() => handleMarkAsSeen(notif)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-50 hover:text-emerald-600"
                                title="Mark as seen"
                              >
                                <Eye size={14} />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
                            {notif.deviceId === 'SYSTEM' 
                              ? "Alerte de gestion de compte générée par le système central."
                              : `Anomalie détectée sur le point de terminaison ${notif.deviceId}. Paramètres système hors des limites autorisées.`}
                          </p>
                          <div className="flex items-center gap-2 mt-4">
                            <Badge variant="secondary" className="bg-slate-100/50 text-slate-500 text-[9px] font-black uppercase tracking-widest border-none">
                              {notif.deviceId === 'SYSTEM' ? 'subscription' : 'telemetry'}
                            </Badge>
                            {notif.clientId && (
                              <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-600 bg-white">
                                {clients.find(c => c.id === notif.clientId)?.name || `ID: ${notif.clientId}`}
                              </Badge>
                            )}
                            {notif.deviceId !== 'SYSTEM' && (
                              <code className="text-[9px] text-blue-500 bg-blue-50/50 px-2 py-0.5 rounded font-mono font-bold">
                                DEV_ID: {notif.deviceId}
                              </code>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                <ShieldCheck size={64} className="opacity-10 mb-6 drop-shadow-2xl" />
                <h3 className="text-lg font-bold text-slate-400 uppercase tracking-[4px]">System Integrity: Optimal</h3>
                <p className="text-sm font-medium italic mt-2 opacity-60">No matching logs found in the current registry.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
