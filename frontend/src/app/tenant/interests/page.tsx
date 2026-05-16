'use client';

import { useEffect, useState } from 'react';
import { Bell, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { tenantApi, getErrorMessage } from '@/lib/api';
import { InterestExpression } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

export default function TenantInterestsPage() {
  const [interests, setInterests] = useState<InterestExpression[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    tenantApi.getInterests()
      .then((res) => setInterests(res.data.interests ?? []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    setRespondingId(id);
    try {
      await tenantApi.respondToInterest(id, status);
      setInterests((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
      toast.success(status === 'accepted' ? 'Interest accepted!' : 'Interest declined');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRespondingId(null);
    }
  };

  const filtered = activeTab === 'all' ? interests : interests.filter((i) => i.status === activeTab);
  const pendingCount = interests.filter((i) => i.status === 'pending').length;

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  return (
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <h1 className="page-title flex items-center gap-3">
            Incoming Interest
            {pendingCount > 0 && (
              <span className="badge bg-brand-100 text-brand-700 text-sm">{pendingCount} new</span>
            )}
          </h1>
          <p className="page-subtitle">Landlords and brokers interested in your space</p>
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
            <p className="text-neutral-400 text-sm">
              {activeTab === 'all'
                ? 'Complete your profile to start receiving interest from landlords.'
                : `No ${activeTab} interests.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((interest) => {
              const scoreTier = interest.desirabilityIndex ? getScoreTier(interest.desirabilityIndex) : null;
              return (
                <div
                  key={interest.id}
                  className={cn(
                    'card p-5 flex items-start gap-4',
                    interest.status === 'pending' ? 'ring-1 ring-brand-200' : ''
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(interest.companyName || interest.firstName || 'L')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900 text-sm">
                        {interest.companyName || `${interest.firstName} ${interest.lastName}`}
                      </span>
                      {scoreTier && (
                        <span className={cn('badge text-xs', scoreTier.color)}>
                          DI {interest.desirabilityIndex?.toFixed(0)}
                        </span>
                      )}
                      {interest.status === 'pending' ? (
                        <span className="badge bg-amber-100 text-amber-700 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> New
                        </span>
                      ) : interest.status === 'accepted' ? (
                        <span className="badge bg-emerald-100 text-emerald-700 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Accepted
                        </span>
                      ) : (
                        <span className="badge bg-neutral-100 text-neutral-500 text-xs flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Declined
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">{formatRelative(interest.createdAt)}</div>
                    {interest.message && (
                      <p className="text-sm text-neutral-600 mt-2 bg-neutral-50 rounded-lg p-3 border border-neutral-100 italic">
                        "{interest.message}"
                      </p>
                    )}
                    {interest.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleRespond(interest.id, 'accepted')}
                          disabled={respondingId === interest.id}
                          className="btn-primary text-xs py-2 px-4 gap-1.5"
                        >
                          {respondingId === interest.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <CheckCircle className="w-3 h-3" />
                          }
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespond(interest.id, 'declined')}
                          disabled={respondingId === interest.id}
                          className="btn-secondary text-xs py-2 px-4 gap-1.5"
                        >
                          <XCircle className="w-3 h-3" /> Pass
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}
