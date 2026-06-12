'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
      const data = overviewRes.data;
      const overviewObj: AdminOverview = {
        totalUsers: parseInt(data.users?.total_users || '0', 10),
        totalTenants: parseInt(data.users?.total_tenants || '0', 10),
        totalLandlords: parseInt(data.users?.total_landlords || '0', 10),
        activeProfiles: parseInt(data.tenants?.active_profiles || '0', 10),
        totalInterests: parseInt(data.interests?.total || '0', 10),
        totalDeals: 0,
        newUsersToday: 0,
        newUsersThisWeek: parseInt(data.users?.new_this_week || '0', 10),
      };
      setOverview(overviewObj);

      const normalizedUsers = (usersRes.data.users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName || u.first_name || '',
        lastName: u.lastName || u.last_name || '',
        role: u.role,
        isActive: u.isActive !== undefined ? u.isActive : u.is_active,
        isVerified: u.isVerified !== undefined ? u.isVerified : u.is_verified,
        createdAt: u.createdAt || u.created_at || new Date().toISOString(),
      }));
      setRecentUsers(normalizedUsers);
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
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2.5">
            <div className="h-8 w-48 bg-neutral-200 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-60 bg-neutral-200 rounded-xl skeleton-shimmer" />
          </div>
          <div className="h-10 w-28 bg-neutral-200 rounded-xl skeleton-shimmer" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-5 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-200 skeleton-shimmer" />
              <div className="space-y-2">
                <div className="h-6 w-14 bg-neutral-200 rounded skeleton-shimmer" />
                <div className="h-3 w-20 bg-neutral-200 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>

        {/* Workspace skeleton */}
        <div className="card p-6 h-64 skeleton-shimmer bg-neutral-100 rounded-2xl" />
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-8"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div className="flex items-center justify-between page-header mb-0" variants={itemVariants}>
        <div>
          <h1 className="page-title text-3xl font-black tracking-tight">Admin Dashboard</h1>
          <p className="page-subtitle text-neutral-500">Platform overview and user management</p>
        </div>
        <Link href="/admin/analytics" className="btn-primary gap-2 hover:scale-[1.01] transition-transform">
          <TrendingUp className="w-4 h-4" /> Analytics
        </Link>
      </motion.div>

      {/* Stats grid */}
      <motion.div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" variants={itemVariants}>
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card flex flex-col gap-3 group cursor-pointer hover:scale-[1.02] transition-transform duration-200">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105', stat.color)}>
              <stat.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-2xl font-black text-neutral-900 tracking-tight">{stat.value.toLocaleString()}</div>
              <div className="text-xs text-neutral-450 font-semibold mt-0.5">{stat.label}</div>
              {'delta' in stat && stat.delta && (
                <div className="text-xs text-emerald-600 font-medium mt-1">{stat.delta}</div>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Quick links */}
      <motion.div className="grid md:grid-cols-3 gap-4" variants={itemVariants}>
        {[
          { label: 'Manage Users', desc: 'View, activate, deactivate users', href: '/admin/users', color: 'bg-blue-50 text-blue-700 hover:border-blue-200' },
          { label: 'Analytics', desc: 'Demand heatmaps and tenant insights', href: '/admin/analytics', color: 'bg-purple-50 text-purple-700 hover:border-purple-200' },
          { label: 'Export Data', desc: 'Download platform analytics as JSON', href: '/admin/analytics#export', color: 'bg-emerald-50 text-emerald-700 hover:border-emerald-200' },
        ].map((link) => (
          <Link key={link.label} href={link.href} className={cn('card p-5 flex items-center justify-between group hover:shadow-soft transition-all duration-200 border-neutral-200/60', link.color.split(' ')[0])}>
            <div>
              <div className={cn('text-sm font-bold mb-1.5 transition-colors', link.color.split(' ')[1])}>{link.label}</div>
              <div className="text-xs text-neutral-500 font-medium">{link.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-350 flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
          </Link>
        ))}
      </motion.div>

      {/* Recent users */}
      <motion.div className="card" variants={itemVariants}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 bg-neutral-50/20">
          <h3 className="font-bold text-neutral-900">Recent Users</h3>
          <Link href="/admin/users" className="text-sm text-brand-600 hover:text-brand-750 font-semibold flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-neutral-50">
          {recentUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-600 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-neutral-200/40">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-neutral-900">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-neutral-450 truncate font-medium">{user.email}</div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className={cn('badge text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 border',
                  user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-100' :
                  user.role === 'landlord' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                  'bg-purple-50 text-purple-700 border-purple-100'
                )}>
                  {user.role}
                </span>
                {user.isVerified
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <Clock className="w-4 h-4 text-amber-400" />
                }
                <span className="text-xs text-neutral-400 font-medium">{formatRelative(user.createdAt)}</span>
                <button
                  onClick={() => toggleUserStatus(user.id, user.isActive)}
                  disabled={togglingId === user.id || user.role === 'admin'}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-xl font-bold transition-all disabled:opacity-40 shadow-sm border',
                    user.isActive
                      ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                  )}
                >
                  {togglingId === user.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-neutral-500" />
                    : user.isActive ? 'Deactivate' : 'Activate'
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Health indicators */}
      <motion.div className="grid md:grid-cols-2 gap-4" variants={itemVariants}>
        <div className="card p-5">
          <h3 className="font-bold text-neutral-900 mb-4">Platform Health</h3>
          <div className="space-y-3">
            {[
              { label: 'New users this week', value: overview?.newUsersThisWeek ?? 0, good: (overview?.newUsersThisWeek ?? 0) > 0 },
              { label: 'Active tenant profiles', value: overview?.activeProfiles ?? 0, good: (overview?.activeProfiles ?? 0) > 0 },
              { label: 'Interest expressions', value: overview?.totalInterests ?? 0, good: (overview?.totalInterests ?? 0) > 0 },
              { label: 'Deals in pipeline', value: overview?.totalDeals ?? 0, good: (overview?.totalDeals ?? 0) > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-neutral-100/50 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  {item.good
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <XCircle className="w-4 h-4 text-neutral-300" />
                  }
                  <span className="text-sm text-neutral-700 font-medium">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-neutral-900">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-neutral-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Recompute all tenant scores', href: '/admin/analytics', icon: TrendingUp },
              { label: 'Refresh demand heatmap', href: '/admin/analytics', icon: Bell },
              { label: 'Export analytics report', href: '/admin/analytics#export', icon: ArrowRight },
            ].map((action) => (
              <Link key={action.label} href={action.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <action.icon className="w-4 h-4 text-brand-600" />
                </div>
                <span className="text-sm text-neutral-700 font-semibold group-hover:text-neutral-950 transition-colors">{action.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-300 ml-auto group-hover:translate-x-0.5 group-hover:text-neutral-550 transition-all duration-200" />
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
