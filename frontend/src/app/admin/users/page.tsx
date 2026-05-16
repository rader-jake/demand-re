'use client';

import { useState, useEffect } from 'react';
import { Loader2, Users, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    adminApi.getUsers({})
      .then(res => setUsers(res.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (userId: string, active: boolean) => {
    try {
      await adminApi.updateUserStatus(userId, !active);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !active } : u));
      toast.success(`User ${!active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = search === '' ||
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-red-50 text-red-700',
    landlord: 'bg-brand-50 text-brand-700',
    tenant: 'bg-accent-50 text-accent-700',
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-subtitle">Manage all platform users</p>
          </div>
        </div>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="input pl-9"
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select w-full sm:w-40">
            <option value="all">All roles</option>
            <option value="tenant">Tenants</option>
            <option value="landlord">Landlords</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Joined</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', ROLE_BADGE[u.role] || 'bg-neutral-100 text-neutral-600')}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="badge bg-green-50 text-green-700">Active</span>
                      ) : (
                        <span className="badge bg-neutral-100 text-neutral-500">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(u.id, u.isActive)}
                        className={cn(
                          'btn btn-sm',
                          u.isActive
                            ? 'text-red-600 hover:bg-red-50 border border-red-100'
                            : 'text-green-600 hover:bg-green-50 border border-green-100'
                        )}
                      >
                        {u.isActive
                          ? <><XCircle className="w-3.5 h-3.5" /> Deactivate</>
                          : <><CheckCircle className="w-3.5 h-3.5" /> Activate</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
