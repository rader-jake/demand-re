'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Search, Filter, ArrowRight, ClipboardList, RefreshCw, Calendar, Mail, Phone, MapPin, Building, Ruler, CircleDollarSign, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AdminRequirementsPage() {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchRequirements = () => {
    setLoading(true);
    const params: Record<string, any> = {
      page,
      limit,
    };
    if (search.trim()) params.search = search.trim();
    if (statusFilter !== 'all') params.lead_status = statusFilter;

    adminApi.getLeads(params)
      .then(res => {
        setRequirements(res.data.requirements || res.data.leads || []);
        setTotal(res.data.pagination?.total || 0);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err) || 'Failed to load requirements');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Trigger load when page/filters change
  useEffect(() => {
    fetchRequirements();
  }, [page, statusFilter]);

  // Debounced/Submit search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRequirements();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border border-blue-200/60';
      case 'Reviewing':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200/60';
      case 'Matching':
        return 'bg-purple-50 text-purple-700 border border-purple-200/60';
      case 'Matches Sent':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200/60';
      case 'Touring':
        return 'bg-pink-50 text-pink-700 border border-pink-200/60';
      case 'Negotiating':
        return 'bg-orange-50 text-orange-700 border border-orange-200/60';
      case 'Closed Won':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      case 'Closed Lost':
        return 'bg-red-50 text-red-700 border border-red-200/60';
      case 'Dormant':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      case 'Needs Refresh':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-200/60';
      default:
        return 'bg-neutral-50 text-neutral-600 border border-neutral-200/60';
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100/50 shadow-sm">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title text-3xl font-black tracking-tight text-neutral-900">Tenant Requirements Desk</h1>
            <p className="page-subtitle text-neutral-500">Review commercial tenant requirements, configure property matches, and manage status pipelines.</p>
          </div>
        </div>
        <button 
          onClick={() => { setPage(1); fetchRequirements(); }} 
          className="btn btn-secondary flex items-center gap-2 hover:bg-neutral-50 transition shadow-sm"
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters & Actions Card */}
      <div className="card bg-white p-4 rounded-2xl border border-neutral-200/60 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, business, location..."
              className="input pl-10 pr-4 w-full py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition text-sm"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="select w-full sm:w-48 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Reviewing">Reviewing</option>
                <option value="Matching">Matching</option>
                <option value="Matches Sent">Matches Sent</option>
                <option value="Touring">Touring</option>
                <option value="Negotiating">Negotiating</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
                <option value="Dormant">Dormant</option>
                <option value="Needs Refresh">Needs Refresh</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary px-5 py-2.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Requirements Table Card */}
      <div className="card bg-white rounded-2xl border border-neutral-200/60 shadow-md overflow-hidden">
        {loading ? (
          <div className="divide-y divide-neutral-100">
            {/* Header placeholder */}
            <div className="bg-neutral-50/50 h-12 w-full flex items-center px-6 border-b border-neutral-200">
              <div className="h-4 w-full bg-neutral-200/60 rounded skeleton-shimmer" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-6 py-5 animate-pulse">
                <div className="space-y-2 w-1/4">
                  <div className="h-4.5 w-40 bg-neutral-200 rounded skeleton-shimmer" />
                  <div className="h-3 w-32 bg-neutral-200 rounded skeleton-shimmer" />
                </div>
                <div className="space-y-2 w-1/4">
                  <div className="h-4.5 w-36 bg-neutral-200 rounded skeleton-shimmer" />
                  <div className="h-3 w-24 bg-neutral-200 rounded skeleton-shimmer" />
                </div>
                <div className="space-y-2 w-1/4">
                  <div className="h-3.5 w-32 bg-neutral-200 rounded skeleton-shimmer" />
                  <div className="h-3 w-28 bg-neutral-200 rounded skeleton-shimmer" />
                </div>
                <div className="w-24 h-6 bg-neutral-200 rounded-full skeleton-shimmer" />
                <div className="w-24 h-9 bg-neutral-200 rounded-xl skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : requirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <ClipboardList className="w-14 h-14 text-neutral-300 mb-4" />
            <h3 className="text-lg font-bold text-neutral-700">No requirements found</h3>
            <p className="text-neutral-400 text-sm max-w-sm mt-1">Try broadening your search keywords or checking another status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Tenant / Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Business & Space</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Requirements</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {requirements.map((req) => (
                  <tr key={req.id} className="hover:bg-neutral-50/40 transition duration-150">
                    {/* Tenant & Contact */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-bold text-neutral-900 text-base">{req.full_name || 'Anonymous Tenant'}</div>
                        <div className="flex flex-col gap-0.5 text-xs text-neutral-500 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-neutral-400" />
                            {req.email}
                          </span>
                          {req.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-neutral-400" />
                              {req.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Business & Space */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                          {req.business_type || 'Unknown Business'}
                        </div>
                        <div className="text-xs text-neutral-550 flex items-center gap-1 font-medium">
                          <Compass className="w-3.5 h-3.5 text-neutral-400" />
                          Space: <span className="font-bold capitalize text-neutral-700">{req.space_types ? req.space_types.join(', ') : 'Any'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Requirements */}
                    <td className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]" title={req.neighborhoods?.join(', ') || req.desired_location}>Loc: {req.neighborhoods?.join(', ') || 'Flexible'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Ruler className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          Size: {req.max_square_feet ? `${req.min_square_feet}-${req.max_square_feet} SF` : 'Flexible'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CircleDollarSign className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          Budget: {req.max_monthly_budget ? `$${req.min_monthly_budget}-$${req.max_monthly_budget}` : 'Flexible'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          Move: {req.move_timeline_label || 'Anytime'}
                        </div>
                      </div>
                    </td>

                    {/* Requirement Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn('badge px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold border', getStatusBadgeClass(req.status))}>
                        {req.status}
                      </span>
                    </td>

                    {/* Created date */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-500 font-medium">
                      {new Date(req.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>

                    {/* Action button */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/requirements/${req.id}`}
                        className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-100 transition-colors rounded-xl font-bold shadow-sm"
                      >
                        Match Desk
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="bg-neutral-50/50 px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Showing <span className="font-bold text-neutral-600">{((page - 1) * limit) + 1}</span> to{' '}
              <span className="font-bold text-neutral-600">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-bold text-neutral-600">{total}</span> requirements
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm shadow-none rounded-xl"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm shadow-none rounded-xl"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
