'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Search, MessageSquare, Bookmark,
  Bell, LogOut, User, ChevronDown,
  BarChart3, Users, Menu, X, Briefcase, MapPin, CreditCard,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { clearAuth, getStoredUser } from '@/lib/auth';
import { User as UserType } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TENANT_NAV: NavItem[] = [
  { href: '/tenant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenant/profile', label: 'My Profile', icon: User },
  { href: '/tenant/interests', label: 'Interest Received', icon: Bell },
  { href: '/tenant/messages', label: 'Messages', icon: MessageSquare },
];

const LANDLORD_NAV: NavItem[] = [
  { href: '/landlord/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/landlord/search', label: 'Find Tenants', icon: Search },
  { href: '/landlord/saved', label: 'Saved Tenants', icon: Bookmark },
  { href: '/landlord/interests', label: 'My Outreach', icon: Bell },
  { href: '/landlord/messages', label: 'Messages', icon: MessageSquare },
  { href: '/landlord/deals', label: 'Deal Pipeline', icon: Briefcase },
  { href: '/landlord/billing', label: 'Billing', icon: CreditCard },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  landlord: 'Landlord / Broker',
  tenant: 'Tenant',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-50 text-red-700 border-red-100',
  landlord: 'bg-brand-50 text-brand-700 border-brand-100',
  tenant: 'bg-accent-50 text-accent-700 border-accent-100',
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/login'); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const navItems = user.role === 'admin' ? ADMIN_NAV : user.role === 'landlord' ? LANDLORD_NAV : TENANT_NAV;

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-brand-950 transition-transform duration-300 lg:translate-x-0 lg:static lg:flex w-64',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-brand-900">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-lg tracking-tight">
              <span className="text-white">Demand</span>
              <span className="text-accent-400"> RE</span>
            </span>
          </Link>
          <button className="lg:hidden text-brand-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-4 pt-4 pb-2">
          <div className={cn('px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-wide', ROLE_COLORS[user.role])}>
            {ROLE_LABELS[user.role]}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-brand-600 text-white shadow-blue'
                    : 'text-brand-300 hover:bg-brand-800/60 hover:text-white'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-brand-900 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-brand-400 truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-brand-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center px-5 flex-shrink-0 gap-4">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-neutral-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-neutral-600" />
          </button>

          {/* Breadcrumb / page name */}
          <div className="flex-1 hidden sm:block">
            <div className="text-sm text-neutral-400">
              demandre.ai
              <span className="mx-1.5 text-neutral-300">/</span>
              <span className="text-neutral-600 font-medium capitalize">
                {pathname.split('/').filter(Boolean).join(' / ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200">
              <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {getInitials(user.firstName, user.lastName)}
              </div>
              <span className="hidden sm:block text-sm font-medium text-neutral-700">{user.firstName}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
