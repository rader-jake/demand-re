'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Bookmark, Bell, Briefcase, TrendingUp, ArrowRight, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { landlordApi, getErrorMessage } from '@/lib/api';
import { InterestExpression, Deal, DEAL_STAGES } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

interface Overview {
  savedCount: number;
  interestCount: number;
  dealsCount: number;
}

export default function LandlordDashboard() {
  const [overview, setOverview] = useState<Overview>({ savedCount: 0, interestCount: 0, dealsCount: 0 });
  const [interests, setInterests] = useState<InterestExpression[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      landlordApi.getSaved(),
      landlordApi.getInterests(),
      landlordApi.getDeals(),
    ]).then(([savedRes, interestsRes, dealsRes]) => {
      setOverview({
        savedCount: savedRes.data.saved?.length ?? 0,
        interestCount: interestsRes.data.interests?.length ?? 0,
        dealsCount: dealsRes.data.deals?.length ?? 0,
      });
      setInterests(interestsRes.data.interests ?? []);
      setDeals(dealsRes.data.deals ?? []);
    }).catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="page-header">
          <h1 className="page-title">Landlord Dashboard</h1>
          <p className="page-subtitle">Track your tenant search activity and pipeline</p>
        </div>

        {/* Quick action */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Find your next tenant</h2>
            <p className="text-brand-100 text-sm mt-1">Browse verified, scored tenants actively seeking space in NYC</p>
          </div>
          <Link href="/landlord/search" className="btn-lg !bg-white !text-brand-700 hover:!bg-brand-50 font-semibold flex-shrink-0">
            Search Tenants <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Saved Tenants', value: overview.savedCount, icon: Bookmark, color: 'text-purple-600 bg-purple-50', href: '/landlord/saved' },
            { label: 'Interests Sent', value: overview.interestCount, icon: Bell, color: 'text-blue-600 bg-blue-50', href: '/landlord/interests' },
            { label: 'Active Deals', value: overview.dealsCount, icon: Briefcase, color: 'text-emerald-600 bg-emerald-50', href: '/landlord/deals' },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href} className="stat-card flex items-center gap-4 hover:shadow-soft transition-shadow">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent outreach */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-neutral-900">Recent Outreach</h3>
              <Link href="/landlord/interests" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</Link>
            </div>
            {interests.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="text-sm">No outreach yet. Start by searching for tenants.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {interests.slice(0, 5).map((interest) => (
                  <div key={interest.id} className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {(interest.legalName || 'T')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-neutral-900 truncate">{interest.legalName}</div>
                      <div className="text-xs text-neutral-400">{interest.industry} · {formatRelative(interest.createdAt)}</div>
                    </div>
                    <span className={cn('badge text-xs flex-shrink-0',
                      interest.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      interest.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-neutral-100 text-neutral-500'
                    )}>
                      {interest.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deal pipeline snapshot */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-neutral-900">Deal Pipeline</h3>
              <Link href="/landlord/deals" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Full CRM</Link>
            </div>
            {deals.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div className="text-sm">No deals yet. Express interest to start a pipeline.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {deals.slice(0, 5).map((deal) => {
                  const stageInfo = DEAL_STAGES.find((s) => s.value === deal.stage);
                  const scoreTier = deal.desirabilityIndex ? getScoreTier(deal.desirabilityIndex) : null;
                  return (
                    <div key={deal.id} className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-neutral-900 truncate">{deal.legalName || deal.dbaName}</div>
                        <div className="text-xs text-neutral-400">{deal.industry}</div>
                      </div>
                      {scoreTier && (
                        <div className={cn('badge text-xs', scoreTier.color)}>
                          {deal.desirabilityIndex?.toFixed(0)}
                        </div>
                      )}
                      {stageInfo && (
                        <span className={cn('badge text-xs flex-shrink-0', stageInfo.color)}>
                          {stageInfo.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Search CTA */}
        <div className="card p-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-7 h-7 text-brand-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900">See demand trends in your neighborhoods</h3>
            <p className="text-neutral-500 text-sm mt-1">Which industries are searching in your area? What are tenants willing to pay?</p>
          </div>
          <Link href="/landlord/search?showInsights=true" className="btn-secondary flex-shrink-0">
            View Insights <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
  );
}
