'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Loader2, ArrowLeft, Plus, Edit2, Trash2, Mail, Phone, MapPin,
  Building, Ruler, CircleDollarSign, Calendar, MessageSquare, ClipboardList,
  ExternalLink, Sparkles, Send, Check, AlertCircle, RefreshCw, X
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MatchForm {
  id?: string;
  listing_title: string;
  listing_url: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  square_feet: string;
  rent: string;
  space_type: string;
  broker_name: string;
  broker_phone: string;
  broker_email: string;
  admin_notes: string;
  match_score: string;
  verification_status: string;
}

const emptyForm: MatchForm = {
  listing_title: '',
  listing_url: '',
  address: '',
  city: '',
  state: '',
  neighborhood: '',
  square_feet: '',
  rent: '',
  space_type: 'office',
  broker_name: '',
  broker_phone: '',
  broker_email: '',
  admin_notes: '',
  match_score: '',
  verification_status: 'needs_review',
};

export default function AdminLeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<MatchForm>(emptyForm);
  const [submittingMatch, setSubmittingMatch] = useState(false);

  // Email preview modal states
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [sendingMatches, setSendingMatches] = useState(false);
  const [emailPreview, setEmailPreview] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchLeadData = () => {
    setLoading(true);
    adminApi.getLead(leadId)
      .then(res => {
        // Response contains all lead fields + matches
        const { matches: leadMatches, ...leadInfo } = res.data;
        setLead(leadInfo);
        setMatches(leadMatches || []);
      })
      .catch(err => {
        toast.error(getErrorMessage(err) || 'Failed to load lead details');
        router.push('/admin/requirements');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadData();
    }
  }, [leadId]);

  // Scoring helper calculation
  const getSuggestedScore = (form: MatchForm) => {
    if (!lead) return 0;
    let score = 0;

    // 1. Location match (25 pts)
    const leadLoc = (lead.desired_location || '').toLowerCase().trim();
    const listingLoc = `${form.neighborhood || ''} ${form.city || ''} ${form.address || ''}`.toLowerCase().trim();
    if (leadLoc && listingLoc && (listingLoc.includes(leadLoc) || leadLoc.includes(leadLoc))) {
      score += 25;
    }

    // 2. Budget match (25 pts)
    const parseNumbers = (str: string) => {
      if (!str) return null;
      const parsed = str.replace(/,/g, '').match(/\d+/g);
      if (!parsed || parsed.length === 0) return null;
      return parsed.map(n => parseInt(n, 10));
    };

    const leadBudgets = parseNumbers(lead.monthly_budget);
    const listingRents = parseNumbers(form.rent);
    if (leadBudgets && listingRents) {
      const listingRentVal = listingRents[0];
      if (leadBudgets.length === 1) {
        const leadBudgetVal = leadBudgets[0];
        if (listingRentVal <= leadBudgetVal * 1.15) score += 25;
      } else if (leadBudgets.length >= 2) {
        const [minB, maxB] = leadBudgets;
        if (listingRentVal >= minB * 0.85 && listingRentVal <= maxB * 1.15) score += 25;
      }
    } else if (!lead.monthly_budget) {
      score += 25;
    }

    // 3. Size match (25 pts)
    const leadSizes = parseNumbers(lead.space_size);
    const listingSizes = parseNumbers(form.square_feet);
    if (leadSizes && listingSizes) {
      const listingSizeVal = listingSizes[0];
      if (leadSizes.length === 1) {
        const leadSizeVal = leadSizes[0];
        if (listingSizeVal >= leadSizeVal * 0.75 && listingSizeVal <= leadSizeVal * 1.25) score += 25;
      } else if (leadSizes.length >= 2) {
        const [minS, maxS] = leadSizes;
        if (listingSizeVal >= minS * 0.75 && listingSizeVal <= maxS * 1.25) score += 25;
      }
    } else if (!lead.space_size) {
      score += 25;
    }

    // 4. Space type match (25 pts)
    const leadType = (lead.space_type || '').toLowerCase().trim();
    const listingType = (form.space_type || '').toLowerCase().trim();
    if (leadType && listingType && (leadType.includes(listingType) || listingType.includes(leadType))) {
      score += 25;
    } else if (!lead.space_type) {
      score += 25;
    }

    return score;
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await adminApi.updateLeadStatus(leadId, newStatus);
      setLead((prev: any) => ({ ...prev, lead_status: newStatus }));
      toast.success('Lead status updated successfully');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update lead status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open modal for add
  const openAddModal = () => {
    setFormData({
      ...emptyForm,
      space_type: lead?.space_type?.toLowerCase() || 'office',
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  // Open modal for edit
  const openEditModal = (match: any) => {
    setFormData({
      id: match.id,
      listing_title: match.listing_title || '',
      listing_url: match.listing_url || '',
      address: match.address || '',
      city: match.city || '',
      state: match.state || '',
      neighborhood: match.neighborhood || '',
      square_feet: match.square_feet || '',
      rent: match.rent || '',
      space_type: match.space_type || 'office',
      broker_name: match.broker_name || '',
      broker_phone: match.broker_phone || '',
      broker_email: match.broker_email || '',
      admin_notes: match.admin_notes || '',
      match_score: match.match_score !== null ? match.match_score.toString() : '',
      verification_status: match.verification_status || 'needs_review',
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-suggest score if user updates fields and match_score is empty or matches previous auto-calculation
      if (['square_feet', 'rent', 'space_type', 'neighborhood', 'city', 'address'].includes(name)) {
        const suggested = getSuggestedScore(updated).toString();
        return { ...updated, match_score: suggested };
      }

      return updated;
    });
  };

  const handleMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.listing_url) {
      toast.error('Listing URL is required');
      return;
    }

    setSubmittingMatch(true);
    const payload = {
      ...formData,
      match_score: formData.match_score ? parseInt(formData.match_score, 10) : null,
    };

    try {
      if (modalMode === 'create') {
        const res = await adminApi.createMatch(leadId, payload);
        setMatches(prev => [res.data, ...prev]);
        toast.success('Listing match created successfully');
      } else {
        const res = await adminApi.updateMatch(formData.id!, payload);
        setMatches(prev => prev.map(m => m.id === formData.id ? res.data : m));
        toast.success('Listing match updated successfully');
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to save listing match');
    } finally {
      setSubmittingMatch(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Are you sure you want to delete this listing match?')) return;
    try {
      await adminApi.deleteMatch(matchId);
      setMatches(prev => prev.filter(m => m.id !== matchId));
      setSelectedMatchIds(prev => prev.filter(id => id !== matchId));
      toast.success('Match deleted successfully');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete match');
    }
  };

  const toggleSelectMatch = (matchId: string) => {
    setSelectedMatchIds(prev =>
      prev.includes(matchId) ? prev.filter(id => id !== matchId) : [...prev, matchId]
    );
  };

  const handleSendMatches = async () => {
    if (selectedMatchIds.length === 0) {
      toast.error('Please select at least one match to send');
      return;
    }

    setSendingMatches(true);
    try {
      const res = await adminApi.sendMatches(leadId, selectedMatchIds);
      setEmailPreview(res.data.preview);
      setIsPreviewOpen(true);
      toast.success('Matches processed successfully');

      // Update state local variables
      setLead((prev: any) => ({ ...prev, lead_status: 'matches_sent' }));
      setMatches(prev =>
        prev.map(m => selectedMatchIds.includes(m.id) ? { ...m, tenant_sent: true } : m)
      );
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to send matches');
    } finally {
      setSendingMatches(false);
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-50 text-green-700 border border-green-100';
      case 'unavailable':
        return 'bg-red-50 text-red-700 border border-red-100';
      case 'needs_review':
      default:
        return 'bg-yellow-50 text-yellow-700 border border-yellow-100';
    }
  };

  if (loading && !lead) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
        <p className="text-neutral-500 font-medium">Loading workspace...</p>
      </div>
    );
  }

  const suggestedScoreCurrent = getSuggestedScore(formData);

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={() => router.push('/admin/requirements')}
          className="btn btn-ghost inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 px-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Requirements
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Status:</span>
          <select
            value={lead?.lead_status || 'New'}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            className="select py-2 px-3 pr-8 rounded-xl border border-neutral-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
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
          {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
        </div>
      </div>

      {/* Main Grid: Tenant Requirements & Matches list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Tenant Requirements Details (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-md space-y-6">
            <h2 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-brand-600" />
              Tenant Requirements
            </h2>

            {/* General Info */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Tenant Name</label>
                <div className="text-base font-bold text-neutral-900">{lead?.full_name || 'Anonymous'}</div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Mail className="w-4 h-4 text-neutral-400" />
                  <a href={`mailto:${lead?.email}`} className="hover:underline hover:text-brand-600 truncate">{lead?.email}</a>
                </div>
                {lead?.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Phone className="w-4 h-4 text-neutral-400" />
                    <a href={`tel:${lead?.phone_number}`} className="hover:underline hover:text-brand-600">{lead?.phone_number}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Requirement Metrics */}
            <div className="divide-y divide-neutral-100 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><Building className="w-4 h-4" /> Space Type</span>
                <span className="font-semibold text-neutral-800 capitalize">{lead?.space_type || 'Flexible'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Location</span>
                <span className="font-semibold text-neutral-800 text-right truncate max-w-[150px]">{lead?.desired_location || 'Flexible'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><Ruler className="w-4 h-4" /> Size Range</span>
                <span className="font-semibold text-neutral-800">{lead?.space_size || 'Flexible'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4" /> Monthly Budget</span>
                <span className="font-semibold text-neutral-800">{lead?.monthly_budget || 'Flexible'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Move Timeline</span>
                <span className="font-semibold text-neutral-800">{lead?.move_timeline || 'Flexible'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Operating</span>
                <span className="font-semibold text-neutral-800 capitalize">{lead?.currently_operating || 'Not specified'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-neutral-400 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Preference</span>
                <span className="font-semibold text-neutral-800">{lead?.wants_contact ? 'Call/Text' : 'Email only'}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
              <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider">Ideal Space Description</label>
              <p className="text-sm text-neutral-600 italic whitespace-pre-line leading-relaxed">
                "{lead?.ideal_space_description || 'No detailed description provided.'}"
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Listing Matches Workspace (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Matches Desk Workspace</h2>
              <p className="text-sm text-neutral-500">Curate and verify listings. Selected matches will be emailed to the tenant.</p>
            </div>

            <button
              onClick={openAddModal}
              className="btn btn-primary inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4.5 h-4.5" />
              Add Matching Listing
            </button>
          </div>

          {/* Action Bar for Batch Dispatch */}
          {matches.length > 0 && (
            <div className="bg-brand-50 border border-brand-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
              <div className="text-sm text-brand-800 font-medium">
                Selected <span className="font-bold text-brand-950">{selectedMatchIds.length}</span> of{' '}
                <span className="font-bold text-brand-950">
                  {matches.filter(m => m.verification_status === 'verified').length}
                </span>{' '}
                verified matches
              </div>

              <button
                onClick={handleSendMatches}
                disabled={selectedMatchIds.length === 0 || sendingMatches}
                className="btn btn-primary bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-blue transition"
              >
                {sendingMatches ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Matches to Tenant
              </button>
            </div>
          )}

          {/* Matches List */}
          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="card bg-white py-16 text-center border border-neutral-200/80 rounded-2xl shadow-sm">
                <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-neutral-700">No matching listings added yet</h3>
                <p className="text-neutral-400 text-sm max-w-sm mx-auto mt-1">Search LoopNet, Crexi, or broker databases, and click the button above to add a match.</p>
              </div>
            ) : (
              matches.map((match) => (
                <div
                  key={match.id}
                  className={cn(
                    "card bg-white p-5 rounded-2xl border transition duration-200 shadow-sm hover:shadow-md relative overflow-hidden flex flex-col md:flex-row gap-5",
                    match.tenant_sent ? "border-indigo-150 bg-indigo-50/10" : "border-neutral-200/80"
                  )}
                >
                  {/* Selection Checkbox (only if verified or already sent) */}
                  <div className="flex items-start md:pt-1">
                    <input
                      type="checkbox"
                      id={`select-${match.id}`}
                      checked={selectedMatchIds.includes(match.id)}
                      onChange={() => toggleSelectMatch(match.id)}
                      disabled={match.verification_status !== 'verified' && !match.tenant_sent}
                      title={match.verification_status !== 'verified' ? 'Verify the listing first before sending' : 'Select to send match'}
                      className="w-5 h-5 text-brand-600 border-neutral-300 rounded-lg focus:ring-brand-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Main match description */}
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-lg font-bold text-neutral-900 truncate">
                          {match.listing_title || 'Commercial Space Match'}
                        </h4>
                        {match.address && (
                          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-neutral-400" />
                            {match.address}{match.city ? `, ${match.city}` : ''}{match.state ? ` ${match.state}` : ''}
                          </p>
                        )}
                      </div>

                      {/* Score Badge */}
                      {match.match_score !== null && (
                        <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-xs font-extrabold shadow-sm">
                          <Sparkles className="w-3.5 h-3.5 fill-brand-600 text-brand-600" />
                          Score: {match.match_score}/100
                        </div>
                      )}
                    </div>

                    {/* Listing Stats details */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                      <div>Size: <span className="font-semibold text-neutral-950">{match.square_feet || 'N/A'} sq ft</span></div>
                      <div>Rent: <span className="font-semibold text-neutral-950">{match.rent || 'N/A'}</span></div>
                      <div>Type: <span className="font-semibold text-neutral-950 capitalize">{match.space_type || 'N/A'}</span></div>
                      {match.neighborhood && <div>Neighborhood: <span className="font-semibold text-neutral-950">{match.neighborhood}</span></div>}
                    </div>

                    {/* Broker Contacts */}
                    {(match.broker_name || match.broker_phone || match.broker_email) && (
                      <div className="text-xs text-neutral-500 space-y-1">
                        <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px] block">Broker Representative</span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {match.broker_name && <span className="font-medium text-neutral-700">{match.broker_name}</span>}
                          {match.broker_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-neutral-400" /> {match.broker_phone}</span>}
                          {match.broker_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-neutral-400" /> {match.broker_email}</span>}
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    {match.admin_notes && (
                      <div className="bg-yellow-50/50 border-l-2 border-yellow-400 p-2.5 rounded-r-xl text-xs text-neutral-600">
                        <strong>Admin Notes:</strong> {match.admin_notes}
                      </div>
                    )}

                    {/* Bottom Status badges & buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        {/* Verification badge */}
                        <span className={cn('badge uppercase px-2.5 py-0.5 text-[10px] tracking-wide font-extrabold', getVerificationBadge(match.verification_status))}>
                          {match.verification_status}
                        </span>

                        {/* Sent status badge */}
                        {match.tenant_sent ? (
                          <span className="badge bg-indigo-100 text-indigo-800 uppercase px-2.5 py-0.5 text-[10px] tracking-wide font-extrabold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Sent to Tenant
                          </span>
                        ) : (
                          <span className="badge bg-neutral-100 text-neutral-400 uppercase px-2.5 py-0.5 text-[10px] tracking-wide font-extrabold">
                            Not Sent
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {match.listing_url && (
                          <a
                            href={match.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm flex items-center gap-1 shadow-none"
                          >
                            Listing URL <ExternalLink className="w-3 h-3" />
                          </a>
                        )}

                        <button
                          onClick={() => openEditModal(match)}
                          className="btn btn-secondary btn-sm p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 border-none shadow-none"
                          title="Edit match"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="btn btn-secondary btn-sm p-1.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border-none shadow-none"
                          title="Delete match"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MATCH CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-150 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-600" />
                {modalMode === 'create' ? 'Add Listing Match' : 'Edit Listing Match'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleMatchSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Title */}
                <div className="form-group md:col-span-2">
                  <label className="label">Listing Title</label>
                  <input
                    type="text"
                    name="listing_title"
                    value={formData.listing_title}
                    onChange={handleInputChange}
                    placeholder="e.g. 50,000 SF Warehouse with High Ceilings"
                    className="input"
                    required
                  />
                </div>

                {/* Listing URL */}
                <div className="form-group md:col-span-2">
                  <label className="label">Listing URL (LoopNet/Crexi/Broker)</label>
                  <input
                    type="url"
                    name="listing_url"
                    value={formData.listing_url}
                    onChange={handleInputChange}
                    placeholder="https://www.loopnet.com/Listing/..."
                    className="input"
                    required
                  />
                </div>

                {/* Address */}
                <div className="form-group">
                  <label className="label">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="e.g. 123 Broadway"
                    className="input"
                  />
                </div>

                {/* Neighborhood */}
                <div className="form-group">
                  <label className="label">Neighborhood</label>
                  <input
                    type="text"
                    name="neighborhood"
                    value={formData.neighborhood}
                    onChange={handleInputChange}
                    placeholder="e.g. Soho"
                    className="input"
                  />
                </div>

                {/* City */}
                <div className="form-group">
                  <label className="label">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="e.g. New York"
                    className="input"
                  />
                </div>

                {/* State */}
                <div className="form-group">
                  <label className="label">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="e.g. NY"
                    className="input"
                  />
                </div>

                {/* Square Feet */}
                <div className="form-group">
                  <label className="label">Square Feet</label>
                  <input
                    type="text"
                    name="square_feet"
                    value={formData.square_feet}
                    onChange={handleInputChange}
                    placeholder="e.g. 1500"
                    className="input"
                  />
                </div>

                {/* Rent */}
                <div className="form-group">
                  <label className="label">Monthly Rent</label>
                  <input
                    type="text"
                    name="rent"
                    value={formData.rent}
                    onChange={handleInputChange}
                    placeholder="e.g. 4500"
                    className="input"
                  />
                </div>

                {/* Space Type */}
                <div className="form-group">
                  <label className="label">Space Type</label>
                  <select
                    name="space_type"
                    value={formData.space_type}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="retail">Retail</option>
                    <option value="office">Office</option>
                    <option value="industrial">Industrial</option>
                    <option value="flex">Flex</option>
                    <option value="medical">Medical</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>

                {/* Verification Status */}
                <div className="form-group">
                  <label className="label">Verification Status</label>
                  <select
                    name="verification_status"
                    value={formData.verification_status}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="needs_review">Needs Review</option>
                    <option value="verified">Verified (Listing is active)</option>
                    <option value="unavailable">Unavailable (Leased/expired)</option>
                  </select>
                </div>

                {/* Broker Name */}
                <div className="form-group">
                  <label className="label">Broker Name</label>
                  <input
                    type="text"
                    name="broker_name"
                    value={formData.broker_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Jane Smith"
                    className="input"
                  />
                </div>

                {/* Broker Email */}
                <div className="form-group">
                  <label className="label">Broker Email</label>
                  <input
                    type="email"
                    name="broker_email"
                    value={formData.broker_email}
                    onChange={handleInputChange}
                    placeholder="jane@brokerage.com"
                    className="input"
                  />
                </div>

                {/* Broker Phone */}
                <div className="form-group">
                  <label className="label">Broker Phone</label>
                  <input
                    type="text"
                    name="broker_phone"
                    value={formData.broker_phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 555-0199"
                    className="input"
                  />
                </div>

                {/* Match Score */}
                <div className="form-group">
                  <label className="label">Match Score (0 - 100)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="match_score"
                      value={formData.match_score}
                      onChange={handleInputChange}
                      placeholder="e.g. 85"
                      min="0"
                      max="100"
                      className="input"
                    />
                    {suggestedScoreCurrent > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, match_score: suggestedScoreCurrent.toString() }))}
                        className="btn btn-secondary border-dashed flex items-center gap-1.5 px-3 flex-shrink-0 text-brand-700 hover:bg-brand-50"
                        title="Auto calculate based on requirements"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-brand-600 text-brand-600" />
                        Use Suggested ({suggestedScoreCurrent})
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin Notes */}
                <div className="form-group md:col-span-2">
                  <label className="label">Admin Notes</label>
                  <textarea
                    name="admin_notes"
                    value={formData.admin_notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Details about matching, contacts, specific amenities, or why it was scored this way..."
                    className="input resize-none"
                  />
                </div>

              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3 bg-neutral-50/20 -mx-6 -mb-6 p-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMatch}
                  className="btn btn-primary bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50"
                >
                  {submittingMatch && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modalMode === 'create' ? 'Add Match' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL PREVIEW MODAL */}
      {isPreviewOpen && emailPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-neutral-150 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-600" />
                Generated Matches Email Dispatch Preview
              </h3>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content preview */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neutral-50/50">
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
                <div>
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">To:</span>
                  <span className="text-sm font-semibold text-neutral-800">{emailPreview.to}</span>
                </div>
                <div className="border-t border-neutral-100 pt-2">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Subject:</span>
                  <span className="text-sm font-semibold text-neutral-800">{emailPreview.subject}</span>
                </div>
              </div>

              {/* Rendered HTML Body */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-4 border-b border-neutral-100 pb-2">Email Body (HTML)</span>
                <div
                  className="preview-iframe-container"
                  dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-neutral-150 flex items-center justify-end bg-white">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="btn btn-primary bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2.5 rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
