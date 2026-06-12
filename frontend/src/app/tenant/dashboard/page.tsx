'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Eye, Bell, TrendingUp, Star, ArrowRight, CheckCircle,
  AlertCircle, Edit, Loader2, MapPin, Building, Ruler,
  CircleDollarSign, Calendar, Clock, RefreshCw, ClipboardList, Check
} from 'lucide-react';
import { toast } from 'sonner';
import ScoreBar from '@/components/ui/ScoreBar';
import { tenantApi, meApi, getErrorMessage } from '@/lib/api';
import { TenantProfile, InterestExpression, FUNDING_STATUS_LABELS, MetaLead } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

const getStatusBadgeStyle = (status: string) => {
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

const getFreshnessBadgeStyle = (freshness: string) => {
  switch (freshness) {
    case 'Fresh':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
    case 'Needs Refresh':
      return 'bg-amber-50 text-amber-700 border border-amber-200/60';
    case 'Stale':
    default:
      return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
  }
};

export default function TenantDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [interests, setInterests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([meApi.getRequirement(), tenantApi.getInterests()])
      .then(([reqRes, interestsRes]) => {
        const req = reqRes.data.requirement;
        if (!req) {
          setProfile(null);
        } else {
          setProfile({
            profileId: req.id,
            status: req.status || 'New',
            legalName: req.full_name,
            dbaName: req.full_name,
            industry: req.business_type,
            spaceUseType: req.space_types ? (Array.isArray(req.space_types) ? req.space_types.join(', ') : JSON.parse(req.space_types).join(', ')) : 'Flexible',
            numberOfLocations: req.location_count || 1,
            description: req.ideal_space_description,
            profileCompleteness: 100,
            viewCount: 0,
            interestCount: interestsRes.data.interests?.length || 0,
            preferredNeighborhoods: req.neighborhoods ? (Array.isArray(req.neighborhoods) ? req.neighborhoods : JSON.parse(req.neighborhoods)) : [],
            boroughs: req.boroughs ? (Array.isArray(req.boroughs) ? req.boroughs : JSON.parse(req.boroughs)) : [],
            sqftMin: req.min_square_feet,
            sqftMax: req.max_square_feet,
            budgetMonthlyMin: req.min_monthly_budget,
            budgetMonthlyMax: req.max_monthly_budget,
            targetMoveInDate: req.target_move_start_date ? new Date(req.target_move_start_date).toISOString().split('T')[0] : null,
            timelineNotes: req.move_timeline_label,
            financialStrengthScore: req.financial_strength_score,
            expansionLikelihoodScore: req.expansion_likelihood_score,
            marketDesirabilityScore: req.market_desirability_score,
            desirabilityIndex: req.desirability_index ? Number(req.desirability_index) : null,
            freshnessStatus: req.freshness_status || 'Fresh',
            updatedAt: req.updated_at
          });
        }
        setInterests(interestsRes.data.interests ?? []);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleConfirmRequirement = async () => {
    setConfirming(true);
    try {
      await meApi.confirmRequirement();
      toast.success('Requirement successfully confirmed!');
      fetchDashboardData();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to confirm requirement');
    } finally {
      setConfirming(false);
    }
  };

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
      <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2.5">
            <div className="h-8 w-60 bg-neutral-200 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-40 bg-neutral-200 rounded-xl skeleton-shimmer" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-36 bg-neutral-200 rounded-xl skeleton-shimmer" />
            <div className="h-10 w-24 bg-neutral-200 rounded-xl skeleton-shimmer" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-neutral-200 skeleton-shimmer flex-shrink-0" />
              <div className="flex-grow space-y-2">
                <div className="h-6 w-16 bg-neutral-200 rounded skeleton-shimmer" />
                <div className="h-3.5 w-20 bg-neutral-200 rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>

        {/* Inner Grid Skeleton */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Score Card Skeleton */}
          <div className="card p-6 space-y-5">
            <div className="h-5 w-24 bg-neutral-200 rounded skeleton-shimmer" />
            <div className="flex flex-col items-center py-4 space-y-3">
              <div className="h-16 w-16 bg-neutral-200 rounded-full skeleton-shimmer" />
              <div className="h-4 w-28 bg-neutral-200 rounded skeleton-shimmer" />
            </div>
            <div className="space-y-3 border-t border-neutral-100 pt-4">
              <div className="h-4 w-full bg-neutral-200 rounded skeleton-shimmer" />
              <div className="h-4 w-full bg-neutral-200 rounded skeleton-shimmer" />
            </div>
          </div>

          {/* Incoming Interests Skeleton */}
          <div className="lg:col-span-2 card p-6 space-y-4">
            <div className="h-5 w-36 bg-neutral-200 rounded skeleton-shimmer mb-2" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-neutral-100">
                <div className="w-10 h-10 rounded-xl bg-neutral-200 skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-neutral-200 rounded skeleton-shimmer" />
                  <div className="h-3 w-40 bg-neutral-200 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <ClipboardList className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">No requirement found</h2>
        <p className="text-neutral-500 mb-8 leading-relaxed">
          You do not have a saved space requirement yet. Submit your space needs to start matching with landlords and property owners.
        </p>
        <Link href="/tenant/profile" className="btn-primary inline-flex items-center gap-2">
          Create Space Requirement <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const scoreTier = profile.desirabilityIndex ? getScoreTier(profile.desirabilityIndex) : null;
  const pendingInterests = interests.filter((i) => i.status === 'pending');

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-8"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div className="flex items-start justify-between" variants={itemVariants}>
        <div className="page-header mb-0">
          <h1 className="page-title text-3xl font-black tracking-tight">
            {profile.dbaName || profile.legalName}
          </h1>
          <p className="page-subtitle text-neutral-550">{profile.industry} · {profile.spaceUseType}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tenant/profile" className="btn-secondary">
            <Edit className="w-4 h-4" /> Edit Requirement
          </Link>
          <div className={cn(
            'px-3 py-1.5 rounded-xl text-sm font-semibold border uppercase tracking-wider text-[10px]',
            getStatusBadgeStyle(profile.status)
          )}>
            {profile.status}
          </div>
        </div>
      </motion.div>

      {/* Dynamic Freshness Alert */}
      {profile.freshnessStatus === 'Stale' && (
        <motion.div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm" variants={itemVariants}>
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">Requirement Outdated</div>
            <p className="text-amber-700 text-sm mt-1">
              Your requirement may be outdated. Confirm your space needs to keep receiving matching opportunities.
            </p>
          </div>
          <button
            onClick={handleConfirmRequirement}
            disabled={confirming}
            className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700 font-semibold flex items-center gap-1.5 shadow-sm rounded-xl py-2 px-4 transition flex-shrink-0"
          >
            {confirming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Confirm My Requirement
          </button>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={itemVariants}>
        {[
          { label: 'Requirement Views', value: profile.viewCount ?? 0, icon: Eye, color: 'text-blue-600 bg-blue-50' },
          { label: 'Interests Received', value: profile.interestCount ?? 0, icon: Bell, color: 'text-purple-600 bg-purple-50' },
          { label: 'Requirement Score', value: `${profile.desirabilityIndex?.toFixed(0) ?? '—'}`, icon: Star, color: 'text-amber-600 bg-amber-50' },
          { label: 'Freshness', value: `${profile.freshnessStatus}`, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card flex items-center gap-4 hover:scale-[1.01] transition-transform">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-neutral-900 tracking-tight">{stat.value}</div>
              <div className="text-xs text-neutral-400 font-medium">{stat.label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Score card */}
        <motion.div className="card p-6 space-y-5" variants={itemVariants}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Your Score</h3>
            <div className="flex items-center gap-1 text-xs text-neutral-450">
              <TrendingUp className="w-3.5 h-3.5 text-brand-600" /> Live
            </div>
          </div>

          <div className="text-center py-4">
            {scoreTier && (
              <>
                <div className={cn('text-6xl font-black tracking-tight', scoreTier.color.split(' ')[0])}>
                  {profile.desirabilityIndex?.toFixed(0)}
                </div>
                <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-2">Desirability Index</div>
                <div className={cn('badge mt-3.5 px-3 py-1 font-bold uppercase tracking-wider text-[10px]', scoreTier.color)}>Tier {scoreTier.label}</div>
              </>
            )}
            {!profile.desirabilityIndex && (
              <div className="text-neutral-405 text-sm italic">
                Complete your profile to get scored
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
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
        </motion.div>

        {/* Incoming interests */}
        <motion.div className="lg:col-span-2 card p-6" variants={itemVariants}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              Incoming Interest
              {pendingInterests.length > 0 && (
                <span className="badge bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded-lg">{pendingInterests.length} new</span>
              )}
            </h3>
            <Link href="/tenant/interests" className="text-sm text-brand-600 hover:text-brand-750 font-semibold transition-colors">
              View all
            </Link>
          </div>

          {interests.length === 0 ? (
            <div className="text-center py-14 text-neutral-400">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30 text-neutral-300" />
              <div className="font-medium text-neutral-500">No interest received yet</div>
              <div className="text-xs text-neutral-400 mt-1">Complete your profile to increase visibility</div>
            </div>
          ) : (
            <div className="space-y-4">
              {interests.slice(0, 4).map((interest) => (
                <div key={interest.id} className="flex items-start gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100 hover:border-neutral-200 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(interest.companyName || interest.firstName || 'L')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-800 text-sm">
                      {interest.companyName || `${interest.firstName} ${interest.lastName}`}
                    </div>
                    {interest.message && (
                      <p className="text-neutral-505 text-xs mt-1.5 line-clamp-2 leading-relaxed">{interest.message}</p>
                    )}
                    <div className="text-xs text-neutral-400 mt-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelative(interest.createdAt)}
                    </div>
                  </div>
                  {interest.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleRespond(interest.id, 'accepted')} className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold rounded-xl px-3 py-1.5 shadow-sm">
                        Accept
                      </button>
                      <button onClick={() => handleRespond(interest.id, 'declined')} className="btn-sm bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-xs font-semibold rounded-xl px-3 py-1.5 shadow-sm">
                        Pass
                      </button>
                    </div>
                  )}
                  {interest.status !== 'pending' && (
                    <span className={cn('badge text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 flex-shrink-0',
                      interest.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-100 text-neutral-500'
                    )}>
                      {interest.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Tenant Requirement Details */}
      <motion.div className="card p-6 bg-white border border-neutral-200/80 shadow-md" variants={itemVariants}>
        <div className="flex items-center justify-between mb-6 border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-900 tracking-tight">Tenant Requirement Specifications</h3>
              <p className="text-xs text-neutral-505">Active criteria utilized to match listings and evaluate space opportunities.</p>
            </div>
          </div>
          <Link href="/tenant/profile" className="btn-secondary text-sm inline-flex items-center gap-1.5 py-2 px-4">
            <Edit className="w-3.5 h-3.5" /> Edit Criteria
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Side: Space Specifications */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-neutral-400" /> Space Type
                </span>
                <p className="font-semibold text-neutral-800 text-sm mt-1.5 capitalize">{profile.spaceUseType || 'Flexible'}</p>
              </div>

              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-neutral-400" /> Square Footage
                </span>
                <p className="font-semibold text-neutral-800 text-sm mt-1.5">
                  {profile.sqftMin && profile.sqftMax
                    ? `${profile.sqftMin.toLocaleString()} – ${profile.sqftMax.toLocaleString()} SF`
                    : 'Flexible'}
                </p>
              </div>

              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CircleDollarSign className="w-3.5 h-3.5 text-neutral-400" /> Monthly Budget
                </span>
                <p className="font-semibold text-neutral-800 text-sm mt-1.5">
                  {profile.budgetMonthlyMin && profile.budgetMonthlyMax
                    ? `$${profile.budgetMonthlyMin.toLocaleString()} – $${profile.budgetMonthlyMax.toLocaleString()}`
                    : 'Flexible'}
                </p>
              </div>

              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" /> Timeline
                </span>
                <p className="font-semibold text-neutral-800 text-sm mt-1.5">
                  {profile.timelineNotes || profile.targetMoveInDate || 'Flexible'}
                </p>
              </div>
            </div>

            <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100 space-y-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" /> Desired Locations
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {profile.preferredNeighborhoods && profile.preferredNeighborhoods.length > 0 ? (
                  profile.preferredNeighborhoods.map((n: string) => (
                    <span key={n} className="badge bg-white text-neutral-700 border border-neutral-200 font-semibold px-2.5 py-1 text-xs rounded-lg shadow-sm">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-medium text-neutral-500 italic">Flexible (All Locations)</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Description, Status & Freshness */}
          <div className="space-y-5 flex flex-col justify-between">
            <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Ideal Space Description
              </span>
              <p className="text-neutral-600 text-sm italic leading-relaxed whitespace-pre-line">
                {profile.description ? `"${profile.description}"` : '"No detailed space description provided."'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Requirement Status</span>
                <div className="mt-2">
                  <span className={cn('badge uppercase px-3 py-1 text-[10px] tracking-wider font-extrabold rounded-full', getStatusBadgeStyle(profile.status))}>
                    {profile.status}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Requirement Freshness</span>
                <div className="mt-2">
                  <span className={cn('badge uppercase px-3 py-1 text-[10px] tracking-wider font-extrabold rounded-full', getFreshnessBadgeStyle(profile.freshnessStatus || 'Fresh'))}>
                    {profile.freshnessStatus || 'Fresh'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400 px-1 pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last Updated: {profile.updatedAt
                  ? new Date(profile.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  : 'Recently'}
              </span>
              <span>Business Type: <strong className="text-neutral-600">{profile.industry}</strong></span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
