import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Edit3, Save, X, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';
import { StimulusCardRenderer } from '../../game/StimulusCardRenderer';
import type { Stimulus, StimulusType } from '../../../types';

interface StimulusDoc {
  _id: string;
  stimulusId: string;
  type?: string;
  category: string;
  tier: number;
  truthClass: 'phish' | 'legit';
  sender?: { text: string; isSuspicious: boolean; reason?: string; explanation: string };
  content?: { text: string; isSuspicious: boolean; reason?: string; explanation: string };
  actionUrl?: { text: string; isSuspicious: boolean; reason?: string; explanation: string };
  actionText?: { text: string; isSuspicious: boolean; reason?: string; explanation: string };
  amount?: { text: string; isSuspicious: boolean; reason?: string; explanation: string };
  explanation?: string;
  cueList: string[];
  status: 'active' | 'draft' | 'retired';
  exposureCount: number;
  createdAt: string;
  updatedAt: string;
}

function toStimulus(doc: StimulusDoc): Stimulus {
  return {
    id: doc.stimulusId,
    type: (doc.type || 'SMS') as StimulusType,
    sender: doc.sender ? { text: doc.sender.text, isSuspicious: doc.sender.isSuspicious, reason: doc.sender.reason as any, explanation: doc.sender.explanation || '' } : { text: '', isSuspicious: false, explanation: '' },
    content: doc.content ? { text: doc.content.text, isSuspicious: doc.content.isSuspicious, reason: doc.content.reason as any, explanation: doc.content.explanation || '' } : { text: '', isSuspicious: false, explanation: '' },
    actionUrl: doc.actionUrl ? { text: doc.actionUrl.text, isSuspicious: doc.actionUrl.isSuspicious, reason: doc.actionUrl.reason as any, explanation: doc.actionUrl.explanation || '' } : undefined,
    actionText: doc.actionText ? { text: doc.actionText.text, isSuspicious: doc.actionText.isSuspicious, reason: doc.actionText.reason as any, explanation: doc.actionText.explanation || '' } : undefined,
    amount: doc.amount ? { text: doc.amount.text, isSuspicious: doc.amount.isSuspicious, reason: doc.amount.reason as any, explanation: doc.amount.explanation || '' } : undefined,
    difficultyTier: doc.tier as 1 | 2 | 3 | 4 | 5,
    explanation: doc.explanation || '',
  };
}

const TIER_COLORS: Record<number, string> = {
  1: 'bg-green-500/20 text-green-400 border-green-500/40',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  4: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  5: 'bg-red-500/20 text-red-400 border-red-500/40',
};
const TYPE_COLORS: Record<string, string> = {
  SMS: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  WHATSAPP: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  EMAIL: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  UPI: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  SOCIAL: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
};

export function AdminStimuli() {
  const [stimuli, setStimuli] = useState<StimulusDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterTier, setFilterTier] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterTruth, setFilterTruth] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StimulusDoc | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<StimulusDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const PAGE_SIZE = 50;

  const fetchStimuli = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterType !== 'ALL') params.type = filterType;
      if (filterTier !== 'ALL') params.tier = filterTier;
      if (filterStatus !== 'ALL') params.status = filterStatus;
      if (filterTruth !== 'ALL') params.truthClass = filterTruth;
      const data = await adminApi.getFullStimuli(Object.keys(params).length > 0 ? params : undefined);
      setStimuli(data?.stimuli || []);
    } catch {
      setError('Failed to load stimuli');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterTier, filterStatus, filterTruth]);

  useEffect(() => { fetchStimuli(); }, [fetchStimuli]);

  const filtered = stimuli.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.stimulusId.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) ||
      (s.sender?.text || '').toLowerCase().includes(q) || (s.content?.text || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterType, filterTier, filterStatus, filterTruth]);

  const openDetail = (doc: StimulusDoc) => { setSelected(doc); setEditing(false); setEditData(null); setSaveMsg(''); };
  const closeModal = () => { setSelected(null); setEditing(false); setEditData(null); setSaveMsg(''); };

  const startEdit = () => {
    if (!selected) return;
    setEditing(true);
    setEditData({ ...selected });
    setSaveMsg('');
  };

  const updateField = (field: string, value: string) => {
    if (!editData) return;
    setEditData({ ...editData, [field]: value });
  };

  const updateElementField = (elementField: 'sender' | 'content' | 'actionUrl' | 'actionText' | 'amount', subField: string, value: string | boolean) => {
    if (!editData) return;
    const current = editData[elementField] || { text: '', isSuspicious: false, explanation: '' };
    setEditData({ ...editData, [elementField]: { ...current, [subField]: value } });
  };

  const saveEdit = async () => {
    if (!editData) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const data = await adminApi.updateFullStimulus(editData.stimulusId, {
        sender: editData.sender,
        content: editData.content,
        actionUrl: editData.actionUrl,
        actionText: editData.actionText,
        amount: editData.amount,
        explanation: editData.explanation,
        type: editData.type,
        category: editData.category,
        tier: editData.tier,
        truthClass: editData.truthClass,
        status: editData.status,
      });
      setSelected(data);
      setEditData(null);
      setEditing(false);
      setSaveMsg('Saved!');
      fetchStimuli();
    } catch {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-black text-white uppercase tracking-widest cyber-glow-text">Stimuli Library</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">{filtered.length} stimuli total</p>
        </div>
        <button onClick={fetchStimuli}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-xs font-mono">{error}</div>
      )}

      {/* Filters */}
      <div className="glass-strong rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search ID, category, sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none"
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
            <option value="ALL">All Types</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
            <option value="UPI">UPI</option>
            <option value="SOCIAL">Social</option>
          </select>
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
            <option value="ALL">All Tiers</option>
            {[1,2,3,4,5].map(t => <option key={t} value={t}>Tier {t}</option>)}
          </select>
          <select value={filterTruth} onChange={(e) => setFilterTruth(e.target.value)}
            className="px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
            <option value="ALL">All Truth</option>
            <option value="phish">Phish</option>
            <option value="legit">Legit</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
            <option value="ALL">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-strong rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <p className="font-mono text-sm">No stimuli found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="border-b border-cyan-500/20">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-cyan-300 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left font-bold text-cyan-300 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-bold text-cyan-300 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-center font-bold text-cyan-300 uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-3 text-center font-bold text-cyan-300 uppercase tracking-wider">Truth</th>
                  <th className="px-4 py-3 text-left font-bold text-cyan-300 uppercase tracking-wider">Sender</th>
                  <th className="px-4 py-3 text-left font-bold text-cyan-300 uppercase tracking-wider hidden lg:table-cell">Body</th>
                  <th className="px-4 py-3 text-center font-bold text-cyan-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-bold text-cyan-300 uppercase tracking-wider">Views</th>
                  <th className="px-4 py-3 text-center font-bold text-cyan-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {paged.map((doc) => (
                  <tr key={doc.stimulusId} className="hover:bg-cyan-500/5 transition-colors">
                    <td className="px-4 py-3 text-cyan-200 font-bold">{doc.stimulusId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${TYPE_COLORS[doc.type || 'SMS'] || TYPE_COLORS.SMS}`}>
                        {doc.type || 'SMS'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{doc.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex w-6 h-6 rounded border items-center justify-center text-[10px] font-bold ${TIER_COLORS[doc.tier] || TIER_COLORS[1]}`}>
                        {doc.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                        doc.truthClass === 'phish' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
                      }`}>
                        {doc.truthClass === 'phish' ? '⚠ PHISH' : '✓ LEGIT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate">{doc.sender?.text || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate hidden lg:table-cell">{doc.content?.text || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                        doc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        doc.status === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{doc.exposureCount}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openDetail(doc)}
                        className="p-1.5 rounded-lg border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition"
                        title="View & Edit">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cyan-500/20">
            <span className="text-[10px] text-slate-600 font-mono">
              PAGE {page}/{totalPages} ({filtered.length} ITEMS)
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="glass-strong rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-cyan-500/20" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${TYPE_COLORS[editing ? (editData?.type || 'SMS') : (selected.type || 'SMS')] || TYPE_COLORS.SMS}`}>
                  {editing ? (editData?.type || 'SMS') : (selected.type || 'SMS')}
                </span>
                <div>
                  <h2 className="font-display font-bold text-white text-sm uppercase tracking-wider">{editing ? editData?.stimulusId : selected.stimulusId}</h2>
                  <p className="text-[10px] text-slate-500 font-mono">{editing ? editData?.category : selected.category}</p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                  (editing ? editData?.truthClass : selected.truthClass) === 'phish' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
                }`}>
                  {(editing ? editData?.truthClass : selected.truthClass) === 'phish' ? '⚠ PHISH' : '✓ LEGIT'}
                </span>
                <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                  (editing ? editData?.status : selected.status) === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  (editing ? editData?.status : selected.status) === 'draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}>
                  {editing ? editData?.status : selected.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saveMsg && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
                    saveMsg === 'Saved!' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {saveMsg}
                  </span>
                )}
                {!editing ? (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                ) : (
                  <>
                    <button onClick={saveEdit} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg border border-green-500/40 text-green-400 hover:bg-green-500/10 transition disabled:opacity-50">
                      <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditing(false); setEditData(null); setSaveMsg(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg border border-slate-500/40 text-slate-400 hover:bg-slate-500/10 transition">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </>
                )}
                <button onClick={closeModal} className="p-1.5 rounded-lg border border-slate-500/20 text-slate-500 hover:text-white hover:bg-white/5 transition ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row">
                {/* Live Preview */}
                <div className="lg:w-[380px] shrink-0 p-6 bg-[#0a0515]/50 flex flex-col items-center border-r border-cyan-500/20">
                  <p className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-widest mb-3">Live Preview</p>
                  <div className="w-[320px] h-[480px] rounded-xl overflow-hidden shadow-2xl border border-cyan-500/20">
                    <StimulusCardRenderer stimulus={toStimulus(editing && editData ? editData : selected)} />
                  </div>
                </div>

                {/* Content / Edit Form */}
                <div className="flex-1 p-6 space-y-5">
                  {editing && editData ? (
                    /* EDIT MODE */
                    <>
                      {/* Metadata row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">Type</label>
                          <select value={editData.type || 'SMS'} onChange={(e) => updateField('type', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
                            {['SMS','WHATSAPP','EMAIL','UPI','SOCIAL'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">Tier</label>
                          <select value={editData.tier} onChange={(e) => updateField('tier', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
                            {[1,2,3,4,5].map(t => <option key={t} value={t}>Tier {t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">Truth Class</label>
                          <select value={editData.truthClass} onChange={(e) => updateField('truthClass', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
                            <option value="phish">Phish</option>
                            <option value="legit">Legit</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">Status</label>
                          <select value={editData.status} onChange={(e) => updateField('status', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white focus:ring-1 focus:ring-cyan-500/50 outline-none">
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="retired">Retired</option>
                          </select>
                        </div>
                      </div>

                      {/* Sender */}
                      <div className="border border-cyan-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider">Sender</h3>
                          <label className="flex items-center gap-1.5 text-[10px] font-mono">
                            <input type="checkbox" checked={editData.sender?.isSuspicious || false}
                              onChange={(e) => updateElementField('sender', 'isSuspicious', e.target.checked)}
                              className="rounded border-cyan-500/30 bg-[#0a0515]" />
                            <span className="text-red-400 font-bold">SUSPICIOUS</span>
                          </label>
                        </div>
                        <input type="text" value={editData.sender?.text || ''} onChange={(e) => updateElementField('sender', 'text', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="Sender name/email/number" />
                        <input type="text" value={editData.sender?.reason || ''} onChange={(e) => updateElementField('sender', 'reason', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="Why suspicious (reason)" />
                        <textarea value={editData.sender?.explanation || ''} onChange={(e) => updateElementField('sender', 'explanation', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 resize-none" rows={2} placeholder="Explanation shown to player" />
                      </div>

                      {/* Content / Body */}
                      <div className="border border-cyan-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider">Message Body</h3>
                          <label className="flex items-center gap-1.5 text-[10px] font-mono">
                            <input type="checkbox" checked={editData.content?.isSuspicious || false}
                              onChange={(e) => updateElementField('content', 'isSuspicious', e.target.checked)}
                              className="rounded border-cyan-500/30 bg-[#0a0515]" />
                            <span className="text-red-400 font-bold">SUSPICIOUS</span>
                          </label>
                        </div>
                        <textarea value={editData.content?.text || ''} onChange={(e) => updateElementField('content', 'text', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2 resize-none" rows={4} placeholder="Message body text" />
                        <input type="text" value={editData.content?.reason || ''} onChange={(e) => updateElementField('content', 'reason', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="Why suspicious (reason)" />
                        <textarea value={editData.content?.explanation || ''} onChange={(e) => updateElementField('content', 'explanation', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 resize-none" rows={2} placeholder="Explanation shown to player" />
                      </div>

                      {/* Action URL */}
                      {(editData.type === 'SMS' || editData.type === 'WHATSAPP' || editData.type === 'EMAIL' || editData.type === 'SOCIAL') && (
                        <div className="border border-cyan-500/20 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider">Action URL</h3>
                            <label className="flex items-center gap-1.5 text-[10px] font-mono">
                              <input type="checkbox" checked={editData.actionUrl?.isSuspicious || false}
                                onChange={(e) => updateElementField('actionUrl', 'isSuspicious', e.target.checked)}
                                className="rounded border-cyan-500/30 bg-[#0a0515]" />
                              <span className="text-red-400 font-bold">SUSPICIOUS</span>
                            </label>
                          </div>
                          <input type="text" value={editData.actionUrl?.text || ''} onChange={(e) => updateElementField('actionUrl', 'text', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="https://..." />
                          <input type="text" value={editData.actionUrl?.reason || ''} onChange={(e) => updateElementField('actionUrl', 'reason', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="Why suspicious (reason)" />
                          <textarea value={editData.actionUrl?.explanation || ''} onChange={(e) => updateElementField('actionUrl', 'explanation', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 resize-none" rows={2} placeholder="Explanation shown to player" />
                        </div>
                      )}

                      {/* Amount (UPI only) */}
                      {editData.type === 'UPI' && (
                        <div className="border border-cyan-500/20 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider">Amount</h3>
                            <label className="flex items-center gap-1.5 text-[10px] font-mono">
                              <input type="checkbox" checked={editData.amount?.isSuspicious || false}
                                onChange={(e) => updateElementField('amount', 'isSuspicious', e.target.checked)}
                                className="rounded border-cyan-500/30 bg-[#0a0515]" />
                              <span className="text-red-400 font-bold">SUSPICIOUS</span>
                            </label>
                          </div>
                          <input type="text" value={editData.amount?.text || ''} onChange={(e) => updateElementField('amount', 'text', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="₹1,000" />
                          <input type="text" value={editData.amount?.reason || ''} onChange={(e) => updateElementField('amount', 'reason', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 mb-2" placeholder="Why suspicious (reason)" />
                          <textarea value={editData.amount?.explanation || ''} onChange={(e) => updateElementField('amount', 'explanation', e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 resize-none" rows={2} placeholder="Explanation shown to player" />
                        </div>
                      )}

                      {/* Explanation */}
                      <div className="border border-cyan-500/20 rounded-lg p-4">
                        <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider mb-2">Post-Investigation Explanation</h3>
                        <textarea value={editData.explanation || ''} onChange={(e) => updateField('explanation', e.target.value)}
                          className="w-full px-3 py-2 bg-[#0a0515] border border-cyan-500/20 rounded-lg text-xs font-mono text-white placeholder-slate-600 resize-none" rows={3}
                          placeholder="Shown to player after they investigate this stimulus" />
                      </div>
                    </>
                  ) : (
                    /* VIEW MODE */
                    <>
                      {/* Metadata summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Category', value: selected.category },
                          { label: 'Tier', value: `${selected.tier} / 5` },
                          { label: 'Exposures', value: String(selected.exposureCount) },
                          { label: 'Cues', value: String(selected.cueList.length) },
                        ].map(({ label, value }) => (
                          <div key={label} className="border border-cyan-500/20 rounded-lg p-3">
                            <p className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">{label}</p>
                            <p className="text-xs font-mono text-white">{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Element breakdown */}
                      <div className="space-y-3">
                        <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider border-b border-cyan-500/20 pb-2">Element Analysis</h3>
                        {[
                          { label: 'Sender', data: selected.sender, icon: '👤' },
                          { label: 'Body', data: selected.content, icon: '💬' },
                          { label: 'Action URL', data: selected.actionUrl, icon: '🔗' },
                          { label: 'Amount', data: selected.amount, icon: '💰' },
                        ].filter(el => el.data).map(({ label, data, icon }) => (
                          <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-cyan-500/10 bg-[#0a0515]/50">
                            <span className="text-base mt-0.5">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">{label}</span>
                                {data!.isSuspicious && (
                                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 text-[9px] font-mono font-bold rounded">SUSPICIOUS</span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-white break-words">{data!.text || '—'}</p>
                              {data!.reason && <p className="text-[10px] font-mono text-slate-500 mt-1">Reason: {data!.reason}</p>}
                              {data!.explanation && <p className="text-[10px] font-mono text-cyan-400 mt-1">Explanation: {data!.explanation}</p>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Full explanation */}
                      {selected.explanation && (
                        <div className="border border-cyan-500/20 rounded-lg p-4">
                          <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider mb-2">Post-Investigation Explanation</h3>
                          <p className="text-xs font-mono text-white whitespace-pre-wrap">{selected.explanation}</p>
                        </div>
                      )}

                      {/* Cue list */}
                      {selected.cueList.length > 0 && (
                        <div className="border border-cyan-500/20 rounded-lg p-4">
                          <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider mb-2">Cues</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.cueList.map((cue, i) => (
                              <span key={i} className="px-2 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono rounded">{cue}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
