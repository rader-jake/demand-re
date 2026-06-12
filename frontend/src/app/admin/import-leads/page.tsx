'use client';

import { useState, useRef } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  X, 
  Info, 
  Database,
  Sparkles,
  Mail,
  User,
  Phone,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PreviewStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  unmappedValues: number;
}

interface PreviewLeadRow {
  fullName: string;
  email: string;
  phone: string | null;
  businessType: string;
  operatingStatus: string;
  boroughs: string[];
  neighborhoods: string[];
  spaceTypes: string[];
  minSquareFeet: number | null;
  maxSquareFeet: number | null;
  squareFeetRangeLabel: string;
  minMonthlyBudget: number | null;
  maxMonthlyBudget: number | null;
  budgetRangeLabel: string;
  moveTimelineLabel: string;
  targetMoveStartDate: string | null;
  targetMoveEndDate: string | null;
  urgencyStatus: string;
  contactPermission: boolean;
  idealSpaceDescription: string | null;
  sourceLeadId: string;
  createdTime: string;
  rawPayload: Record<string, string>;
  unmappedValues: string[];
  hasAccount: boolean;
  status: string;
  activationEmailSentAt: string | null;
  activationEmailStatus: string;
}

interface ImportSummary {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  activationLinksGenerated: number;
  requirements: any[];
}

export default function AdminImportLeadsPage() {
  const [stage, setStage] = useState<'upload' | 'preview' | 'dashboard'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [previewData, setPreviewData] = useState<PreviewLeadRow[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [selectedImportedIds, setSelectedImportedIds] = useState<Set<string>>(new Set());
  
  // Resend / Re-confirm Send Modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingSendIds, setPendingSendIds] = useState<string[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    // Validate file size (limit 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }
    
    // Validate file extension
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are supported.');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const res = await adminApi.importLeadsPreview(text);
      
      setStats({
        totalRows: res.data.totalRows,
        validRows: res.data.validRows,
        invalidRows: res.data.invalidRows,
        duplicateRows: res.data.duplicateRows,
        unmappedValues: res.data.unmappedValues
      });
      
      const rows = res.data.normalizedPreviewData || [];
      setPreviewData(rows);
      
      // Auto-select ready non-duplicate rows
      const initialSelected = new Set<number>();
      rows.forEach((row: PreviewLeadRow, idx: number) => {
        if (row.status !== 'Missing Email') {
          initialSelected.add(idx);
        }
      });
      setSelectedRowIndices(initialSelected);
      
      setStage('preview');
      toast.success('CSV parsed successfully. Review data mapping below.');
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Failed to parse lead CSV file.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle row selection in preview table
  const toggleRowSelect = (index: number) => {
    const updated = new Set(selectedRowIndices);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setSelectedRowIndices(updated);
  };

  // Select/Deselect all preview rows (excluding Missing Email rows)
  const toggleAllPreviewRows = () => {
    const validRowsCount = previewData.filter(r => r.status !== 'Missing Email').length;
    if (selectedRowIndices.size === validRowsCount) {
      setSelectedRowIndices(new Set());
    } else {
      const allIdx = new Set<number>();
      previewData.forEach((row, idx) => {
        if (row.status !== 'Missing Email') {
          allIdx.add(idx);
        }
      });
      setSelectedRowIndices(allIdx);
    }
  };

  // Toggle row selection in imported dashboard table
  const toggleImportedSelect = (id: string) => {
    const updated = new Set(selectedImportedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedImportedIds(updated);
  };

  const toggleAllImportedRows = () => {
    if (selectedImportedIds.size === importedRows.length) {
      setSelectedImportedIds(new Set());
    } else {
      setSelectedImportedIds(new Set(importedRows.map(r => r.id)));
    }
  };

  // Commit selected rows to DB
  const handleCommitImport = async () => {
    if (selectedRowIndices.size === 0) {
      toast.error('Please select at least one row to import.');
      return;
    }

    setLoading(true);
    try {
      const selectedRows = previewData.filter((_, idx) => selectedRowIndices.has(idx));
      const res = await adminApi.importLeadsCommit(selectedRows);
      
      setImportSummary({
        importedCount: res.data.importedCount,
        updatedCount: res.data.updatedCount,
        skippedCount: res.data.skippedCount,
        activationLinksGenerated: res.data.activationLinksGenerated,
        requirements: res.data.requirements || []
      });

      const requirements = res.data.requirements || [];
      setImportedRows(requirements);
      // Auto-select all imported rows for bulk email action
      setSelectedImportedIds(new Set(requirements.map((r: any) => r.id)));

      setStage('dashboard');
      toast.success('Leads imported successfully into database!');
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Failed to commit leads to database.');
    } finally {
      setLoading(false);
    }
  };

  // Activation Email Send Logic
  const triggerSendActivation = async (ids: string[], bypassCheck = false) => {
    // Check if any requirements already have 'Sent' status
    if (!bypassCheck) {
      const alreadySent = importedRows.filter(r => ids.includes(r.id) && r.activation_email_status === 'Sent');
      if (alreadySent.length > 0) {
        setPendingSendIds(ids);
        setConfirmModalOpen(true);
        return;
      }
    }

    setSendingEmails(true);
    try {
      const res = await adminApi.sendActivations(ids);
      
      // Update local state for email statuses
      const updatedRows = importedRows.map(row => {
        if (ids.includes(row.id)) {
          // If user exists, activation status would be Activated, else Sent
          const newStatus = row.hasAccount ? 'Activated' : 'Sent';
          return {
            ...row,
            activation_email_status: newStatus,
            activation_email_sent_at: new Date().toISOString()
          };
        }
        return row;
      });
      setImportedRows(updatedRows);
      
      toast.success(`Sent ${res.data.sentCount} activation emails successfully.${res.data.failedCount > 0 ? ` Failed: ${res.data.failedCount}` : ''}`);
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Failed to send activation emails.');
    } finally {
      setSendingEmails(false);
      setConfirmModalOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ready':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">Ready</span>;
      case 'Duplicate':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200/50" title="Exists in database (Will UPDATE on import)">Duplicate</span>;
      case 'Missing Email':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-200/50">Missing Email</span>;
      case 'Unmapped Business Type':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200/50">Unmapped Business</span>;
      case 'Invalid Budget':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200/50">Invalid Budget</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-neutral-50 text-neutral-600 border border-neutral-200/50">{status}</span>;
    }
  };

  const getEmailStatusBadge = (status: string) => {
    switch (status) {
      case 'Activated':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">Activated</span>;
      case 'Sent':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">Sent</span>;
      case 'Failed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-200/50">Failed</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-neutral-100 text-neutral-550 border border-neutral-200">Not Sent</span>;
    }
  };

  const handleReset = () => {
    setPreviewData([]);
    setStats(null);
    setSelectedRowIndices(new Set());
    setImportSummary(null);
    setImportedRows([]);
    setSelectedImportedIds(new Set());
    setStage('upload');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-brand-600" />
            Meta Leads Import Desk
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Upload Facebook Lead CSVs, preview normalized rows, save to tenant directory, and dispatch activation invitations.</p>
        </div>
      </div>

      {/* STAGE 1: UPLOAD */}
      {stage === 'upload' && (
        <div className="grid grid-cols-1 gap-6">
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition duration-300 bg-white shadow-sm flex flex-col items-center justify-center min-h-[400px]",
              dragActive ? "border-brand-600 bg-brand-50/30" : "border-neutral-200 hover:border-neutral-350 hover:bg-neutral-50/20"
            )}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="hidden" 
            />
            {loading ? (
              <div className="space-y-4">
                <RefreshCw className="w-14 h-14 animate-spin text-brand-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-neutral-800">Processing Lead CSV...</h3>
                  <p className="text-neutral-400 text-sm mt-1">Parsing records, extracting columns, and normalizing tenant space queries.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 mx-auto">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-850">Drag & drop Meta Lead CSV</h3>
                  <p className="text-neutral-400 text-sm mt-1">Or click anywhere on this card to browse files from your computer (Max 5MB)</p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-neutral-100 border border-neutral-200/50 rounded-xl text-neutral-550">
                  <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                  Auto-normalizes business types, boroughs, spaces, budget & timelines
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 2: PREVIEW */}
      {stage === 'preview' && stats && (
        <div className="space-y-6">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-5 bg-white border border-neutral-200/60 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Total Leads</span>
              <div className="text-3xl font-black text-neutral-900 mt-1">{stats.totalRows}</div>
            </div>
            <div className="card p-5 bg-white border border-neutral-200/60 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Valid Rows</span>
              <div className="text-3xl font-black text-emerald-600 mt-1">{stats.validRows}</div>
            </div>
            <div className="card p-5 bg-white border border-neutral-200/60 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Invalid Rows</span>
              <div className="text-3xl font-black text-red-500 mt-1">{stats.invalidRows}</div>
            </div>
            <div className="card p-5 bg-white border border-neutral-200/60 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Duplicates</span>
              <div className="text-3xl font-black text-amber-500 mt-1">{stats.duplicateRows}</div>
            </div>
            <div className="card p-5 bg-white border border-neutral-200/60 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                Unmapped Values
                <span title="Values that were fallback-mapped to 'Other' or 'Not sure yet'">
                  <Info className="w-3.5 h-3.5 text-neutral-450" />
                </span>
              </span>
              <div className="text-3xl font-black text-neutral-600 mt-1">{stats.unmappedValues}</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-neutral-100/50 p-4 border border-neutral-200 rounded-2xl shadow-sm">
            <div className="text-sm font-semibold text-neutral-650 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brand-650" />
              {selectedRowIndices.size} of {previewData.filter(r => r.status !== 'Missing Email').length} rows selected for database ingestion.
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleReset} 
                className="btn btn-secondary border-neutral-300 font-bold px-4 py-2.5 rounded-xl hover:bg-neutral-50"
                disabled={loading}
              >
                Reset
              </button>
              <button 
                onClick={handleCommitImport} 
                className="btn btn-primary bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-brand-700 transition flex items-center gap-2"
                disabled={loading || selectedRowIndices.size === 0}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Import Selected Rows
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="card bg-white rounded-2xl border border-neutral-200/65 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50">
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedRowIndices.size > 0 && selectedRowIndices.size === previewData.filter(r => r.status !== 'Missing Email').length}
                        onChange={toggleAllPreviewRows}
                        className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                    </th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Contact Info</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Business Type</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Boroughs</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Space Details</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Monthly Budget</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Import Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {previewData.map((row, idx) => {
                    const isSelected = selectedRowIndices.has(idx);
                    const isInvalid = row.status === 'Missing Email';
                    
                    return (
                      <tr 
                        key={idx} 
                        className={cn(
                          "transition-colors duration-150",
                          isInvalid ? "bg-red-50/10 hover:bg-red-50/20 text-neutral-400" : isSelected ? "bg-brand-50/10 hover:bg-brand-50/20" : "hover:bg-neutral-50/40"
                        )}
                      >
                        <td className="p-4 text-center">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            disabled={isInvalid}
                            onChange={() => toggleRowSelect(idx)}
                            className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 h-4 w-4 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-neutral-850">
                            {row.fullName && row.fullName.trim() ? row.fullName : "No name provided."}
                          </div>
                          <div className="text-xs font-medium space-y-0.5 mt-0.5">
                            <span className="flex items-center gap-1 text-neutral-500">
                              <Mail className="w-3.5 h-3.5" />
                              {row.email && row.email.trim() ? row.email : "No email provided."}
                            </span>
                            {row.phone && <span className="flex items-center gap-1 text-neutral-500"><Phone className="w-3.5 h-3.5" />{row.phone}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-neutral-700">
                          <div>{row.businessType}</div>
                          <div className="text-xs text-neutral-450 font-normal mt-0.5">Status: <span className="font-semibold text-neutral-550">{row.operatingStatus}</span></div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {row.boroughs.map((b) => (
                              <span key={b} className="px-2 py-0.5 text-[10px] font-bold tracking-wide rounded bg-neutral-100 text-neutral-600 border border-neutral-200/50 uppercase">{b}</span>
                            ))}
                            {row.boroughs.length === 0 && <span className="text-xs text-neutral-400 italic">Flexible</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-neutral-750 text-xs truncate max-w-[150px]">{row.spaceTypes.join(', ')}</div>
                          <div className="text-xs text-neutral-450 mt-0.5">{row.squareFeetRangeLabel}</div>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-neutral-700">
                          {row.budgetRangeLabel}
                        </td>
                        <td className="px-5 py-3.5">
                          {getStatusBadge(row.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: DASHBOARD */}
      {stage === 'dashboard' && importSummary && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Panel */}
          <div className="bg-emerald-50/30 border border-emerald-200/50 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-850">Import Run Completed</h3>
                <p className="text-neutral-500 text-sm mt-0.5">Leads successfully stored in directory. Generate account profiles and send welcome invites below.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-semibold text-neutral-600">
                  <span>New Imports: <span className="text-emerald-600 font-bold">{importSummary.importedCount}</span></span>
                  <span>Updated Requirements: <span className="text-brand-600 font-bold">{importSummary.updatedCount}</span></span>
                  <span>Activation Tokens: <span className="text-accent-500 font-bold">{importSummary.activationLinksGenerated}</span></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={handleReset} 
                className="btn btn-secondary border-neutral-300 font-bold px-4 py-2.5 rounded-xl hover:bg-neutral-50 flex-1 md:flex-initial"
              >
                Import More Leads
              </button>
            </div>
          </div>

          {/* Email controls header */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-neutral-100/50 p-4 border border-neutral-200 rounded-2xl shadow-sm">
            <div className="text-sm font-semibold text-neutral-650 flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-650" />
              {selectedImportedIds.size} leads selected for activation email broadcast.
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => triggerSendActivation(Array.from(selectedImportedIds))} 
                className="btn btn-primary bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-brand-700 transition flex items-center gap-2"
                disabled={sendingEmails || selectedImportedIds.size === 0}
              >
                {sendingEmails ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Bulk Send Selected
              </button>
            </div>
          </div>

          {/* Imported Dashboard Table */}
          <div className="card bg-white rounded-2xl border border-neutral-200/65 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50">
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedImportedIds.size === importedRows.length && importedRows.length > 0}
                        onChange={toggleAllImportedRows}
                        className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                      />
                    </th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Tenant Name</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Email Address</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Business Type</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Invite Sent At</th>
                    <th className="px-5 py-4 text-xs font-bold text-neutral-400 uppercase tracking-wider">Email Status</th>
                    <th className="px-5 py-4 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {importedRows.map((row) => {
                    const isSelected = selectedImportedIds.has(row.id);
                    return (
                      <tr 
                        key={row.id} 
                        className={cn(
                          "transition-colors duration-150 hover:bg-neutral-50/40",
                          isSelected && "bg-brand-50/10"
                        )}
                      >
                        <td className="p-4 text-center">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleImportedSelect(row.id)}
                            className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-neutral-850 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-neutral-400" />
                            {row.full_name}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-neutral-500 font-semibold">
                          {row.email}
                        </td>
                        <td className="px-5 py-3.5 text-neutral-600 font-medium">
                          {row.business_type}
                        </td>
                        <td className="px-5 py-3.5 text-neutral-450 font-semibold text-xs">
                          {row.activation_email_sent_at 
                            ? new Date(row.activation_email_sent_at).toLocaleTimeString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Never'
                          }
                        </td>
                        <td className="px-5 py-3.5">
                          {getEmailStatusBadge(row.activation_email_status)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => triggerSendActivation([row.id])}
                            className="btn btn-secondary border-neutral-200 text-neutral-700 btn-sm hover:bg-brand-50 hover:text-brand-700 hover:border-brand-100 inline-flex items-center gap-1.5 rounded-xl font-bold shadow-sm"
                            disabled={sendingEmails}
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send Email
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM SEND MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-neutral-250 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-black text-neutral-850">Already Sent Invitation</h3>
              </div>
              <button 
                onClick={() => setConfirmModalOpen(false)} 
                className="p-1 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-neutral-500 text-sm leading-relaxed">
              This activation email was already sent. Send again?
            </p>
            
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="btn btn-secondary border-neutral-300 font-bold px-4 py-2 rounded-xl hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={() => triggerSendActivation(pendingSendIds, true)}
                className="btn btn-primary bg-amber-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-amber-700 transition"
              >
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
