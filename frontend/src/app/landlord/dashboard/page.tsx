'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Lock, CheckCircle, TrendingUp, Search, Mail,
  Bookmark, Bell, Building2, Sparkles, MapPin, Users,
  Calendar, Briefcase, BarChart3, Clock, HelpCircle, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { statsApi, landlordApi, getErrorMessage } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface StatItem {
  borough?: string;
  space_type?: string;
  business_type?: string;
  timeline?: string;
  count: number;
}

interface StatsData {
  active_requirements: number;
  fresh_requirements: number;
  requirements_by_borough: StatItem[];
  requirements_by_business_type: StatItem[];
  requirements_by_space_type: StatItem[];
  requirements_by_timeline: StatItem[];
}

const ROLE_OPTIONS = [
  'Landlord',
  'Broker',
  'Property Manager',
  'Developer',
  'Investor',
  'Other'
];

export default function LandlordBetaDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [hasJoinedWaitlist, setHasJoinedWaitlist] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  // Fetch stats and initialize form
  useEffect(() => {
    // Stats Fetching
    statsApi.getStats()
      .then((res) => {
        setStats(res.data);
      })
      .catch((err) => {
        console.error('Error fetching demand stats:', err);
        toast.error('Failed to load demand snapshot statistics.');
      })
      .finally(() => setLoadingStats(false));

    // Form Initialization
    const user = getStoredUser();
    if (user) {
      setName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
      setEmail(user.email || '');
    }

    // Check waitlist status from storage
    if (typeof window !== 'undefined') {
      const waitlistFlag = localStorage.getItem('landlord_waitlist_joined');
      if (waitlistFlag === 'true') {
        setHasJoinedWaitlist(true);
      }
    }
  }, []);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !company || !email || !role) {
      toast.error('Please fill in all waitlist registration fields.');
      return;
    }

    setSubmittingWaitlist(true);
    try {
      await landlordApi.joinWaitlist({ name, company, email, role });
      toast.success('Successfully joined the Priority Access waitlist!');
      setHasJoinedWaitlist(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('landlord_waitlist_joined', 'true');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const getBoroughPercentage = (count: number) => {
    if (!stats) return 0;
    const max = Math.max(...stats.requirements_by_borough.map(b => b.count), 1);
    return (count / max) * 100;
  };

  const getSpaceTypePercentage = (count: number) => {
    if (!stats) return 0;
    const max = Math.max(...stats.requirements_by_space_type.map(s => s.count), 1);
    return (count / max) * 100;
  };

  const getBusinessTypePercentage = (count: number) => {
    if (!stats) return 0;
    const max = Math.max(...stats.requirements_by_business_type.map(b => b.count), 1);
    return (count / max) * 100;
  };

  const getTimelinePercentage = (count: number) => {
    if (!stats) return 0;
    const max = Math.max(...stats.requirements_by_timeline.map(t => t.count), 1);
    return (count / max) * 100;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Premium Hero Header Banner */}
      <div className="relative overflow-hidden premium-gradient-bg rounded-3xl text-white p-8 md:p-12 shadow-xl border border-brand-900">
        <div className="absolute inset-0 premium-grid-overlay opacity-30" />
        <div className="absolute top-1/2 left-1/4 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 right-10 w-[250px] h-[250px] bg-accent-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-brand-850/80 border border-brand-700/40 rounded-full px-4.5 py-1.5 text-xs font-semibold tracking-wide text-brand-300 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-accent-400" />
            Landlord Marketplace Beta
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Access to tenant demand <br className="hidden md:inline" />
            <span className="text-accent-400">is coming soon.</span>
          </h1>
          <p className="text-brand-200 text-base md:text-lg font-medium leading-relaxed max-w-2xl">
            We are currently expanding our network of active tenant requirements across NYC. 
            We are building one of the largest databases of active commercial tenant demand, 
            and landlord matchmaking tools will be released as tenant volume continues to grow.
          </p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Column - Demand Snapshot Statistics */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-brand-600" />
                  Aggregate NYC Demand Snapshot
                </h2>
                <p className="text-neutral-500 text-xs mt-1">
                  Real-time aggregated statistics from active search requirements on the platform
                </p>
              </div>
              <div className="badge bg-brand-50 text-brand-700 px-3 py-1 text-xs">
                Updated live
              </div>
            </div>

            {loadingStats ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                <span className="text-sm text-neutral-400 font-medium">Fetching demand statistics...</span>
              </div>
            ) : !stats ? (
              <div className="text-center py-14 text-neutral-400">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <div>Failed to fetch statistics. Please check back later.</div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Stats Highlights Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-neutral-50 border border-neutral-200/60 p-5 rounded-2xl flex items-center gap-4.5">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums leading-none">
                        {stats.active_requirements.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mt-1.5">
                        Active Tenant Requirements
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200/60 p-5 rounded-2xl flex items-center gap-4.5">
                    <div className="w-12 h-12 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-accent-600" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums leading-none">
                        {stats.fresh_requirements.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mt-1.5">
                        New Searches (Last 30 Days)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aggregations Breakdowns Grid */}
                <div className="grid md:grid-cols-2 gap-8 pt-2">
                  {/* Borough Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <MapPin className="w-4 h-4 text-brand-500" />
                      Requirements by Borough
                    </h3>
                    <div className="space-y-3.5">
                      {stats.requirements_by_borough && stats.requirements_by_borough.length > 0 ? (
                        stats.requirements_by_borough.map((item) => (
                          <div key={item.borough} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-neutral-600">
                              <span>{item.borough}</span>
                              <span className="text-neutral-950 font-bold">{item.count} search{item.count !== 1 ? 'es' : ''}</span>
                            </div>
                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-600 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${getBoroughPercentage(item.count)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-neutral-400 py-4">No borough data available</div>
                      )}
                    </div>
                  </div>

                  {/* Space Use Type Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <Building2 className="w-4 h-4 text-brand-500" />
                      Requirements by Space Type
                    </h3>
                    <div className="space-y-3.5">
                      {stats.requirements_by_space_type && stats.requirements_by_space_type.length > 0 ? (
                        stats.requirements_by_space_type.map((item) => (
                          <div key={item.space_type} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-neutral-600">
                              <span className="capitalize">{item.space_type}</span>
                              <span className="text-neutral-950 font-bold">{item.count} tenant{item.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${getSpaceTypePercentage(item.count)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-neutral-400 py-4">No space type data available</div>
                      )}
                    </div>
                  </div>

                  {/* Business Type Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <Briefcase className="w-4 h-4 text-brand-500" />
                      Requirements by Business Type
                    </h3>
                    <div className="space-y-3.5">
                      {stats.requirements_by_business_type && stats.requirements_by_business_type.length > 0 ? (
                        stats.requirements_by_business_type.slice(0, 5).map((item) => (
                          <div key={item.business_type} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-neutral-600">
                              <span>{item.business_type}</span>
                              <span className="text-neutral-950 font-bold">{item.count} active</span>
                            </div>
                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${getBusinessTypePercentage(item.count)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-neutral-400 py-4">No business type data available</div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <Clock className="w-4 h-4 text-brand-500" />
                      Requirements by Timeline
                    </h3>
                    <div className="space-y-3.5">
                      {stats.requirements_by_timeline && stats.requirements_by_timeline.length > 0 ? (
                        stats.requirements_by_timeline.map((item) => (
                          <div key={item.timeline} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-neutral-600">
                              <span className="capitalize">{item.timeline ? item.timeline.replace(/_/g, ' ') : 'Flexible'}</span>
                              <span className="text-neutral-950 font-bold">{item.count} tenant{item.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${getTimelinePercentage(item.count)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-neutral-400 py-4">No timeline data available</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coming Soon Features Section */}
          <div className="space-y-5">
            <div className="page-header mb-0">
              <h2 className="text-lg font-bold text-neutral-900">Platform Features Coming Soon</h2>
              <p className="text-neutral-500 text-xs mt-1">Here is what we are building for our official landlord launch</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Tenant Search',
                  desc: 'Search, filter, and drill down through a comprehensive database of verified commercial tenant profiles and space needs.',
                  icon: Search,
                  color: 'bg-brand-50 text-brand-600 border-brand-100'
                },
                {
                  title: 'Contact Requests',
                  desc: 'Request details, chat directly, and exchange financial details with potential tenants when mutual interest matches.',
                  icon: Mail,
                  color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
                },
                {
                  title: 'Saved Searches',
                  desc: 'Save custom searches for your commercial vacancies and automatically bookmark matching tenant profiles.',
                  icon: Bookmark,
                  color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
                },
                {
                  title: 'Market Alerts',
                  desc: 'Receive automated notifications and detailed summaries as new matching commercial requirements enter the NYC market.',
                  icon: Bell,
                  color: 'bg-accent-50 text-accent-600 border-accent-100'
                }
              ].map((card) => (
                <div key={card.title} className="card p-6 flex flex-col gap-4 border border-neutral-200 bg-white relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', card.color)}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <span className="badge bg-neutral-100 text-neutral-600 font-bold tracking-wide uppercase px-2 py-0.5 text-[10px]">
                      Coming Soon
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 group-hover:text-brand-700 transition-colors duration-150">
                      {card.title}
                    </h3>
                    <p className="text-neutral-500 text-xs leading-relaxed mt-1.5">
                      {card.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Priority Access Waitlist Registration Form */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {!hasJoinedWaitlist ? (
              <motion.div
                key="waitlist-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="card p-6 md:p-7 border border-brand-100 relative"
              >
                {/* Glow badge */}
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-accent-400 text-neutral-900 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Priority List
                </div>

                <div className="mb-5">
                  <h3 className="font-bold text-lg text-neutral-900">Join Priority Access</h3>
                  <p className="text-neutral-500 text-xs mt-1 leading-relaxed">
                    Access to matching dashboard and tenant discovery will be released as tenant demand grows. 
                    Join the priority waitlist to be notified first.
                  </p>
                </div>

                <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                  <div className="form-group">
                    <label className="label text-xs">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="input py-2 px-3 text-xs"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label text-xs">Company Name</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Acme Commercial Properties"
                      className="input py-2 px-3 text-xs"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label text-xs">Work Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input py-2 px-3 text-xs"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label text-xs">Primary Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="select py-2 px-3 text-xs capitalize"
                      required
                    >
                      <option value="" disabled>Select your role</option>
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingWaitlist}
                    className="w-full btn-primary py-2.5 text-xs font-bold gap-2 mt-2"
                  >
                    {submittingWaitlist ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Join Priority Access waitlist
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="waitlist-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="card p-7 text-center border-emerald-200 bg-emerald-50/20 relative"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-neutral-900 text-base">Priority Access Granted</h3>
                <p className="text-neutral-500 text-xs mt-2 leading-relaxed">
                  Your registration has been saved to the waitlist. 
                  We will notify you at <strong className="text-neutral-800">{email}</strong> as soon as matchmaking and NYC tenant requirements search become available.
                </p>
                <div className="mt-5 pt-4 border-t border-neutral-100 flex flex-col gap-2.5 text-left bg-white p-4.5 rounded-xl border border-neutral-200">
                  <div className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Submission info:</div>
                  <div className="grid grid-cols-3 text-xs gap-y-1">
                    <span className="text-neutral-400 font-semibold">Name:</span>
                    <span className="col-span-2 text-neutral-800 font-medium">{name}</span>
                    <span className="text-neutral-400 font-semibold">Company:</span>
                    <span className="col-span-2 text-neutral-800 font-medium">{company}</span>
                    <span className="text-neutral-400 font-semibold">Role:</span>
                    <span className="col-span-2 text-neutral-800 font-medium">{role}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setHasJoinedWaitlist(false);
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 underline font-semibold mt-4 block mx-auto"
                >
                  Update waitlist settings / resubmit
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
