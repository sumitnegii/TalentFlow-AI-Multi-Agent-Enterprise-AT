'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, ChevronRight, Loader2, Filter, X, Download,
  UserCheck, ChevronDown, ChevronUp, CheckSquare, Square,
  Star, Tag, ExternalLink, UserX, ArrowRight, RefreshCw, BarChart2,
  Briefcase, Trophy, Zap
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { JobCandidate } from '@/types';

const DECISION_COLORS: Record<string, { text: string; bg: string }> = {
  STRONG_YES: { text: '#059669', bg: 'rgba(5,150,105,0.1)' },
  YES:        { text: '#0D9488', bg: 'rgba(13,148,136,0.1)' },
  MAYBE:      { text: '#D97706', bg: 'rgba(217,119,6,0.1)' },
  NO:         { text: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
};

const STAGE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Applied:   { text: '#6B7280', bg: 'rgba(107,114,128,.08)', border: 'rgba(107,114,128,.2)' },
  Screening: { text: '#2563EB', bg: 'rgba(37,99,235,.08)',   border: 'rgba(37,99,235,.2)' },
  Interview: { text: '#7C3AED', bg: 'rgba(124,58,237,.08)',  border: 'rgba(124,58,237,.2)' },
  Offer:     { text: '#059669', bg: 'rgba(5,150,105,.08)',   border: 'rgba(5,150,105,.2)' },
  Hired:     { text: '#059669', bg: 'rgba(16,185,129,.12)',  border: 'rgba(16,185,129,.3)' },
  Rejected:  { text: '#DC2626', bg: 'rgba(220,38,38,.08)',   border: 'rgba(220,38,38,.2)' },
};

const scoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--error)';

const cleanFileName = (f: string) => {
  if (!f) return 'Candidate';
  return f.replace(/\.[^/.]+$/, '').replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, '').replace(/ \(\d+\)/g, '').replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, '').replace(/[_\-]+/g, ' ').replace(/\s\s+/g, ' ').trim() || 'Candidate';
};

const getCandidateName = (c: any) => c.parsed_data?.full_name || c.full_name || cleanFileName(c.fileName || '');

type SortKey = 'score' | 'name' | 'date' | 'rank';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [decFilter, setDecFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Row expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // Fast single endpoint
      const res = await jobApi.getAllCandidates();
      if (res.data.success) {
        const cands = res.data.candidates;
        setCandidates(cands);
        const campMap: Record<string, string> = {};
        cands.forEach((c: any) => { if (c.campaignId && c.campaignTitle) campMap[c.campaignId] = c.campaignTitle; });
        setCampaigns(campMap);
      }
    } catch { } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const uniqueCampaigns = useMemo(() => [...new Set(candidates.map(c => c.campaignTitle).filter(Boolean))], [candidates]);

  const filtered = useMemo(() => {
    let list = [...candidates];
    if (query) list = list.filter(c => getCandidateName(c).toLowerCase().includes(query.toLowerCase()) || c.parsed_data?.email?.toLowerCase().includes(query.toLowerCase()));
    if (decFilter !== 'All') list = list.filter(c => decFilter === 'PENDING' ? !c.final_decision : c.final_decision === decFilter);
    if (stageFilter !== 'All') list = list.filter(c => (c.interview_stage || 'Applied') === stageFilter);
    if (campaignFilter !== 'All') list = list.filter(c => c.campaignTitle === campaignFilter);
    list.sort((a, b) => {
      if (sortBy === 'score') return (b.final_score ?? b.match_score ?? 0) - (a.final_score ?? a.match_score ?? 0);
      if (sortBy === 'name') return getCandidateName(a).localeCompare(getCandidateName(b));
      if (sortBy === 'rank') return (a.rank || 999) - (b.rank || 999);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [candidates, query, decFilter, stageFilter, campaignFilter, sortBy]);

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(c => c._id)));

  const handleBulkReject = async () => {
    if (!selectedIds.size || !confirm(`Reject ${selectedIds.size} candidates?`)) return;
    setBulkLoading(true);
    try {
      await jobApi.bulkAction(Array.from(selectedIds), 'reject');
      setCandidates(prev => prev.map(c => selectedIds.has(c._id) ? { ...c, interview_stage: 'Rejected', final_decision: 'NO' } : c));
      setSelectedIds(new Set());
    } catch { alert('Failed.'); } finally { setBulkLoading(false); }
  };

  const handleBulkShortlist = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      await jobApi.bulkAction(Array.from(selectedIds), 'stage', 'Screening');
      setCandidates(prev => prev.map(c => selectedIds.has(c._id) ? { ...c, interview_stage: 'Screening' } : c));
      setSelectedIds(new Set());
    } catch { alert('Failed.'); } finally { setBulkLoading(false); }
  };

  const exportCSV = () => {
    const rows = [['Name','Email','Score','Decision','Stage','Role','Applied']];
    filtered.forEach(c => {
      rows.push([
        getCandidateName(c),
        c.parsed_data?.email || '',
        (c.final_score ?? c.match_score ?? ''),
        c.final_decision || '',
        c.interview_stage || 'Applied',
        c.campaignTitle || '',
        new Date(c.createdAt).toLocaleDateString(),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'candidates.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const DECISIONS = ['All', 'STRONG_YES', 'YES', 'MAYBE', 'NO', 'PENDING'];
  const STAGES = ['All', 'Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  if (loading) return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '32px', width: '240px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '14px', width: '160px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />)}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>Talent Pool</h1>
          <p className="page-subtitle">{candidates.length} candidates across {Object.keys(campaigns).length} roles</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => loadAll(true)} className="btn-secondary" style={{ fontSize: '12px' }} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
          <button onClick={exportCSV} className="btn-secondary" style={{ fontSize: '12px' }}>
            <Download size={13} /> Export CSV
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px' }}>
            <Filter size={13} /> {showFilters ? 'Hide' : 'Filters'}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }} className="metrics-grid">
        {[
          { label: 'Total', value: candidates.length, icon: Users, color: 'var(--text-primary)' },
          { label: 'Strong Yes', value: candidates.filter(c => c.final_decision === 'STRONG_YES').length, icon: Trophy, color: 'var(--success)' },
          { label: 'In Interview', value: candidates.filter(c => c.interview_stage === 'Interview').length, icon: Zap, color: 'var(--info)' },
          { label: 'Hired', value: candidates.filter(c => c.interview_stage === 'Hired').length, icon: UserCheck, color: 'var(--accent-primary)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
              </div>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={15} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: showFilters ? '12px' : '16px', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={13} color="var(--text-muted)" />
          <input type="text" placeholder="Search by name or email…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
          style={{ padding: '0 14px', height: '44px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
          <option value="score">Sort: Score</option>
          <option value="rank">Sort: Rank</option>
          <option value="name">Sort: Name</option>
          <option value="date">Sort: Newest</option>
        </select>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Decision filter */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>AI Decision</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {DECISIONS.map(d => (
                    <button key={d} onClick={() => setDecFilter(d)}
                      style={{ padding: '3px 10px', borderRadius: '20px', border: `1.5px solid ${decFilter === d ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: decFilter === d ? 'var(--accent-soft)' : 'var(--bg-card)', color: decFilter === d ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                      {d.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              {/* Stage filter */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Stage</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {STAGES.map(s => (
                    <button key={s} onClick={() => setStageFilter(s)}
                      style={{ padding: '3px 10px', borderRadius: '20px', border: `1.5px solid ${stageFilter === s ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: stageFilter === s ? 'var(--accent-soft)' : 'var(--bg-card)', color: stageFilter === s ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {/* Role filter */}
              {uniqueCampaigns.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Role</div>
                  <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
                    style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: '11px', outline: 'none' }}>
                    <option value="All">All Roles</option>
                    {uniqueCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {(decFilter !== 'All' || stageFilter !== 'All' || campaignFilter !== 'All') && (
                <button onClick={() => { setDecFilter('All'); setStageFilter('All'); setCampaignFilter('All'); }} className="btn-ghost" style={{ fontSize: '11px', alignSelf: 'flex-end' }}>
                  <X size={11} /> Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk actions */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -6, height: 0 }}
            style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(232,98,42,0.07)', border: '1px solid rgba(232,98,42,0.2)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '12px', color: 'var(--accent-primary)' }}>{selectedIds.size} selected</span>
            <button onClick={handleBulkShortlist} disabled={bulkLoading} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 12px', color: 'var(--success)', borderColor: 'rgba(5,150,105,.3)' }}>
              <UserCheck size={11} /> Shortlist
            </button>
            <button onClick={handleBulkReject} disabled={bulkLoading} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 12px', color: 'var(--error)', borderColor: 'rgba(220,38,38,.3)' }}>
              <UserX size={11} /> Reject All
            </button>
            {bulkLoading && <Loader2 size={13} className="animate-spin" color="var(--accent-primary)" />}
            <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontWeight: '700', marginBottom: '4px' }}>No candidates found</div>
            <div style={{ fontSize: '12px' }}>Try adjusting your filters.</div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 70px 110px 140px 40px', gap: '8px', padding: '10px 14px', borderBottom: '1.5px solid var(--border-color)', background: 'rgba(0,0,0,0.02)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', alignItems: 'center' }}>
              <div><button onClick={selectAll} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>{selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={14} color="var(--accent-primary)" /> : <Square size={14} />}</button></div>
              <div>Candidate</div>
              <div>Role</div>
              <div style={{ textAlign: 'center' }}>Score</div>
              <div>Decision</div>
              <div>Stage</div>
              <div />
            </div>

            {/* Rows */}
            {filtered.map((c, idx) => {
              const name = getCandidateName(c);
              const score = c.final_score ?? c.match_score;
              const stage = c.interview_stage || 'Applied';
              const sc = STAGE_COLORS[stage] || STAGE_COLORS['Applied'];
              const dec = DECISION_COLORS[c.final_decision || ''];
              const isExpanded = expandedId === c._id;
              const isSelected = selectedIds.has(c._id);

              return (
                <React.Fragment key={c._id}>
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 70px 110px 140px 40px', gap: '8px', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', background: isSelected ? 'rgba(232,98,42,0.04)' : isExpanded ? 'rgba(0,0,0,0.015)' : 'transparent', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : c._id)}
                  >
                    <div onClick={e => { e.stopPropagation(); toggleSelect(c._id); }}>
                      {isSelected ? <CheckSquare size={14} color="var(--accent-primary)" /> : <Square size={14} color="var(--text-muted)" />}
                    </div>

                    {/* Name + skills */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', color: 'var(--accent-primary)', flexShrink: 0 }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        {c.isSilverMedalist && <Star size={11} color="#D97706" fill="#D97706" />}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(c.validated_skills?.top_skills || []).slice(0, 3).map((sk: any, i: number) => (
                          <span key={i} className="tag" style={{ fontSize: '9px', padding: '1px 5px' }}>{typeof sk === 'string' ? sk : sk.name}</span>
                        ))}
                      </div>
                    </div>

                    {/* Role */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
                        {c.campaignTitle || '—'}
                      </div>
                      {c.isLegacy && (
                        <div style={{ width: 'fit-content', fontSize: '8px', fontWeight: '800', padding: '0px 4px', borderRadius: '3px', background: 'rgba(107,114,128,0.1)', color: 'var(--text-muted)' }}>LEGACY</div>
                      )}
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'center' }}>
                      {score != null ? (
                        <span style={{ fontWeight: '900', fontSize: '16px', color: scoreColor(score), fontFamily: 'var(--font-display)' }}>{score}</span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>}
                    </div>

                    {/* Decision */}
                    <div>
                      {c.final_decision ? (
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: dec?.bg || 'rgba(107,114,128,0.1)', color: dec?.text || 'var(--text-muted)', border: `1px solid ${dec?.text || '#9CA3AF'}20` }}>
                          {c.final_decision.replace('_', ' ')}
                        </span>
                      ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending</span>}
                    </div>

                    {/* Stage */}
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {stage}
                      </span>
                    </div>

                    {/* Expand toggle */}
                    <div style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </motion.div>

                  {/* Expanded row */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '16px 14px 16px 54px', background: 'rgba(0,0,0,0.015)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                          {/* Contact */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Contact</div>
                            {c.parsed_data?.email && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>✉ {c.parsed_data.email}</div>}
                            {c.parsed_data?.phone && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>📞 {c.parsed_data.phone}</div>}
                            {c.parsed_data?.location && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>📍 {c.parsed_data.location}</div>}
                          </div>
                          {/* Skills */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>All Skills</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(c.validated_skills?.top_skills || []).map((sk: any, i: number) => (
                                <span key={i} className="tag" style={{ fontSize: '10px' }}>{typeof sk === 'string' ? sk : sk.name}</span>
                              ))}
                            </div>
                          </div>
                          {/* Actions */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Quick Actions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <Link href={`/candidate/${c._id}`} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', justifyContent: 'center' }}>
                                <ExternalLink size={11} /> View Full Profile
                              </Link>
                              <Link href={`/jd/${c.campaignId}`} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                <Briefcase size={11} /> View Role
                              </Link>
                              <button
                                onClick={() => jobApi.toggleSilverMedal(c._id).then(r => { setCandidates(prev => prev.map(x => x._id === c._id ? { ...x, isSilverMedalist: r.data.isSilverMedalist } : x)); })}
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '6px 12px', color: c.isSilverMedalist ? '#D97706' : undefined, borderColor: c.isSilverMedalist ? 'rgba(217,119,6,0.3)' : undefined }}
                              >
                                <Star size={11} fill={c.isSilverMedalist ? '#D97706' : 'none'} /> {c.isSilverMedalist ? 'Remove Silver' : 'Silver Medalist'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}

            {/* Footer */}
            <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.02)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Showing {filtered.length} of {candidates.length} candidates</span>
              {filtered.length < candidates.length && (
                <button onClick={() => { setDecFilter('All'); setStageFilter('All'); setCampaignFilter('All'); setQuery(''); }} className="btn-ghost" style={{ fontSize: '10px', padding: '2px 8px' }}>Clear filters</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
