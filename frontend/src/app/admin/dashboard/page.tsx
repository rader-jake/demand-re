'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Building2, TrendingUp, Bell, ShieldCheck,
  Loader2, ArrowRight, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getErrorMessage } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';

interface AdminOverview {
  totalUsers: number;
  totalTenants: number;
  totalLandlords: number;
  activeProfiles: number;
  totalInterests: number;
  totalDeals: number;
  newUsersToday: number;
  newUsersThisWeek: number;
}

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminApi.getOverview(),
      adminApi.getUsers({ page: 1, limit: 8, sortBy: 'created_at', sortOrder: 'desc' }),
    ]).then(([overviewRes, usersRes]) => {
      setOverview(overviewRes.data.overview);
      setRecentUsers(usersRes.data.users ?? []);
    }).catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    setTogglingId(userId);
    try {
      await adminApi.updateUserStatus(userId, !isActive);
      setRecentUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, isActive: !u.isActive } : u
      ));
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  const stats = overview ? [
    { label: 'Total Users', value: overview.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', delta: `+${overview.newUsersToday} today` },
    { label: 'Active Profiles', value: overview.activeProfiles, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Tenants', value: overview.totalTenants, icon: Building2, color: 'text-purple-600 bg-purple-50' },
    { label: 'Interests', value: overview.totalInterests, icon: Bell, color: 'text-amber-600 bg-amber-50' },
    { label: 'Landlords', value: overview.totalLandlords, icon: Building2, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active Deals', value: overview.totalDeals, icon: TrendingUp, color: 'text-rose-600 bg-rose-50' },
  ] : [];

  return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between page-header">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Platform overview and user management</p>
          </div>
          <Link href="/admin/analytics" className="btn-primary gap-2">
            <TrendingUp className="w-4 h-4" /> Analytics
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card flex flex-col gap-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-neutral-900">{stat.value.toLocaleString()}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
                {'delta' in stat && stat.delta && (
                  <div className="text-xs text-emerald-600 font-medium mt-0.5">{stat.delta}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: 'Manage Users', desc: 'View, activate, deactivate users', href: '/admin/users', color: 'bg-blue-50 text-blue-700' },
            { label: 'Analytics', desc: 'Demand heatmaps and tenant insights', href: '/admin/analytics', color: 'bg-purple-50 text-purple-700' },
            { label: 'Export Data', desc: 'Download platform analytics as JSON', href: '/admin/analytics#export', color: 'bg-emerald-50 text-emerald-700' },
          ].map((link) => (
            <Link key={link.label} href={link.href} className="card p-5 flex items-center justify-between hover:shadow-soft transition-shadow">
              <div>
                <div className={cn('text-sm font-semibold mb-1', link.color.split(' ')[1])}>{link.label}</div>
                <div className="text-xs text-neutral-400">{link.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* Recent users */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900">Recent Users</h3>
            <Link href="/admin/users" className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-neutral-50">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-neutral-900">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn('badge text-xs capitalize',
                    user.role === 'admin' ? 'bg-red-100 text-red-700' :
                    user.role === 'landlord' ? 'bg-blue-100 text-blue-700' :
                    'bg-purple-100 text-purple-700'
                  )}>
                    {user.role}
                  </span>
                  {user.isVerified
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <Clock className="w-4 h-4 text-amber-400" />
                  }
                  <span className="text-xs text-neutral-400">{formatRelative(user.createdAt)}</span>
                  <button
                    onClick={() => toggleUserStatus(user.id, user.isActive)}
                    disabled={togglingId === user.id || user.role === 'admin'}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40',
                      user.isActive
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    )}
                  >
                    {togglingId === user.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : user.isActive ? 'Deactivate' : 'Activate'
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health indicators */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-neutral-900 mb-4">Platform Health</h3>
            <div className="space-y-3">
              {[
                { label: 'New users this week', value: overview?.newUsersThisWeek ?? 0, good: (overview?.newUsersThisWeek ?? 0) > 0 },
                { label: 'Active tenant profiles', value: overview?.activeProfiles ?? 0, good: (overview?.activeProfiles ?? 0) > 0 },
                { label: 'Interest expressions', value: overview?.totalInterests ?? 0, good: (overview?.totalInterests ?? 0) > 0 },
                { label: 'Deals in pipeline', value: overview?.totalDeals ?? 0, good: (overview?.totalDeals ?? 0) > 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.good
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <XCircle className="w-4 h-4 text-neutral-300" />
                    }
                    <span className="text-sm text-neutral-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-neutral-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Recompute all tenant scores', href: '/admin/analytics', icon: TrendingUp },
                { label: 'Refresh demand heatmap', href: '/admin/analytics', icon: Bell },
                { label: 'Export analytics report', href: '/admin/analytics#export', icon: ArrowRight },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <span className="text-sm text-neutral-700 group-hover:text-neutral-900">{action.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-300 ml-auto group-hover:text-neutral-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
