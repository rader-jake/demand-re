'use client';
import SubscriptionGate from '@/components/shared/SubscriptionGate';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { landlordApi, getErrorMessage } from '@/lib/api';
import { InterestExpression } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

export default function LandlordInterestsPage() {
  const [interests, setInterests] = useState<InterestExpression[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    landlordApi.getInterests()
      .then((res) => setInterests(res.data.interests ?? []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTab === 'all' ? interests : interests.filter((i) => i.status === activeTab);

  const statusIcon = (status: string) => {
    if (status === 'accepted') return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    if (status === 'declined') return <XCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  const statusBadge = (status: string) =>
    cn('badge text-xs capitalize',
      status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
      status === 'pending' ? 'bg-amber-100 text-amber-700' :
      status === 'declined' ? 'bg-red-100 text-red-600' :
      'bg-neutral-100 text-neutral-500'
    );

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  return (
    <SubscriptionGate>
      <div className="max-w-4xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Interest Expressions</h1>
          <p className="page-subtitle">Track your outreach to tenants</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl w-fit mb-6">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? interests.length : interests.filter((i) => i.status === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === tab.value
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn('ml-1.5 text-xs', activeTab === tab.value ? 'text-brand-600' : 'text-neutral-400')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 mx-auto mb-3 text-neutral-200" />
            <h3 className="font-semibold text-neutral-600 mb-1">No interests yet</h3>
            <p className="text-neutral-400 text-sm mb-6">
              {activeTab === 'all'
                ? 'Start searching for tenants and express interest to see them here.'
                : `No ${activeTab} interests found.`}
            </p>
            {activeTab === 'all' && (
              <Link href="/landlord/search" className="btn-primary gap-2">
                <Search className="w-4 h-4" /> Find Tenants
              </Link>
            )}
          </div>
        ) : (
          <div className="card divide-y divide-neutral-100">
            {filtered.map((interest) => {
              const scoreTier = interest.desirabilityIndex ? getScoreTier(interest.desirabilityIndex) : null;
              return (
                <div key={interest.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(interest.legalName || 'T')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 text-sm">
                      {interest.legalName}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {interest.industry} · {formatRelative(interest.createdAt)}
                    </div>
                    {interest.message && (
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-1 italic">"{interest.message}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {scoreTier && (
                      <div className={cn('badge text-xs', scoreTier.color)}>
                        {interest.desirabilityIndex?.toFixed(0)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      {statusIcon(interest.status)}
                      <span className={statusBadge(interest.status)}>{interest.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SubscriptionGate>
  );
}
