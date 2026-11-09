import React from 'react';
import { Activity, Bell, CreditCard, Database, LayoutDashboard, LogOut, Settings, Users } from 'lucide-react';
import { useAuth } from '../../core/auth/auth-context';
import { auth } from '../../core/services/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import GlowixLogo from '../ui/GlowixLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed }) => {
  const { isAdmin, user } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, displayIcon: '◈' },
    { id: 'clients', label: 'Client Registry', icon: Users, displayIcon: '▤' },
    { id: 'devices', label: 'Device Fleet', icon: Database, displayIcon: '⬢' },
    { id: 'subscriptions', label: 'Subscription Mgr', icon: CreditCard, displayIcon: '💳' },
    { id: 'notifications', label: 'Audit Hub', icon: Bell, displayIcon: '⌬' },
    { id: 'settings', label: 'Global Config', icon: Settings, displayIcon: '⚙' },
  ];

  return (
    <aside className={cn(
      "bg-[#0f172a] text-[#f8fafc] flex flex-col h-screen sticky top-0 shadow-xl transition-all duration-300 ease-in-out z-50",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("p-6 border-b border-white/10 overflow-hidden flex items-center", collapsed ? "px-0 justify-center" : "gap-3")}>
        <GlowixLogo size={32} />
        <h1 className={cn("text-lg font-bold tracking-[1px] uppercase transition-all whitespace-nowrap", collapsed ? "opacity-0 w-0" : "opacity-100")}>
          Glowix
        </h1>
      </div>

      <nav className="flex-1 py-5 space-y-0 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={collapsed ? item.label : ""}
            className={cn(
              "w-full flex items-center space-x-3 px-6 py-3 text-[14px] transition-all duration-200 cursor-pointer text-left relative",
              activeTab === item.id
                ? "bg-[#334155] border-l-4 border-[#38bdf8] text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
              collapsed && "px-0 justify-center border-l-0"
            )}
          >
            {collapsed && activeTab === item.id && (
              <div className="absolute left-0 w-1 h-8 bg-[#38bdf8] rounded-r-full" />
            )}
            <span className={cn("text-lg flex justify-center opacity-70", collapsed ? "w-full" : "w-5")}>{item.displayIcon}</span>
            {!collapsed && <span className="font-medium whitespace-nowrap animate-in fade-in slide-in-from-left-2">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className={cn("p-6 transition-all", collapsed && "px-2 flex flex-col items-center")}>
        {!collapsed && <div className="text-[11px] opacity-50 font-mono tracking-wider"></div>}
        <button
          onClick={() => signOut(auth)}
          title={collapsed ? "Terminate Session" : ""}
          className={cn(
            "mt-4 flex items-center space-x-2 text-xs text-slate-400 hover:text-red-400 transition-colors",
            collapsed && "ml-0 space-x-0 p-2 hover:bg-red-500/10 rounded-lg"
          )}
        >
          <LogOut size={collapsed ? 20 : 14} />
          {!collapsed && <span>Terminate Session</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
