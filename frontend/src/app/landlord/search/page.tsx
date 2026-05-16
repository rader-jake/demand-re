'use client';
import SubscriptionGate from '@/components/shared/SubscriptionGate';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, X, ChevronLeft, ChevronRight,
  Loader2, Users, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import TenantCard from '@/components/ui/TenantCard';
import { landlordApi, getErrorMessage } from '@/lib/api';
import { TenantProfile, TenantSearchFilters, NYC_NEIGHBORHOODS, INDUSTRIES } from '@/types';
import { cn } from '@/lib/utils';

const SPACE_USE_TYPES = ['retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed'];
const CREDIT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'below_600', label: 'Below 600' },
  { value: '600_649', label: '600–649' },
  { value: '650_699', label: '650–699' },
  { value: '700_749', label: '700–749' },
  { value: '750_799', label: '750–799' },
  { value: '800_plus', label: '800+' },
];

const PAGE_SIZE = 12;

export default function LandlordSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [filters, setFilters] = useState<TenantSearchFilters>({
    industry: searchParams.get('industry') || '',
    spaceUseType: undefined,
    neighborhoodContains: searchParams.get('neighborhood') || '',
    budgetPsfMin: undefined,
    budgetPsfMax: undefined,
    sqftMin: undefined,
    sqftMax: undefined,
    creditRange: undefined,
    fundingStatus: undefined,
    minDesirabilityScore: undefined,
    minLocations: undefined,
  });

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTenants = useCallback(async (f: TenantSearchFilters, p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page: p,
        limit: PAGE_SIZE,
        ...f,
      };
      // Remove empty strings
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === undefined) delete params[k];
      });
      const res = await landlordApi.searchTenants(params as unknown as Record<string, unknown>);
      setTenants(res.data.tenants ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchTenants({ ...filters, neighborhoodContains: query || filters.neighborhoodContains }, 1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, query]);

  const handleSave = async (profileId: string) => {
    const tenant = tenants.find((t) => t.profileId === profileId);
    try {
      if (tenant?.isSaved) {
        await landlordApi.unsaveTenant(profileId);
      } else {
        await landlordApi.saveTenant(profileId);
      }
      setTenants((prev) => prev.map((t) =>
        t.profileId === profileId ? { ...t, isSaved: !t.isSaved } : t
      ));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleExpressInterest = async (profileId: string) => {
    try {
      await landlordApi.expressInterest(profileId, '');
      setTenants((prev) => prev.map((t) =>
        t.profileId === profileId ? { ...t, hasExpressedInterest: true } : t
      ));
      toast.success('Interest expressed! The tenant will be notified.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleMessage = (userId: string) => {
    router.push(`/landlord/messages?userId=${userId}`);
  };

  const setFilter = <K extends keyof TenantSearchFilters>(key: K, val: TenantSearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const clearFilters = () => {
    setFilters({});
    setQuery('');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (query ? 1 : 0);

  const FilterSidebar = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      {/* Industry */}
      <div className="form-group">
        <label className="label">Industry</label>
        <select
          value={filters.industry || ''}
          onChange={(e) => setFilter('industry', e.target.value || undefined)}
          className="select"
        >
          <option value="">All industries</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Space use type */}
      <div className="form-group">
        <label className="label">Space Type</label>
        <div className="flex flex-wrap gap-1.5">
          {SPACE_USE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilter('spaceUseType', filters.spaceUseType === type ? undefined : type as TenantSearchFilters['spaceUseType'])}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all capitalize',
                filters.spaceUseType === type
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-brand-300'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Community Facility */}
      <div className="form-group">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!filters.communityFacility}
            onChange={(e) => setFilter('communityFacility', e.target.checked ? true : undefined)}
            className="w-4 h-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
          <div>
            <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900">Community Facility (CF use)</span>
            <p className="text-xs text-neutral-400">Only show tenants seeking CF-deeded spaces</p>
          </div>
        </label>
      </div>

      {/* Neighborhood */}
      <div className="form-group">
        <label className="label">Neighborhood</label>
        <select
          value={filters.neighborhoodContains || ''}
          onChange={(e) => setFilter('neighborhoodContains', e.target.value || undefined)}
          className="select"
        >
          <option value="">All neighborhoods</option>
          {NYC_NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Budget PSF */}
      <div className="form-group">
        <label className="label">Budget PSF ($)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.budgetPsfMin ?? ''}
            onChange={(e) => setFilter('budgetPsfMin', e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.budgetPsfMax ?? ''}
            onChange={(e) => setFilter('budgetPsfMax', e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
      </div>

      {/* Size SF */}
      <div className="form-group">
        <label className="label">Size (SF)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.sqftMin ?? ''}
            onChange={(e) => setFilter('sqftMin', e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.sqftMax ?? ''}
            onChange={(e) => setFilter('sqftMax', e.target.value ? Number(e.target.value) : undefined)}
            className="input"
          />
        </div>
      </div>

      {/* Credit score */}
      <div className="form-group">
        <label className="label">Min Credit Score</label>
        <select
          value={filters.creditRange || ''}
          onChange={(e) => setFilter('creditRange', e.target.value as TenantSearchFilters['creditRange'] || undefined)}
          className="select"
        >
          {CREDIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Min desirability score */}
      <div className="form-group">
        <label className="label">Min Desirability Score</label>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="e.g. 70"
          value={filters.minDesirabilityScore ?? ''}
          onChange={(e) => setFilter('minDesirabilityScore', e.target.value ? Number(e.target.value) : undefined)}
          className="input"
        />
      </div>

      {/* Min locations */}
      <div className="form-group">
        <label className="label">Min Existing Locations</label>
        <input
          type="number"
          min={1}
          placeholder="e.g. 3"
          value={filters.minLocations ?? ''}
          onChange={(e) => setFilter('minLocations', e.target.value ? Number(e.target.value) : undefined)}
          className="input"
        />
      </div>

      {/* Amenities */}
      <div className="form-group">
        <label className="label">Requires</label>
        <div className="space-y-2">
          {[
            { key: 'requiresVenting' as keyof TenantSearchFilters, label: 'Venting / Hood' },
            { key: 'requiresFrontage' as keyof TenantSearchFilters, label: 'Street Frontage' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!filters[key]}
                onChange={(e) => setFilter(key, e.target.checked || undefined)}
                className="w-4 h-4 rounded border-neutral-300 text-brand-600 accent-brand-600"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <SubscriptionGate>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="page-header mb-0">
            <h1 className="page-title">Find Tenants</h1>
            <p className="page-subtitle">
              {loading ? 'Searching...' : `${total.toLocaleString()} verified tenant${total !== 1 ? 's' : ''} in NYC`}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company name, industry, or neighborhood..."
            className="input pl-11 pr-4 py-3 w-full"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar - desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="card p-5 sticky top-6">
              {FilterSidebar}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Mobile filter toggle */}
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="btn-secondary gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="text-sm text-neutral-500">{total.toLocaleString()} results</div>
            </div>

            {/* Mobile filter drawer */}
            {sidebarOpen && (
              <div className="lg:hidden mb-6 card p-5">
                {FilterSidebar}
              </div>
            )}

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-20 text-neutral-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div className="font-medium text-lg text-neutral-500">No tenants found</div>
                <div className="text-sm mt-1">Try adjusting your filters or search query</div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="btn-secondary mt-4">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                  {tenants.map((tenant) => (
                    <TenantCard
                      key={tenant.profileId}
                      tenant={tenant}
                      onSave={handleSave}
                      onExpressInterest={handleExpressInterest}
                      onMessage={handleMessage}
                      linkTo={`/landlord/tenants/${tenant.profileId}`}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => { setPage((p) => p - 1); fetchTenants(filters, page - 1); }}
                      disabled={page === 1}
                      className="btn-secondary w-9 h-9 p-0 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const p = i + 1;
                        return (
                          <button
                            key={p}
                            onClick={() => { setPage(p); fetchTenants(filters, p); }}
                            className={cn(
                              'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                              p === page
                                ? 'bg-brand-600 text-white'
                                : 'text-neutral-600 hover:bg-neutral-100'
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                      {totalPages > 7 && <span className="text-neutral-400 px-1">…</span>}
                    </div>
                    <button
                      onClick={() => { setPage((p) => p + 1); fetchTenants(filters, page + 1); }}
                      disabled={page === totalPages}
                      className="btn-secondary w-9 h-9 p-0 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="text-center text-xs text-neutral-400 mt-3">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} tenants
                </div>
              </>
            )}
          </div>
        </div>

        {/* Demand insights banner */}
        <div className="mt-8 bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-neutral-900 text-sm">Pro tip: Use demand heatmaps</div>
            <div className="text-neutral-500 text-xs mt-0.5">
              See which neighborhoods have the most active tenants and highest budgets to prioritize your outreach.
            </div>
          </div>
        </div>
      </div>
    </SubscriptionGate>
  );
}
