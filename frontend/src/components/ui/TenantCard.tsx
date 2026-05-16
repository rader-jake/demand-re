'use client';

import Link from 'next/link';
import {
  MapPin, DollarSign, Maximize2, TrendingUp, Bookmark,
  BookmarkCheck, MessageSquare, Star, CheckCircle
} from 'lucide-react';
import { TenantProfile, REVENUE_RANGE_LABELS, FUNDING_STATUS_LABELS } from '@/types';
import { cn, getInitials, getScoreTier, truncate } from '@/lib/utils';

interface TenantCardProps {
  tenant: TenantProfile;
  onSave?: (profileId: string) => void;
  onExpressInterest?: (profileId: string) => void;
  onMessage?: (userId: string) => void;
  linkTo?: string;
}

export default function TenantCard({
  tenant,
  onSave,
  onExpressInterest,
  onMessage,
  linkTo,
}: TenantCardProps) {
  const scoreTier = tenant.desirabilityIndex ? getScoreTier(tenant.desirabilityIndex) : null;

  return (
    <div className="card p-6 hover:shadow-soft transition-shadow duration-200 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {getInitials(tenant.legalName.split(' ')[0], tenant.legalName.split(' ')[1])}
          </div>
          <div>
            <div className="font-semibold text-neutral-900 leading-tight">
              {tenant.dbaName || tenant.legalName}
            </div>
            <div className="text-sm text-neutral-500">{tenant.industry}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {scoreTier && (
            <div className={cn('text-xs font-bold px-2.5 py-1 rounded-lg', scoreTier.color)}>
              {scoreTier.label} · {tenant.desirabilityIndex?.toFixed(0)}
            </div>
          )}
          {onSave && (
            <button
              onClick={() => onSave(tenant.profileId)}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                tenant.isSaved
                  ? 'bg-brand-100 text-brand-600'
                  : 'bg-neutral-100 text-neutral-400 hover:text-brand-600 hover:bg-brand-50'
              )}
            >
              {tenant.isSaved
                ? <BookmarkCheck className="w-4 h-4" />
                : <Bookmark className="w-4 h-4" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {tenant.description && (
        <p className="text-sm text-neutral-600 leading-relaxed">
          {truncate(tenant.description, 160)}
        </p>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        {tenant.preferredNeighborhoods && tenant.preferredNeighborhoods.length > 0 && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-neutral-400 font-medium">Neighborhoods</div>
              <div className="text-sm text-neutral-700 leading-tight">
                {tenant.preferredNeighborhoods.slice(0, 2).join(', ')}
                {tenant.preferredNeighborhoods.length > 2 && (
                  <span className="text-neutral-400"> +{tenant.preferredNeighborhoods.length - 2}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {(tenant.budgetPsfMin || tenant.budgetPsfMax) && (
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-neutral-400 font-medium">Budget PSF</div>
              <div className="text-sm text-neutral-700">
                ${tenant.budgetPsfMin}–${tenant.budgetPsfMax}
              </div>
            </div>
          </div>
        )}

        {(tenant.sqftMin || tenant.sqftMax) && (
          <div className="flex items-start gap-2">
            <Maximize2 className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-neutral-400 font-medium">Size</div>
              <div className="text-sm text-neutral-700">
                {tenant.sqftMin?.toLocaleString()}–{tenant.sqftMax?.toLocaleString()} SF
              </div>
            </div>
          </div>
        )}

        {tenant.numberOfLocations && (
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs text-neutral-400 font-medium">Locations</div>
              <div className="text-sm text-neutral-700">{tenant.numberOfLocations} existing</div>
            </div>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <span className={cn('badge', `bg-${tenant.spaceUseType === 'retail' ? 'purple' : tenant.spaceUseType === 'office' ? 'blue' : 'teal'}-50 text-${tenant.spaceUseType === 'retail' ? 'purple' : tenant.spaceUseType === 'office' ? 'blue' : 'teal'}-700`)}>
          {tenant.spaceUseType}
        </span>
        {tenant.fundingStatus && (
          <span className="badge bg-emerald-50 text-emerald-700">
            {FUNDING_STATUS_LABELS[tenant.fundingStatus]}
          </span>
        )}
        {tenant.revenueRange && (
          <span className="badge bg-amber-50 text-amber-700">
            {REVENUE_RANGE_LABELS[tenant.revenueRange]}
          </span>
        )}
        {tenant.hasGuarantor && (
          <span className="badge bg-blue-50 text-blue-700">
            <CheckCircle className="w-3 h-3" /> Guarantor
          </span>
        )}
      </div>

      {/* Score breakdown */}
      {tenant.desirabilityIndex && (
        <div className="pt-3 border-t border-neutral-100 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Financial', value: tenant.financialStrengthScore },
            { label: 'Expansion', value: tenant.expansionLikelihoodScore },
            { label: 'Market Fit', value: tenant.marketDesirabilityScore },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-xs text-neutral-400">{m.label}</div>
              <div className="text-sm font-bold text-neutral-700">{m.value ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {linkTo && (
          <Link href={linkTo} className="btn-secondary flex-1 text-xs py-2">
            <Star className="w-3 h-3" /> View Profile
          </Link>
        )}
        {onExpressInterest && !tenant.hasExpressedInterest && (
          <button
            onClick={() => onExpressInterest(tenant.profileId)}
            className="btn-primary flex-1 text-xs py-2"
          >
            Express Interest
          </button>
        )}
        {tenant.hasExpressedInterest && (
          <div className="flex-1 text-xs py-2 text-center text-emerald-600 bg-emerald-50 rounded-xl font-medium">
            <CheckCircle className="w-3 h-3 inline mr-1" /> Interest Sent
          </div>
        )}
        {onMessage && (
          <button
            onClick={() => onMessage(tenant.userId)}
            className="btn-ghost w-9 h-9 p-0 flex-shrink-0"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
