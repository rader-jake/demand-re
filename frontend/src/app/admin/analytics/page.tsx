'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Download, RefreshCw, Loader2, MapPin, Building2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, analyticsApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HeatmapEntry { neighborhood: string; tenantCount: number; avgBudgetPsf: number; avgSqft: number; }
interface IndustryEntry { industry: string; count: number; avgScore: number; }
interface NeighborhoodEntry { neighborhood: string; count: number; avgBudget: number; }
interface FundingEntry { fundingStatus: string; count: number; }
interface RevenueEntry { revenueRange: string; count: number; }
interface ScoreEntry { range: string; count: number; }
interface TrendEntry { date: string; value: number; }

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const FUNDING_LABELS: Record<string, string> = {
  bootstrapped: 'Bootstrapped', angel: 'Angel', seed: 'Seed',
  series_a: 'Series A', series_b_plus: 'Series B+', public: 'Public', private_equity: 'PE',
};

export default function AdminAnalyticsPage() {
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [insights, setInsights] = useState<{
    byIndustry: IndustryEntry[];
    byNeighborhood: NeighborhoodEntry[];
    byFunding: FundingEntry[];
    byRevenue: RevenueEntry[];
    scoreDistribution: ScoreEntry[];
    expansionLeaders: { legalName: string; expansionLikelihoodScore: number; industry: string }[];
  } | null>(null);
  const [trend, setTrend] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [heatmapRes, insightsRes, trendRes] = await Promise.all([
        adminApi.getDemandHeatmap(),
        adminApi.getTenantInsights(),
        analyticsApi.getTrends('tenants', 30),
      ]);
      setHeatmap(heatmapRes.data.heatmap ?? []);
      setInsights(insightsRes.data);
      setTrend(trendRes.data.trend ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // refresh not needed
      await loadData();
      toast.success('Analytics refreshed');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminApi.exportData('all');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenantfirst-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  const topHeatmap = [...heatmap].sort((a, b) => b.tenantCount - a.tenantCount).slice(0, 10);
  const fundingData = (insights?.byFunding ?? []).map((f) => ({
    name: FUNDING_LABELS[f.fundingStatus] ?? f.fundingStatus,
    value: f.count,
  }));

  return (
      <div className="max-w-7xl mx-auto space-y-8" id="analytics-top">
        <div className="flex items-start justify-between page-header">
          <div>
            <h1 className="page-title">Analytics & Insights</h1>
            <p className="page-subtitle">Demand intelligence across NYC markets</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary gap-2">
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            <button onClick={handleExport} disabled={exporting} className="btn-primary gap-2" id="export">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export JSON
            </button>
          </div>
        </div>

        {/* Tenant growth trend */}
        {trend.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-neutral-900">Tenant Growth (30 days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} name="Tenants" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Demand heatmap */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <MapPin className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-neutral-900">Demand Heatmap — Top Neighborhoods</h3>
          </div>
          {topHeatmap.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 text-sm">No heatmap data yet</div>
          ) : (
            <div className="space-y-3">
              {topHeatmap.map((entry, i) => {
                const max = topHeatmap[0].tenantCount;
                const pct = Math.round((entry.tenantCount / max) * 100);
                return (
                  <div key={entry.neighborhood} className="flex items-center gap-4">
                    <div className="w-4 text-xs text-neutral-400 text-right flex-shrink-0">{i + 1}</div>
                    <div className="w-36 text-sm text-neutral-700 flex-shrink-0 truncate">{entry.neighborhood}</div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-8 text-xs font-semibold text-neutral-700 text-right flex-shrink-0">
                        {entry.tenantCount}
                      </div>
                    </div>
                    <div className="w-20 text-right text-xs text-neutral-400 flex-shrink-0">
                      ${entry.avgBudgetPsf?.toFixed(0)} PSF
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Industry breakdown */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-neutral-900">Tenants by Industry</h3>
            </div>
            {(insights?.byIndustry?.length ?? 0) === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={(insights?.byIndustry ?? []).slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="industry" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Tenants" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Funding distribution */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <DollarSign className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-neutral-900">Funding Stage Distribution</h3>
            </div>
            {fundingData.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={fundingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {fundingData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Score distribution */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-neutral-900">Desirability Score Distribution</h3>
            </div>
            {(insights?.scoreDistribution?.length ?? 0) === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={insights?.scoreDistribution ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Tenants" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top expansion leaders */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-neutral-900">Top Expansion Candidates</h3>
            </div>
            {(insights?.expansionLeaders?.length ?? 0) === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">No data yet</div>
            ) : (
              <div className="space-y-3">
                {(insights?.expansionLeaders ?? []).slice(0, 6).map((leader, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                      'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-neutral-200 text-neutral-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-neutral-100 text-neutral-500'
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-900 truncate">{leader.legalName}</div>
                      <div className="text-xs text-neutral-400">{leader.industry}</div>
                    </div>
                    <div className="w-12 h-2 bg-neutral-100 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${leader.expansionLikelihoodScore}%` }}
                      />
                    </div>
                    <div className="text-sm font-semibold text-emerald-700 w-8 text-right flex-shrink-0">
                      {leader.expansionLikelihoodScore}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Neighborhood budget table */}
        {(insights?.byNeighborhood?.length ?? 0) > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold text-neutral-900 mb-5">Neighborhood Demand Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    <th className="pb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">Neighborhood</th>
                    <th className="pb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide text-right">Active Tenants</th>
                    <th className="pb-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide text-right">Avg Budget PSF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(insights?.byNeighborhood ?? []).slice(0, 15).map((row) => (
                    <tr key={row.neighborhood}>
                      <td className="py-3 text-neutral-700 font-medium">{row.neighborhood}</td>
                      <td className="py-3 text-right text-neutral-600">{row.count}</td>
                      <td className="py-3 text-right text-neutral-600">${Number(row.avgBudget).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
  );
}
