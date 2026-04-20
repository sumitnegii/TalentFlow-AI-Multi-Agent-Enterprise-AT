'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Loader2, ChevronLeft, Sparkles, Upload, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, UserCheck, Zap, Award, RefreshCw,
  Clock, MapPin, ExternalLink, BrainCircuit, Share2, Star, ShieldAlert,
  TrendingUp, Trash2, BarChart3, PieChart, Target, MessageSquare,
  CheckSquare, Square, X, ArrowRight, KanbanSquare, TableProperties,
  ChevronRight, Filter, Download, Send, UserX
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { pushNotif } from '@/components/Sidebar';
import { JobCandidate, JobCampaign, JDAnalysis } from '@/types';

// ── Shared helpers ────────────────────────────────────────────
const STEPS = [
  { key: 'UPLOADED', label: 'Received', short: '1' },
  { key: 'AGENT_3_4_DONE', label: 'Parsed', short: '2' },
  { key: 'AGENT_5_DONE', label: 'Scored', short: '3' },
  { key: 'AGENT_6_7_DONE', label: 'Debated', short: '4' },
  { key: 'COMPLETED', label: 'Done', short: '5' },
];

const INTERVIEW_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] as const;

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Applied:   { bg: 'rgba(107,114,128,.08)', text: '#6B7280', border: 'rgba(107,114,128,.2)' },
  Screening: { bg: 'rgba(37,99,235,.08)',   text: '#2563EB', border: 'rgba(37,99,235,.2)' },
  Interview: { bg: 'rgba(124,58,237,.08)',  text: '#7C3AED', border: 'rgba(124,58,237,.2)' },
  Offer:     { bg: 'rgba(5,150,105,.08)',   text: '#059669', border: 'rgba(5,150,105,.2)' },
  Hired:     { bg: 'rgba(16,185,129,.12)',  text: '#059669', border: 'rgba(16,185,129,.3)' },
  Rejected:  { bg: 'rgba(220,38,38,.08)',   text: '#DC2626', border: 'rgba(220,38,38,.2)' },
};

const DECISION_COLORS: Record<string, string> = {
  STRONG_YES: '#059669', YES: '#0D9488', MAYBE: '#D97706', NO: '#DC2626',
};

const scoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : '#DC2626';

const cleanFileName = (f: string) => {
  if (!f) return 'Candidate';
  let n = f.replace(/\.[^/.]+$/, '').replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, '').replace(/ \(\d+\)/g, '').replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, '').replace(/[_\-]+/g, ' ').replace(/\s\s+/g, ' ').trim();
  return n || 'Candidate';
};

const getCandidateName = (c: JobCandidate) => c.parsed_data?.full_name || c.full_name || cleanFileName(c.fileName || '');

// ── Pipeline mini-stepper ────────────────────────────────────
const ProcessStepper = ({ status }: { status: string }) => {
  const cur = STEPS.findIndex(s => s.key === status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {STEPS.map((step, i) => {
        const done = i <= cur;
        const active = i === cur + 1 && status !== 'COMPLETED';
        const isLast = i === STEPS.length - 1;
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div className={`step-dot ${done ? 'done' : active ? 'active' : ''}`}>
                {done && i < cur ? <CheckCircle2 size={10} /> : active ? <Loader2 size={9} className="animate-spin" /> : step.short}
              </div>
              <span style={{ fontSize: '7px', color: done ? 'var(--success)' : 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>{step.label}</span>
            </div>
            {!isLast && <div className={`step-line ${done && i < cur ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Upload Zone ────────────────────────────────────────────────
const UploadZone = ({ onUpload, isUploading }: { onUpload: (f: File[]) => Promise<void>; isUploading: boolean }) => {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (newFiles: File[]) => setFiles(prev => {
    const existing = new Set(prev.map(f => f.name));
    return [...prev, ...newFiles.filter(f => !existing.has(f.name))];
  });

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => !isUploading && document.getElementById('cv-file-input')?.click()}
        style={{ padding: '24px', minHeight: 'auto' }}
      >
        <input id="cv-file-input" type="file" multiple hidden accept=".pdf,.docx,.doc,image/png,image/jpeg,image/jpg"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
        <motion.div animate={{ y: dragging ? -4 : 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <Upload size={28} color={dragging ? 'var(--accent-primary)' : 'var(--text-muted)'} />
          <div style={{ fontWeight: '700', fontSize: '14px', color: dragging ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
            {isUploading ? 'Processing…' : 'Drop resumes here or click to browse'}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>PDF, DOCX, PNG/JPG · Up to 10MB per file</p>
        </motion.div>
      </div>
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {files.map((f, i) => (
                <div key={i} className="badge badge-accent" style={{ gap: '5px', cursor: 'pointer' }} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                  <FileText size={10} />
                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }}>{f.name}</span>
                  <X size={9} />
                </div>
              ))}
            </div>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={isUploading}
              onClick={async e => { e.stopPropagation(); await onUpload(files); setFiles([]); }}>
              {isUploading ? <><Loader2 className="animate-spin" size={16} /> Uploading & Parsing…</> : <><Upload size={16} /> Upload {files.length} CV{files.length !== 1 ? 's' : ''}</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── TABLE VIEW ─────────────────────────────────────────────────
type CandidateView = 'table' | 'kanban';

const CandidateTable = ({
  candidates, selectedIds, onSelect, onSelectAll, onDelete, onStageChange,
}: {
  candidates: JobCandidate[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (id: string) => void;
  onStageChange: (id: string, stage: string) => void;
}) => {
  const allSelected = candidates.length > 0 && candidates.every(c => selectedIds.has(c._id));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid var(--border-color)' }}>
            <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>
              <button onClick={onSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                {allSelected ? <CheckSquare size={16} color="var(--accent-primary)" /> : <Square size={16} />}
              </button>
            </th>
            {['Rank', 'Candidate', 'Pipeline', 'Score', 'Decision', 'Stage', 'Actions'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Score' || h === 'Rank' ? 'center' : 'left', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, idx) => {
            const score = c.final_score ?? c.match_score;
            const name = getCandidateName(c);
            const stage = c.interview_stage || 'Applied';
            const sc = STAGE_COLORS[stage] || STAGE_COLORS['Applied'];
            const isSelected = selectedIds.has(c._id);

            return (
              <tr key={c._id}
                style={{ borderBottom: '1px solid var(--border-color)', background: isSelected ? 'rgba(232,98,42,0.04)' : 'transparent', transition: 'background 0.15s' }}
              >
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <button onClick={() => onSelect(c._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                    {isSelected ? <CheckSquare size={15} color="var(--accent-primary)" /> : <Square size={15} />}
                  </button>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: c.rank && c.rank <= 3 ? 'var(--accent-gradient)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', color: c.rank && c.rank <= 3 ? 'white' : 'var(--text-secondary)', margin: '0 auto' }}>
                    {c.rank || idx + 1}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '180px' }}>
                  <div style={{ fontWeight: '700', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{name}</span>
                    <Link href={`/candidate/${c._id}`} style={{ flexShrink: 0, color: 'var(--accent-primary)' }}>
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(c.validated_skills?.top_skills || []).slice(0, 3).map((sk: any, i: number) => (
                      <span key={i} className="tag" style={{ fontSize: '9px', padding: '1px 6px' }}>{typeof sk === 'string' ? sk : sk.name}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', minWidth: '160px' }}>
                  <ProcessStepper status={c.status || 'UPLOADED'} />
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {score != null ? (
                    <span style={{ fontSize: '18px', fontWeight: '900', color: scoreColor(score), fontFamily: 'var(--font-display)' }}>{score}</span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {c.final_decision ? (
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: `${DECISION_COLORS[c.final_decision] || '#9CA3AF'}14`, color: DECISION_COLORS[c.final_decision] || '#9CA3AF', border: `1px solid ${DECISION_COLORS[c.final_decision] || '#9CA3AF'}28` }}>
                      {c.final_decision.replace('_', ' ')}
                    </span>
                  ) : <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Pending</span>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={stage}
                    onChange={e => onStageChange(c._id, e.target.value)}
                    style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text, cursor: 'pointer', outline: 'none' }}
                  >
                    {INTERVIEW_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Link href={`/candidate/${c._id}`} style={{ padding: '5px', borderRadius: '6px', background: 'var(--accent-soft)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                      <ExternalLink size={13} />
                    </Link>
                    <button onClick={() => onDelete(c._id)} style={{ padding: '5px', borderRadius: '6px', background: 'rgba(220,38,38,.07)', color: '#DC2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          <Users size={32} style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
          No candidates yet. Upload CVs above.
        </div>
      )}
    </div>
  );
};

// ── KANBAN VIEW ────────────────────────────────────────────────
const CandidateKanban = ({
  candidates, onStageChange,
}: {
  candidates: JobCandidate[];
  onStageChange: (id: string, stage: string) => void;
}) => {
  const cols = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', overflowX: 'auto', minWidth: '900px' }}>
      {cols.map(col => {
        const sc = STAGE_COLORS[col];
        const colCandidates = candidates.filter(c => (c.interview_stage || 'Applied') === col);
        return (
          <div key={col}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', padding: '6px 10px', borderRadius: '8px', background: sc.bg, border: `1px solid ${sc.border}` }}>
              <span style={{ fontWeight: '700', fontSize: '10px', color: sc.text, textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>{col}</span>
              <span style={{ background: sc.border, color: sc.text, borderRadius: '20px', fontSize: '9px', fontWeight: '800', padding: '1px 5px' }}>{colCandidates.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
              {colCandidates.map(c => {
                const score = c.final_score ?? c.match_score;
                const name = getCandidateName(c);
                return (
                  <motion.div key={c._id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="card" style={{ padding: '12px', borderLeft: `3px solid ${sc.text}` }}>
                      <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        {score != null && (
                          <span style={{ fontSize: '14px', fontWeight: '900', color: scoreColor(score) }}>{score}</span>
                        )}
                        {c.final_decision && (
                          <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '20px', background: `${DECISION_COLORS[c.final_decision] || '#9CA3AF'}14`, color: DECISION_COLORS[c.final_decision] || '#9CA3AF' }}>
                            {c.final_decision.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(c.validated_skills?.top_skills || []).slice(0, 2).map((sk: any, i: number) => (
                          <span key={i} className="tag" style={{ fontSize: '9px', padding: '1px 5px' }}>{typeof sk === 'string' ? sk : sk.name}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                        {cols.filter(s => s !== col).slice(0, 2).map(s => (
                          <button key={s} onClick={() => onStageChange(c._id, s)}
                            style={{ flex: 1, fontSize: '9px', fontWeight: '600', padding: '3px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', borderRadius: '5px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            → {s}
                          </button>
                        ))}
                        <Link href={`/candidate/${c._id}`} style={{ display: 'flex', alignItems: 'center', padding: '3px 5px', background: 'var(--accent-soft)', borderRadius: '5px', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                          <ExternalLink size={10} />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {colCandidates.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', border: '1.5px dashed var(--border-color)', borderRadius: '8px' }}>Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Campaign Analytics ─────────────────────────────────────────
const CampaignAnalytics = ({ candidates, job }: { candidates: JobCandidate[]; job: JobCampaign }) => {
  const funnelStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  const funnelData = funnelStages.map(s => ({ stage: s, count: candidates.filter(c => (c.interview_stage || 'Applied') === s).length }));
  const scoreBuckets = [
    { label: '90+', min: 90, max: 101, color: '#10B981' },
    { label: '80-89', min: 80, max: 90, color: '#059669' },
    { label: '70-79', min: 70, max: 80, color: '#D97706' },
    { label: '60-69', min: 60, max: 70, color: '#EA580C' },
    { label: '<60', min: 0, max: 60, color: '#DC2626' },
  ];
  const scoreDist = scoreBuckets.map(b => ({ ...b, count: candidates.filter(c => { const s = c.final_score ?? c.match_score; return s != null && s >= b.min && s < b.max; }).length }));
  const maxFunnel = Math.max(...funnelData.map(d => d.count), 1);
  const maxScore = Math.max(...scoreDist.map(d => d.count), 1);
  const requiredSkills = (job.jd_analysis?.must_have_skills || job.jd_analysis?.required_skills || []) as any[];
  const skillCoverage = requiredSkills.map((s: any) => {
    const name = typeof s === 'string' ? s : s.name || '';
    const matched = candidates.filter(c => (c.validated_skills?.top_skills || []).some((sk: any) => (typeof sk === 'string' ? sk : sk.name || '').toLowerCase().includes(name.toLowerCase())));
    return { name, count: matched.length, pct: Math.round((matched.length / (candidates.length || 1)) * 100) };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Applicants', value: candidates.length, icon: Users, color: 'var(--text-primary)' },
          { label: 'Avg Score', value: `${Math.round(candidates.reduce((a, b) => a + (b.final_score ?? b.match_score ?? 0), 0) / (candidates.length || 1))}`, icon: Zap, color: 'var(--accent-primary)' },
          { label: 'Shortlist Rate', value: `${Math.round((candidates.filter(c => c.final_decision === 'STRONG_YES' || c.final_decision === 'YES').length / (candidates.length || 1)) * 100)}%`, icon: Target, color: 'var(--success)' },
          { label: 'In Interview', value: candidates.filter(c => c.interview_stage === 'Interview').length, icon: MessageSquare, color: 'var(--info)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: `${s.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={18} color={s.color} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '16px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            <BarChart3 size={13} color="var(--accent-primary)" /> Hiring Funnel
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funnelData.map(d => (
              <div key={d.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px' }}>
                  <span style={{ fontWeight: '600' }}>{d.stage}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{d.count}</span>
                </div>
                <div style={{ height: '24px', background: 'rgba(0,0,0,0.03)', borderRadius: '5px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.count / maxFunnel) * 100}%` }}
                    style={{ height: '100%', background: 'var(--accent-gradient)', opacity: 0.75 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '16px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            <PieChart size={13} color="var(--success)" /> Quality Distribution
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '180px', paddingBottom: '18px', borderBottom: '1px solid var(--border-color)' }}>
            {scoreDist.map(b => (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: b.color }}>{b.count}</div>
                <motion.div initial={{ height: 0 }} animate={{ height: `${(b.count / maxScore) * 130}px` }}
                  style={{ width: '100%', background: b.color, borderRadius: '3px 3px 0 0', minHeight: b.count > 0 ? '3px' : '0' }} />
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {skillCoverage.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} color="#F59E0B" /> Skill Coverage Map
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {skillCoverage.map((s: any) => (
              <div key={s.name} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700' }}>{s.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.count} candidates</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '900', color: s.pct > 70 ? 'var(--success)' : s.pct < 30 ? 'var(--error)' : 'var(--warning)' }}>{s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function JDDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'process' | 'insights'>('process');
  const [candidateView, setCandidateView] = useState<CandidateView>('table');
  const [job, setJob] = useState<JobCampaign | null>(null);
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStage, setBulkStage] = useState('');

  // Stage update (inline)
  const [stageUpdating, setStageUpdating] = useState<string | null>(null);

  const copyPublicLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/jobs/${id}`).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
  };

  const fetchResults = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await jobApi.getResults(id);
      if (res.data.success) {
        setJob(res.data.job);
        setCandidates(res.data.candidates);
        setSummary(res.data.summary);
        const stillRunning = res.data.candidates.some((c: any) => !['COMPLETED', 'FAILED'].includes(c.status));
        if (!stillRunning && isPolling) { setIsPolling(false); setProcessing(false); }
      }
    } catch { } finally { if (!silent) setLoading(false); }
  }, [id, isPolling]);

  useEffect(() => { fetchResults(); }, [id]);
  useEffect(() => {
    if (!isPolling) return;
    const t = setInterval(() => fetchResults(true), 3000);
    return () => clearInterval(t);
  }, [isPolling, fetchResults]);

  const handleEvaluate = async () => {
    setProcessing(true); setIsPolling(true); setProcessError(null);
    pushNotif({ icon: 'info', title: 'Evaluation Started', body: `AI agents evaluating candidates for "${job?.title}".` });
    try {
      await jobApi.processEvaluation(id);
      pushNotif({ icon: 'complete', title: 'Evaluation Complete', body: `All candidates scored for "${job?.title}".` });
    } catch (err: any) {
      setProcessError(err.response?.data?.error || 'Pipeline failed.');
      pushNotif({ icon: 'alert', title: 'Evaluation Failed', body: err.response?.data?.error || 'Check server logs.' });
      setIsPolling(false); setProcessing(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    setUploading(true); setUploadFeedback(null);
    try {
      const res = await jobApi.uploadCandidates(id, files);
      const count = res.data.uploaded?.length || files.length;
      setUploadFeedback(`✓ ${count} CVs uploaded and reading.`);
      pushNotif({ icon: 'upload', title: 'CVs Uploaded', body: `${count} CVs added to "${job?.title}".` });
      await fetchResults(true);
      // Auto-trigger the evaluation so the recruiter sees progress
      handleEvaluate();
    } catch { setUploadFeedback('✗ Upload failed.'); } finally { setUploading(false); }
  };

  const handleStageChange = async (candidateId: string, stage: string) => {
    setStageUpdating(candidateId);
    try {
      await jobApi.updateCandidateStage(candidateId, stage);
      setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, interview_stage: stage as any } : c));
    } catch { alert('Failed to update stage.'); } finally { setStageUpdating(null); }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm('Delete this candidate?')) return;
    try {
      await jobApi.deleteCandidate(candidateId);
      setCandidates(prev => prev.filter(c => c._id !== candidateId));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(candidateId); return next; });
      pushNotif({ icon: 'complete', title: 'Candidate Deleted', body: 'Candidate removed.' });
    } catch { alert('Failed to delete.'); }
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (candidates.every(c => selectedIds.has(c._id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(candidates.map(c => c._id)));
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      if (action === 'reject') {
        await jobApi.bulkAction(Array.from(selectedIds), 'reject');
        setCandidates(prev => prev.map(c => selectedIds.has(c._id) ? { ...c, interview_stage: 'Rejected' as any, final_decision: 'NO' } : c));
        pushNotif({ icon: 'complete', title: 'Bulk Reject', body: `${selectedIds.size} candidates rejected.` });
      } else if (action === 'shortlist') {
        await jobApi.bulkAction(Array.from(selectedIds), 'stage', 'Screening');
        setCandidates(prev => prev.map(c => selectedIds.has(c._id) ? { ...c, interview_stage: 'Screening' as any } : c));
        pushNotif({ icon: 'complete', title: 'Bulk Shortlist', body: `${selectedIds.size} candidates moved to Screening.` });
      } else if (action === 'stage' && bulkStage) {
        await jobApi.bulkAction(Array.from(selectedIds), 'stage', bulkStage);
        setCandidates(prev => prev.map(c => selectedIds.has(c._id) ? { ...c, interview_stage: bulkStage as any } : c));
        pushNotif({ icon: 'complete', title: 'Stage Updated', body: `${selectedIds.size} candidates moved to ${bulkStage}.` });
      }
      setSelectedIds(new Set());
    } catch { alert('Bulk action failed.'); } finally { setBulkLoading(false); }
  };

  const handleGenerateRecommendation = async () => {
    setRecLoading(true);
    try {
      const res = await jobApi.generateRecommendation(id);
      if (res.data.success) { setRecommendation(res.data.recommendation); pushNotif({ icon: 'complete', title: 'AI Recommendation Ready', body: '' }); }
    } catch (e: any) { pushNotif({ icon: 'alert', title: 'Recommendation Failed', body: e.response?.data?.error || 'Need 2+ evaluated candidates.' }); }
    finally { setRecLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '14px' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading campaign…</p>
    </div>
  );

  if (!job) return (
    <div className="empty-state">
      <AlertCircle size={40} className="empty-state-icon" />
      <h3>Campaign Not Found</h3>
      <button className="btn-primary" onClick={() => router.push('/')}><ChevronLeft size={15} /> Back</button>
    </div>
  );

  const st = job.status === 'Completed' ? { label: 'Completed', cls: 'badge-success' } : job.status === 'Evaluating' ? { label: 'Evaluating', cls: 'badge-info' } : { label: job.status || 'Sourcing', cls: 'badge-warning' };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <button className="btn-secondary" style={{ padding: '7px 12px' }} onClick={() => router.push('/')}>
          <ChevronLeft size={15} /> Back
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Dashboard <ChevronRight size={11} style={{ opacity: 0.5 }} /> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{job.title}</span>
        </span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className={`badge ${st.cls}`}>{st.label}</span>
            <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '9px' }}>#{id.slice(-6).toUpperCase()}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={10} />{new Date(job.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '3px' }}>{job.title}</h1>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
            <MapPin size={12} />{job.department}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={copyPublicLink} style={{ fontSize: '12px' }}>
            {linkCopied ? <><CheckCircle2 size={13} color="var(--success)" /> Copied!</> : <><Share2 size={13} /> Share Role</>}
          </button>
          <button className="btn-secondary" onClick={() => fetchResults(true)} style={{ fontSize: '12px' }}><RefreshCw size={13} /> Refresh</button>
          <button className="btn-primary" onClick={handleEvaluate} disabled={processing || candidates.length === 0} style={{ padding: '10px 20px' }}>
            {processing ? <><Loader2 className="animate-spin" size={16} /> Running…</> : <><Sparkles size={16} /> Evaluate All</>}
          </button>
        </div>
      </div>

      {processError && <div className="error-banner" style={{ marginBottom: '16px' }}><AlertCircle size={15} />{processError}</div>}

      {isPolling && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--info-bg)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--info)', fontSize: '12px', marginBottom: '16px' }}>
          <Loader2 className="animate-spin" size={13} /> AI process running… results update every 3s
        </motion.div>
      )}

      {/* 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>

        {/* LEFT */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            {(['process', 'insights'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ padding: '10px 2px', background: 'none', border: 'none', borderBottom: `2.5px solid ${activeTab === t ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                {t === 'process' ? <Filter size={13} /> : <BarChart3 size={13} />}
                {t === 'process' ? 'process' : 'insights'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'process' ? (
              <motion.div key="process" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                {/* Upload zone */}
                <UploadZone onUpload={handleUpload} isUploading={uploading} />

                {uploadFeedback && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ fontSize: '12px', color: uploadFeedback.startsWith('✓') ? 'var(--success)' : 'var(--error)', marginBottom: '14px', fontWeight: '600' }}>
                    {uploadFeedback}
                  </motion.p>
                )}

                {/* Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} color="var(--accent-primary)" />
                    <span style={{ fontWeight: '700', fontSize: '15px' }}>Candidate Process</span>
                    {candidates.length > 0 && <span className="badge badge-accent">{candidates.length}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['table', 'kanban'] as CandidateView[]).map(v => (
                      <button key={v} onClick={() => setCandidateView(v)}
                        style={{ padding: '6px 12px', borderRadius: '7px', border: `1.5px solid ${candidateView === v ? 'var(--accent-primary)' : 'var(--border-color)'}`, background: candidateView === v ? 'var(--accent-soft)' : 'var(--bg-card)', color: candidateView === v ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {v === 'table' ? <TableProperties size={12} /> : <KanbanSquare size={12} />}
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                <AnimatePresence>
                  {selectedIds.size > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }}
                      style={{ padding: '10px 14px', background: 'rgba(232,98,42,0.07)', border: '1px solid rgba(232,98,42,0.2)', borderRadius: 'var(--radius)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '12px', color: 'var(--accent-primary)' }}>{selectedIds.size} selected</span>
                      <div style={{ display: 'flex', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
                        <button onClick={() => handleBulkAction('shortlist')} disabled={bulkLoading} className="btn-secondary" style={{ fontSize: '11px', padding: '5px 12px', color: 'var(--success)', borderColor: 'rgba(5,150,105,.3)', background: 'rgba(5,150,105,.06)' }}>
                          <UserCheck size={12} /> Shortlist
                        </button>
                        <button onClick={() => handleBulkAction('reject')} disabled={bulkLoading} className="btn-secondary" style={{ fontSize: '11px', padding: '5px 12px', color: 'var(--error)', borderColor: 'rgba(220,38,38,.3)', background: 'rgba(220,38,38,.06)' }}>
                          <UserX size={12} /> Reject
                        </button>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
                            style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '7px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer' }}>
                            <option value="">Move to stage…</option>
                            {INTERVIEW_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {bulkStage && (
                            <button onClick={() => handleBulkAction('stage')} disabled={bulkLoading} className="btn-secondary" style={{ fontSize: '11px', padding: '5px 10px' }}>
                              <ArrowRight size={12} /> Apply
                            </button>
                          )}
                        </div>
                      </div>
                      {bulkLoading && <Loader2 size={14} className="animate-spin" color="var(--accent-primary)" />}
                      <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Candidate view */}
                <div className="card" style={{ padding: candidateView === 'kanban' ? '16px' : '0', overflow: 'hidden' }}>
                  {candidateView === 'table' ? (
                    <CandidateTable
                      candidates={candidates}
                      selectedIds={selectedIds}
                      onSelect={toggleSelect}
                      onSelectAll={toggleSelectAll}
                      onDelete={handleDelete}
                      onStageChange={handleStageChange}
                    />
                  ) : (
                    <CandidateKanban candidates={candidates} onStageChange={handleStageChange} />
                  )}
                </div>
              </motion.div>
            ) : (
              <CampaignAnalytics key="insights" candidates={candidates} job={job} />
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* AI Recommendation */}
          <div className="card" style={{ padding: '20px', border: recommendation ? '1.5px solid rgba(232,98,42,0.3)' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '10px', fontWeight: '700', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <Star size={12} /> AI Hiring Recommendation
            </div>
            {recommendation ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ padding: '12px', borderRadius: 'var(--radius)', background: 'rgba(232,98,42,0.04)', border: '1px solid rgba(232,98,42,0.15)', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '3px' }}>RECOMMENDED HIRE</div>
                  <div style={{ fontWeight: '800', fontSize: '15px', fontFamily: 'var(--font-display)' }}>{recommendation.recommended_candidate}</div>
                  <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>{recommendation.headline}</div>
                  {recommendation.recommended_id && (
                    <Link href={`/candidate/${recommendation.recommended_id}`} style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: '600' }}>
                      View Profile <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
                {recommendation.risks?.length > 0 && (
                  <div style={{ marginBottom: '10px', padding: '10px', borderRadius: 'var(--radius)', background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#D97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldAlert size={10} /> Risks</div>
                    <ul style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {recommendation.risks.map((r: string, i: number) => <li key={i} style={{ fontSize: '11px', color: '#92400E', lineHeight: 1.4 }}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={handleGenerateRecommendation} disabled={recLoading} className="btn-ghost" style={{ fontSize: '10px', width: '100%', justifyContent: 'center' }}>
                  <RefreshCw size={10} /> Regenerate
                </button>
              </motion.div>
            ) : (
              <div style={{ textAlign: 'center', paddingBottom: '4px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>Let AI recommend the best candidate with reasons + risks.</p>
                <button className="btn-primary" onClick={handleGenerateRecommendation}
                  disabled={recLoading || candidates.filter(c => c.status === 'COMPLETED').length < 2}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                  {recLoading ? <><Loader2 className="animate-spin" size={14} /> Analyzing…</> : <><BrainCircuit size={14} /> Generate Recommendation</>}
                </button>
                {candidates.filter(c => c.status === 'COMPLETED').length < 2 && (
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>Needs 2+ evaluated candidates.</p>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Campaign Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Total', value: summary.total, color: 'var(--text-primary)' },
                  { label: 'Shortlisted', value: summary.shortlisted, color: 'var(--success)' },
                  { label: 'Borderline', value: summary.maybes, color: 'var(--warning)' },
                  { label: 'Declined', value: summary.rejected, color: 'var(--error)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(0,0,0,0.025)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Must-have skills */}
          {((job.jd_analysis?.must_have_skills?.length ?? 0) > 0) && (
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Must-Have Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {job.jd_analysis?.must_have_skills?.slice(0, 12).map((s: string, i: number) => (
                  <span key={i} className="tag tag-warn" style={{ fontSize: '10px' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* JD Mini */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={11} /> Job Description
            </div>
            <div style={{ fontSize: '11px', lineHeight: 1.6, color: 'var(--text-secondary)', maxHeight: '180px', overflowY: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{job.generated_jd}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
