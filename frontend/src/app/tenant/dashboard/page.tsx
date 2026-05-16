'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Eye, Bell, TrendingUp, Star, ArrowRight, CheckCircle,
  AlertCircle, Edit, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import ScoreBar from '@/components/ui/ScoreBar';
import { tenantApi, getErrorMessage } from '@/lib/api';
import { TenantProfile, InterestExpression, FUNDING_STATUS_LABELS } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

export default function TenantDashboard() {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [interests, setInterests] = useState<InterestExpression[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([tenantApi.getProfile(), tenantApi.getInterests()])
      .then(([profileRes, interestsRes]) => {
        setProfile(profileRes.data.profile);
        setInterests(interestsRes.data.interests ?? []);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    try {
      await tenantApi.respondToInterest(id, status);
      setInterests((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
      toast.success(status === 'accepted' ? 'Interest accepted!' : 'Interest declined');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  if (!profile) {
    return (
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
            <Star className="w-10 h-10 text-brand-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Create your tenant profile</h2>
          <p className="text-neutral-500 mb-8">Set up your profile to start receiving interest from NYC landlords and brokers.</p>
          <Link href="/tenant/onboarding" className="btn-primary btn-lg">
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
    );
  }

  const scoreTier = profile.desirabilityIndex ? getScoreTier(profile.desirabilityIndex) : null;
  const pendingInterests = interests.filter((i) => i.status === 'pending');

  return (
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="page-header mb-0">
            <h1 className="page-title">
              {profile.dbaName || profile.legalName}
            </h1>
            <p className="page-subtitle">{profile.industry} · {profile.spaceUseType}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tenant/profile" className="btn-secondary">
              <Edit className="w-4 h-4" /> Edit Profile
            </Link>
            <div className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-semibold',
              profile.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            )}>
              {profile.status === 'active' ? 'Live' : profile.status}
            </div>
          </div>
        </div>

        {/* Profile completeness alert */}
        {profile.profileCompleteness < 80 && (
          <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900">Profile {profile.profileCompleteness}% complete</div>
              <p className="text-amber-700 text-sm mt-1">
                Complete your profile to improve your score and appear in more landlord searches.
              </p>
            </div>
            <Link href="/tenant/profile" className="btn-sm bg-amber-600 text-white hover:bg-amber-700">
              Complete <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Profile Views', value: profile.viewCount ?? 0, icon: Eye, color: 'text-blue-600 bg-blue-50' },
            { label: 'Interests Received', value: profile.interestCount ?? 0, icon: Bell, color: 'text-purple-600 bg-purple-50' },
            { label: 'Profile Score', value: `${profile.desirabilityIndex?.toFixed(0) ?? '—'}`, icon: Star, color: 'text-amber-600 bg-amber-50' },
            { label: 'Completeness', value: `${profile.profileCompleteness}%`, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          ].map((stat) => (
            <div key={stat.label} className="stat-card flex items-center gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Score card */}
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Your Score</h3>
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <TrendingUp className="w-3 h-3" /> Live
              </div>
            </div>

            <div className="text-center py-4">
              {scoreTier && (
                <>
                  <div className={cn('text-6xl font-black', scoreTier.color.split(' ')[0])}>
                    {profile.desirabilityIndex?.toFixed(0)}
                  </div>
                  <div className="text-sm text-neutral-500 mt-1">Desirability Index</div>
                  <div className={cn('badge mt-2', scoreTier.color)}>Tier {scoreTier.label}</div>
                </>
              )}
              {!profile.desirabilityIndex && (
                <div className="text-neutral-400 text-sm">
                  Complete your profile to get scored
                </div>
              )}
            </div>

            <div className="space-y-4 pt-2 border-t border-neutral-100">
              {profile.financialStrengthScore !== undefined && (
                <ScoreBar label="Financial Strength" score={profile.financialStrengthScore} />
              )}
              {profile.expansionLikelihoodScore !== undefined && (
                <ScoreBar label="Expansion Likelihood" score={profile.expansionLikelihoodScore} />
              )}
              {profile.marketDesirabilityScore !== undefined && (
                <ScoreBar label="Market Desirability" score={profile.marketDesirabilityScore} />
              )}
            </div>
          </div>

          {/* Incoming interests */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-neutral-900">
                Incoming Interest
                {pendingInterests.length > 0 && (
                  <span className="ml-2 badge bg-brand-100 text-brand-700">{pendingInterests.length} new</span>
                )}
              </h3>
              <Link href="/tenant/interests" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                View all
              </Link>
            </div>

            {interests.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <div className="font-medium">No interest yet</div>
                <div className="text-sm mt-1">Complete your profile to get noticed</div>
              </div>
            ) : (
              <div className="space-y-4">
                {interests.slice(0, 4).map((interest) => (
                  <div key={interest.id} className="flex items-start gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {(interest.companyName || interest.firstName || 'L')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-900 text-sm">
                        {interest.companyName || `${interest.firstName} ${interest.lastName}`}
                      </div>
                      {interest.message && (
                        <p className="text-neutral-500 text-xs mt-1 line-clamp-2">{interest.message}</p>
                      )}
                      <div className="text-xs text-neutral-400 mt-1">{formatRelative(interest.createdAt)}</div>
                    </div>
                    {interest.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleRespond(interest.id, 'accepted')} className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                          Accept
                        </button>
                        <button onClick={() => handleRespond(interest.id, 'declined')} className="btn-sm bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-xs">
                          Pass
                        </button>
                      </div>
                    )}
                    {interest.status !== 'pending' && (
                      <span className={cn('badge text-xs flex-shrink-0',
                        interest.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                      )}>
                        {interest.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Profile summary */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-neutral-900">Profile Summary</h3>
            <Link href="/tenant/profile" className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              <Edit className="w-3 h-3" /> Edit
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-neutral-400 font-medium uppercase tracking-wide mb-3">Seeking</div>
              <div className="space-y-2 text-sm">
                {profile.sqftMin && <div><span className="text-neutral-500">Size:</span> <span className="font-medium">{profile.sqftMin?.toLocaleString()}–{profile.sqftMax?.toLocaleString()} SF</span></div>}
                {profile.budgetPsfMin && <div><span className="text-neutral-500">Budget:</span> <span className="font-medium">${profile.budgetPsfMin}–${profile.budgetPsfMax} PSF</span></div>}
                {profile.targetMoveInDate && <div><span className="text-neutral-500">Move-in:</span> <span className="font-medium">{profile.targetMoveInDate}</span></div>}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-400 font-medium uppercase tracking-wide mb-3">Neighborhoods</div>
              <div className="flex flex-wrap gap-1.5">
                {(profile.preferredNeighborhoods ?? []).slice(0, 6).map((n) => (
                  <span key={n} className="badge bg-neutral-100 text-neutral-600">{n}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-400 font-medium uppercase tracking-wide mb-3">Business</div>
              <div className="space-y-2 text-sm">
                <div><span className="text-neutral-500">Locations:</span> <span className="font-medium">{profile.numberOfLocations}</span></div>
                {profile.fundingStatus && <div><span className="text-neutral-500">Funding:</span> <span className="font-medium">{FUNDING_STATUS_LABELS[profile.fundingStatus]}</span></div>}
                {profile.yearsInOperation && <div><span className="text-neutral-500">Years:</span> <span className="font-medium">{profile.yearsInOperation} yrs</span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
