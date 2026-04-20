'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, User, Briefcase, Award, MessageSquare, Zap, UserCheck,
  CheckCircle2, Loader2, Save, Tag, X, FileText, AlertCircle, Clock,
  Send, Brain, XCircle, ChevronDown, ChevronUp, RefreshCw, Mail, Phone,
  MapPin, ExternalLink, ShieldAlert, Share2, Code, Edit2, Check,
  Activity, Calendar, Star, BarChart2, Target, Plus, ChevronRight,
  TrendingUp, Users, ArrowRight
} from 'lucide-react';
import { jobApi, API_HOST } from '@/lib/api';
import { JobCandidate, JobCampaign } from '@/types';

// ── Shared helpers ─────────────────────────────────────────────
const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Applied:   { bg: 'rgba(107,114,128,.08)', text: '#6B7280', border: 'rgba(107,114,128,.2)' },
  Screening: { bg: 'rgba(37,99,235,.08)',   text: '#2563EB', border: 'rgba(37,99,235,.2)' },
  Interview: { bg: 'rgba(124,58,237,.08)',  text: '#7C3AED', border: 'rgba(124,58,237,.2)' },
  Offer:     { bg: 'rgba(5,150,105,.08)',   text: '#059669', border: 'rgba(5,150,105,.2)' },
  Hired:     { bg: 'rgba(16,185,129,.12)',  text: '#059669', border: 'rgba(16,185,129,.3)' },
  Rejected:  { bg: 'rgba(220,38,38,.08)',   text: '#DC2626', border: 'rgba(220,38,38,.2)' },
};

const DECISION_META: Record<string, { label: string; color: string; bg: string }> = {
  STRONG_YES: { label: 'Strong Yes ✦', color: '#059669', bg: 'rgba(5,150,105,.1)' },
  YES:        { label: 'Yes',           color: '#0D9488', bg: 'rgba(13,148,136,.1)' },
  MAYBE:      { label: 'Maybe',         color: '#D97706', bg: 'rgba(217,119,6,.1)' },
  NO:         { label: 'No',            color: '#DC2626', bg: 'rgba(220,38,38,.1)' },
  PENDING:    { label: 'Pending',       color: '#6B7280', bg: 'rgba(107,114,128,.1)' },
};

const scoreColor = (s: number) => s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#DC2626';

const cleanFileName = (f: string) => {
  if (!f) return 'Candidate';
  return f.replace(/\.[^/.]+$/, '').replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, '').replace(/ \(\d+\)/g, '').replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, '').replace(/[_\-]+/g, ' ').replace(/\s\s+/g, ' ').trim() || 'Candidate';
};

const fmt = (d: string | Date) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Score Ring ─────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: '900', fontSize: size > 60 ? '18px' : '14px', color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: '600' }}>SCORE</span>
      </div>
    </div>
  );
}

// ── Resume Viewer ──────────────────────────────────────────────
function ResumeViewer({ url, candidateId, name }: { url: string; candidateId: string; name?: string }) {
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    jobApi.getSignedResumeUrl(candidateId)
      .then(r => { if (r.data.success) setSignedUrl(r.data.signedUrl); else setSignedUrl(url.startsWith('http') ? url : `${API_HOST}${url}`); })
      .catch(() => setSignedUrl(url.startsWith('http') ? url : `${API_HOST}${url}`))
      .finally(() => setLoading(false));
  }, [url, candidateId]);

  const isImage = signedUrl && ['png', 'jpg', 'jpeg'].some(ext => signedUrl.toLowerCase().split('?')[0].endsWith(`.${ext}`));
  const isPDF = signedUrl && signedUrl.toLowerCase().split('?')[0].endsWith('.pdf');

  if (!url) return (
    <div style={{ height: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
      <FileText size={40} color="var(--text-muted)" strokeWidth={1} />
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Resume not available</p>
    </div>
  );

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', height: '480px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={13} color="var(--accent-primary)" />
          <span style={{ fontSize: '11px', fontWeight: '700', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Resume'}</span>
        </div>
        {!loading && signedUrl && <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>Open <ExternalLink size={10} /></a>}
      </div>
      <div style={{ flex: 1, background: '#F8FAF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <Loader2 size={22} className="animate-spin" color="var(--accent-primary)" />
        ) : isImage ? (
          <img src={signedUrl} alt="Resume" style={{ maxWidth: '100%', height: '100%', objectFit: 'contain', padding: '16px' }} />
        ) : isPDF ? (
          <iframe src={signedUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Resume" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <FileText size={32} color="var(--text-muted)" />
            <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '11px' }}>Download Resume</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comment Feed ───────────────────────────────────────────────
function CommentFeed({ candidateId }: { candidateId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    jobApi.getComments(candidateId).then(r => { setComments(r.data.comments || []); setLoaded(true); }).catch(() => setLoaded(true));
  }, [candidateId]);

  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      const r = await jobApi.postComment(candidateId, body);
      setComments(prev => [...prev, r.data.comment]);
      setBody('');
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch { alert('Failed to post.'); } finally { setPosting(false); }
  };

  return (
    <div>
      {!loaded ? <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 size={16} className="animate-spin" color="var(--accent-primary)" /></div> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px', maxHeight: '260px', overflowY: 'auto' }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>No comments yet.</div>
            ) : comments.map((c, i) => (
              <div key={c._id || i} style={{ padding: '10px 12px', borderRadius: '9px', background: 'rgba(0,0,0,0.025)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700' }}>{c.author}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmt(c.createdAt)}</span>
                </div>
                <p style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--text-secondary)', margin: 0 }}>{c.body}</p>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea className="input" rows={2} value={body} onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
              placeholder="Add team comment… (Enter to post)"
              style={{ fontSize: '12px', resize: 'none', lineHeight: 1.4, flex: 1 }} />
            <button className="btn-primary" onClick={post} disabled={posting || !body.trim()} style={{ padding: '8px 12px', alignSelf: 'flex-end' }}>
              {posting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Interview Round Card ───────────────────────────────────────
function InterviewRoundCard({ round, candidateId, onFeedbackSubmit }: { round: any; candidateId: string; onFeedbackSubmit: () => void }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [fb, setFb] = useState({ rating: 3, strengths: '', concerns: '', decision: 'Hold', interviewerName: '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await jobApi.submitFeedback(candidateId, round._id, fb);
      onFeedbackSubmit();
      setShowFeedback(false);
    } catch { alert('Failed to submit.'); } finally { setSubmitting(false); }
  };

  const avgRating = round.feedback?.length ? (round.feedback.reduce((s: number, f: any) => s + (f.rating || 0), 0) / round.feedback.length).toFixed(1) : null;

  return (
    <div style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: round.status === 'Completed' ? 'rgba(5,150,105,0.03)' : 'var(--bg-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '13px' }}>{round.title || round.type}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {round.interviewer?.name && <span><User style={{ display: 'inline', marginRight: '3px' }} size={10} />{round.interviewer.name}</span>}
            {round.scheduledAt && <span><Calendar style={{ display: 'inline', marginRight: '3px' }} size={10} />{new Date(round.scheduledAt).toLocaleDateString()}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {avgRating && <span style={{ fontSize: '12px', fontWeight: '700', color: '#D97706' }}>⭐ {avgRating}</span>}
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: round.status === 'Completed' ? 'rgba(5,150,105,.1)' : 'rgba(37,99,235,.1)', color: round.status === 'Completed' ? 'var(--success)' : 'var(--info)' }}>
            {round.status}
          </span>
        </div>
      </div>

      {round.feedback?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
          {round.feedback.map((f: any, i: number) => (
            <div key={i} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: '7px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontWeight: '700' }}>{f.interviewerName || 'Interviewer'}</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ color: '#D97706' }}>{'★'.repeat(f.rating || 0)}</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '20px', background: f.decision === 'Hire' ? 'rgba(5,150,105,.1)' : f.decision === 'No Hire' ? 'rgba(220,38,38,.1)' : 'rgba(107,114,128,.1)', color: f.decision === 'Hire' ? 'var(--success)' : f.decision === 'No Hire' ? 'var(--error)' : 'var(--text-muted)' }}>{f.decision}</span>
                </div>
              </div>
              {f.strengths && <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{f.strengths}</p>}
            </div>
          ))}
        </div>
      )}

      {round.status !== 'Completed' && (
        <button onClick={() => setShowFeedback(!showFeedback)} className="btn-secondary" style={{ fontSize: '10px', padding: '4px 10px' }}>
          {showFeedback ? <><X size={10} /> Cancel</> : <><Plus size={10} /> Submit Feedback</>}
        </button>
      )}

      <AnimatePresence>
        {showFeedback && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '9px' }}>
              <input className="input" placeholder="Your name" value={fb.interviewerName} onChange={e => setFb(p => ({ ...p, interviewerName: e.target.value }))} style={{ fontSize: '12px' }} />
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>Rating:</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setFb(p => ({ ...p, rating: n }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: n <= fb.rating ? '#D97706' : 'var(--text-muted)', padding: '0' }}>★</button>
                ))}
              </div>
              <textarea className="input" rows={2} placeholder="Strengths observed…" value={fb.strengths} onChange={e => setFb(p => ({ ...p, strengths: e.target.value }))} style={{ fontSize: '12px', resize: 'none' }} />
              <textarea className="input" rows={2} placeholder="Concerns / gaps…" value={fb.concerns} onChange={e => setFb(p => ({ ...p, concerns: e.target.value }))} style={{ fontSize: '12px', resize: 'none' }} />
              <select className="input" value={fb.decision} onChange={e => setFb(p => ({ ...p, decision: e.target.value }))} style={{ fontSize: '12px' }}>
                <option value="Hire">Hire</option>
                <option value="No Hire">No Hire</option>
                <option value="Hold">Hold</option>
              </select>
              <button className="btn-primary" onClick={submit} disabled={submitting || !fb.strengths.trim()} style={{ fontSize: '12px', justifyContent: 'center' }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : 'Submit Feedback'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Add Interview Round Form ───────────────────────────────────
function AddInterviewForm({ candidateId, onAdded }: { candidateId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'Technical', title: '', interviewerName: '', scheduledAt: '' });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await jobApi.addInterviewRound(candidateId, form);
      setOpen(false);
      setForm({ type: 'Technical', title: '', interviewerName: '', scheduledAt: '' });
      onAdded();
    } catch { alert('Failed to add round.'); } finally { setLoading(false); }
  };

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>
        <Plus size={12} /> {open ? 'Cancel' : 'Add Interview Round'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ fontSize: '12px' }}>
                  {['Technical', 'HR', 'System Design', 'Behavioral', 'Hiring Manager', 'Culture Fit'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input" placeholder="Round title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ fontSize: '12px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input className="input" placeholder="Interviewer name" value={form.interviewerName} onChange={e => setForm(p => ({ ...p, interviewerName: e.target.value }))} style={{ fontSize: '12px' }} />
                <input className="input" type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} style={{ fontSize: '12px' }} />
              </div>
              <button className="btn-primary" onClick={submit} disabled={loading} style={{ justifyContent: 'center', fontSize: '12px' }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : 'Schedule Round'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────
function TimelineView({ candidateId }: { candidateId: string }) {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobApi.getTimeline(candidateId)
      .then(r => { if (r.data.success) setTimeline(r.data.timeline); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidateId]);

  const icons: Record<string, React.ReactNode> = {
    'Application Received': <Plus size={13} />,
    'Stage Changed': <ArrowRight size={13} />,
    'Interview Scheduled': <Calendar size={13} />,
    'Feedback Added': <MessageSquare size={13} />,
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '24px' }}><Loader2 size={18} className="animate-spin" color="var(--accent-primary)" /></div>;

  if (!timeline.length) return (
    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
      <Activity size={24} style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
      No timeline events yet.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
      {timeline.map((event, i) => (
        <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative', paddingBottom: i < timeline.length - 1 ? '20px' : '0' }}>
          {/* Line */}
          {i < timeline.length - 1 && (
            <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: 0, width: '1px', background: 'var(--border-color)' }} />
          )}
          {/* Icon */}
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-soft)', border: '2px solid rgba(232,98,42,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent-primary)', zIndex: 1 }}>
            {icons[event.event] || <Activity size={13} />}
          </div>
          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{event.event}</div>
            {event.details && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{event.details}</div>}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{fmt(event.date)}{event.user && event.user !== 'System' ? ` · ${event.user}` : ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN PROFILE PAGE ──────────────────────────────────────────
type TabKey = 'overview' | 'applications' | 'evaluation' | 'timeline' | 'scorecard';

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<JobCandidate | null>(null);
  const [campaign, setCampaign] = useState<JobCampaign | null>(null);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [interviewsKey, setInterviewsKey] = useState(0); // force re-fetch

  const loadProfile = useCallback(async () => {
    try {
      const res = await jobApi.getCandidate(id);
      if (res.data.success) {
        setCandidate(res.data.candidate);
        setCampaign(res.data.campaign);
        setAllApplications(res.data.allApplications || []);
        setNotes(res.data.candidate.notes || '');
        setTags(res.data.candidate.tags || []);
        const pd = res.data.candidate.parsed_data || {};
        setEditableName(pd.full_name || cleanFileName(res.data.candidate.fileName));
      }
    } catch { } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const saveNotes = async () => {
    setSaving(true);
    try { await jobApi.updateCandidateNotes(id, notes, tags); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch { alert('Failed to save.'); } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editableName.trim()) return;
    setRenaming(true);
    try {
      await jobApi.renameCandidate(id, editableName.trim());
      setCandidate(prev => prev ? { ...prev, full_name: editableName.trim() } : null);
      setIsEditingName(false);
    } catch { alert('Failed to rename.'); } finally { setRenaming(false); }
  };

  const handleStageUpdate = async (stage: string) => {
    setStageUpdating(true);
    setUpdatingStage(stage);
    try {
      await jobApi.updateCandidateStage(id, stage);
      // Reload everything to get the latest decision, timeline, etc.
      await loadProfile();
    } catch { alert('Failed to update stage.'); } finally { 
      setStageUpdating(false); 
      setUpdatingStage(null);
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const t = tagInput.trim();
      if (!tags.includes(t)) setTags(prev => [...prev, t]);
      setTagInput('');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
      <Loader2 className="animate-spin" size={28} color="var(--accent-primary)" />
    </div>
  );

  if (!candidate) return (
    <div className="empty-state">
      <AlertCircle size={36} className="empty-state-icon" />
      <h3>Candidate not found</h3>
      <button className="btn-primary" onClick={() => router.back()}><ChevronLeft size={14} /> Go back</button>
    </div>
  );

  const pd = candidate.parsed_data || {};
  const name = pd.full_name || candidate.full_name || cleanFileName(candidate.fileName || '');
  const score = candidate.final_score ?? candidate.match_score;
  const dec = DECISION_META[candidate.final_decision || 'PENDING'];
  const curStage = candidate.interview_stage || 'Applied';
  const ss = STAGE_STYLES[curStage] || STAGE_STYLES['Applied'];
  const interviews = (candidate as any).interviews || [];

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview',     label: 'Overview',     icon: <User size={13} /> },
    { key: 'evaluation',   label: 'AI Evaluation', icon: <Zap size={13} /> },
    { key: 'applications', label: 'Applications',  icon: <Briefcase size={13} /> },
    { key: 'timeline',     label: 'Timeline',      icon: <Activity size={13} /> },
    { key: 'scorecard',    label: 'Scorecard',     icon: <BarChart2 size={13} /> },
  ];

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto', paddingBottom: '100px' }}>

      {/* Sticky Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(253,248,244,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-color)', margin: '0 -24px 28px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', maxWidth: '1320px', margin: '0 auto' }}>
          {/* Left: back + identity */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button className="btn-secondary" style={{ padding: '7px 10px', flexShrink: 0 }} onClick={() => router.back()}>
              <ChevronLeft size={15} />
            </button>
            <motion.div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: 'white', flexShrink: 0 }}>
              {name.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input autoFocus className="input" style={{ fontSize: '16px', fontWeight: '700', padding: '4px 8px', width: '200px', height: '32px' }} value={editableName} onChange={e => setEditableName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} />
                  <button onClick={handleRename} disabled={renaming} className="btn-primary" style={{ padding: '4px 8px', height: '32px' }}>{renaming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}</button>
                  <button onClick={() => setIsEditingName(false)} className="btn-ghost" style={{ padding: '4px', height: '32px' }}><X size={13} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '800', fontSize: '17px', fontFamily: 'var(--font-display)' }}>{name}</span>
                  <button onClick={() => setIsEditingName(true)} className="btn-ghost" style={{ padding: '3px', opacity: 0.4 }}><Edit2 size={13} /></button>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                {pd.current_title && <span style={{ fontWeight: '600' }}>{pd.current_title}</span>}
                {campaign && <span>· Applied: <Link href={`/jd/${campaign._id}`} style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>{campaign.title}</Link></span>}
              </div>
            </div>
          </div>

          {/* Right: score + stage */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {score != null && <ScoreRing score={score} size={56} />}
            <div>
              <div style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Stage</div>
              <select
                value={curStage}
                onChange={e => handleStageUpdate(e.target.value)}
                disabled={stageUpdating}
                style={{ fontSize: '12px', fontWeight: '700', padding: '5px 10px', borderRadius: '20px', border: `1.5px solid ${ss.border}`, background: ss.bg, color: ss.text, cursor: 'pointer', outline: 'none' }}
              >
                {['Applied','Screening','Interview','Offer','Hired','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {candidate.final_decision && (
              <div style={{ padding: '6px 12px', borderRadius: '20px', background: dec.bg, fontSize: '11px', fontWeight: '700', color: dec.color, border: `1px solid ${dec.color}20` }}>
                {dec.label}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2.5px solid ${activeTab === t.key ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── TAB: OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ResumeViewer url={candidate.resume_url} candidateId={id} name={candidate.fileName} />

              {/* Contact */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '14px' }}>Contact</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { icon: Mail, label: 'EMAIL', value: pd.email, href: `mailto:${pd.email}`, color: 'var(--accent-primary)' },
                    { icon: Phone, label: 'PHONE', value: pd.phone, href: `tel:${pd.phone}`, color: '#0D9488' },
                    { icon: MapPin, label: 'LOCATION', value: pd.location, color: '#D97706' },
                  ].map(({ icon: Icon, label, value, href, color }) => (
                    <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} color={color} />
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>{label}</div>
                        {href ? (
                          <a href={href} style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none' }}>{value || 'Not provided'}</a>
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>{value || 'Not provided'}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(pd.social_links?.linkedin || pd.social_links?.github) && (
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      {pd.social_links.linkedin && <a href={pd.social_links.linkedin} target="_blank" rel="noreferrer" className="btn-secondary" style={{ flex: 1, padding: '7px', justifyContent: 'center', fontSize: '11px' }}><Share2 size={12} /> LinkedIn</a>}
                      {pd.social_links.github && <a href={pd.social_links.github} target="_blank" rel="noreferrer" className="btn-secondary" style={{ flex: 1, padding: '7px', justifyContent: 'center', fontSize: '11px' }}><Code size={12} /> GitHub</a>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Summary */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Professional Summary</div>
                <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)' }}>{pd.work_summary || 'No summary available.'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
                  {[
                    { label: 'EXPERIENCE', value: pd.experience_years == null ? '—' : pd.experience_years === 0 || pd.is_fresher ? 'Entry' : `${pd.experience_years}y+` },
                    { label: 'CONFIDENCE', value: `${pd.confidence_score || 0}%` },
                    { label: 'RANK', value: `#${candidate.rank || '—'}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.025)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: '900', fontFamily: 'var(--font-display)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Validated Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(candidate.validated_skills?.top_skills || []).map((sk: any, i: number) => {
                    const sn = typeof sk === 'string' ? sk : sk.name;
                    const required = campaign?.jd_analysis?.must_have_skills || campaign?.jd_analysis?.required_skills || [];
                    const isMatch = required.some((r: any) => (typeof r === 'string' ? r : r.name || '').toLowerCase().includes(sn.toLowerCase()));
                    return (
                      <span key={i} style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: isMatch ? 'rgba(5,150,105,.1)' : 'rgba(0,0,0,0.04)', color: isMatch ? 'var(--success)' : 'var(--text-primary)', border: `1.5px solid ${isMatch ? 'rgba(5,150,105,.3)' : 'transparent'}` }}>
                        {isMatch && '★ '}{sn}
                      </span>
                    );
                  })}
                </div>
                {(candidate.validated_skills?.missing_skills?.length ?? 0) > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--error)', fontWeight: '700', marginBottom: '6px' }}>GAPS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {candidate.validated_skills?.missing_skills?.map((s: string, i: number) => (
                        <span key={i} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: 'rgba(220,38,38,.08)', color: 'var(--error)', border: '1px solid rgba(220,38,38,.2)' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Recruiter Notes & Tags</div>
                <textarea className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Your notes…" style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '10px' }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {tags.map(t => (
                    <span key={t} className="badge badge-accent" style={{ cursor: 'pointer', fontSize: '10px' }} onClick={() => setTags(p => p.filter(x => x !== t))}>{t} <X size={9} /></span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input" style={{ flex: 1, fontSize: '12px' }} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Add tag (Enter)…" />
                  <button className="btn-primary" onClick={saveNotes} disabled={saving} style={{ padding: '8px 14px' }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: AI EVALUATION ─────────────────────────────────────── */}
        {activeTab === 'evaluation' && (
          <motion.div key="evaluation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '12px', display: 'flex', gap: '6px' }}><MessageSquare size={12} /> AI Debate Synthesis</div>
                <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '12px', background: 'rgba(232,98,42,0.03)', borderRadius: '9px', border: '1px solid rgba(232,98,42,0.1)' }}>
                  "{candidate.debate_summary || 'Evaluation pending…'}"
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '14px' }}>
                  {[
                    { label: 'Agent 5', value: candidate.match_score ?? '—', color: 'var(--info)' },
                    { label: 'Corrected', value: candidate.corrected_score ?? '—', color: 'var(--accent-primary)' },
                    { label: 'Final', value: score ?? '—', color: score ? scoreColor(score) : 'var(--text-muted)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.025)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '3px' }}>{s.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '12px', display: 'flex', gap: '6px' }}><UserCheck size={12} /> HR Final Note</div>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{candidate.hr_note || 'Awaiting HR synthesis…'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(candidate.match_results?.strengths?.length ?? 0) > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '12px' }}>Strengths</div>
                  <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {candidate.match_results?.strengths?.map((s: string, i: number) => (
                      <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(candidate.match_results?.weaknesses?.length ?? 0) > 0 && (
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '12px' }}>Concerns</div>
                  <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {candidate.match_results?.weaknesses?.map((s: string, i: number) => (
                      <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '12px', display: 'flex', gap: '6px' }}><Brain size={12} /> AI Interview Questions</div>
                {candidate.interview_questions ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {candidate.interview_questions.categories?.map((cat: any, i: number) => (
                      <div key={i}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>{cat.name}</div>
                        <ul style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {cat.questions?.map((q: string, j: number) => <li key={j} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{q}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => jobApi.generateInterviewQuestions(id).then(r => { if (r.data.success) setCandidate(p => p ? { ...p, interview_questions: r.data.questions } : p); })} className="btn-secondary" style={{ fontSize: '11px', padding: '7px 14px' }}>
                    <Brain size={11} /> Generate Questions
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: APPLICATIONS ─────────────────────────────────────── */}
        {activeTab === 'applications' && (
          <motion.div key="applications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              {allApplications.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Briefcase size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
                  No application history found.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
                      {['Role', 'Department', 'Stage', 'Score', 'Decision', 'Applied', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allApplications.map((app: any, i: number) => {
                      const sc = STAGE_STYLES[app.stage] || STAGE_STYLES['Applied'];
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '700' }}>{app.jobTitle || app.campaignTitle}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{app.department || '—'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{app.stage}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: '800', color: app.score ? scoreColor(app.score) : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{app.score || '—'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {app.final_decision ? (
                              <span style={{ fontSize: '10px', fontWeight: '700', color: DECISION_META[app.final_decision]?.color || '#9CA3AF' }}>{app.final_decision.replace('_', ' ')}</span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>{fmt(app.createdAt)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {app.jobId && <Link href={`/jd/${app.jobId}`} style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>View <ExternalLink size={10} /></Link>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Interview Rounds */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="var(--accent-primary)" /> Interview Rounds
                </h3>
                <AddInterviewForm candidateId={id} onAdded={() => { loadProfile(); setInterviewsKey(k => k + 1); }} />
              </div>
              {interviews.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1.5px dashed var(--border-color)', borderRadius: 'var(--radius)' }}>
                  No interview rounds scheduled yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {interviews.map((round: any, i: number) => (
                    <InterviewRoundCard key={round._id || i} round={round} candidateId={id} onFeedbackSubmit={() => { loadProfile(); }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── TAB: TIMELINE ─────────────────────────────────────────── */}
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px', display: 'flex', gap: '7px', alignItems: 'center' }}>
                  <Activity size={13} /> Activity Timeline
                </div>
                <TimelineView candidateId={id} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>Team Comments</div>
                  <CommentFeed candidateId={id} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: SCORECARD ─────────────────────────────────────────── */}
        {activeTab === 'scorecard' && (
          <motion.div key="scorecard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Score summary */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px' }}>Score Summary</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  {score != null && <ScoreRing score={score} size={120} />}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
                  {[
                    { label: 'AI Score', value: score ?? '—', color: score ? scoreColor(score) : 'var(--text-muted)' },
                    { label: 'AI Decision', value: (DECISION_META[candidate.final_decision || 'PENDING']?.label || '—'), color: DECISION_META[candidate.final_decision || 'PENDING']?.color || 'var(--text-muted)' },
                    { label: 'Current Stage', value: curStage, color: ss.text },
                    { label: 'Interviews Done', value: interviews.filter((i: any) => i.status === 'Completed').length, color: 'var(--text-primary)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.025)', borderRadius: '9px', padding: '12px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Interview aggregate */}
                {interviews.length > 0 && (() => {
                  const withFb = interviews.filter((r: any) => r.feedback?.length > 0);
                  const avgRating = withFb.length ? (withFb.reduce((sum: number, r: any) => sum + (r.feedback[0]?.rating || 0), 0) / withFb.length).toFixed(1) : null;
                  const hireVotes = interviews.reduce((s: number, r: any) => s + (r.feedback?.filter((f: any) => f.decision === 'Hire').length || 0), 0);
                  const noHireVotes = interviews.reduce((s: number, r: any) => s + (r.feedback?.filter((f: any) => f.decision === 'No Hire').length || 0), 0);
                  return (
                    <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(0,0,0,0.025)', borderRadius: '9px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Interview Aggregate</div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {avgRating && <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>AVG RATING</div><div style={{ fontSize: '18px', fontWeight: '900', color: '#D97706' }}>⭐ {avgRating}</div></div>}
                        <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>HIRE VOTES</div><div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--success)' }}>{hireVotes}</div></div>
                        <div><div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>NO HIRE</div><div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--error)' }}>{noHireVotes}</div></div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '20px' }}>Final Decision</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { stage: 'Offer', label: 'Move to Offer', color: 'var(--success)', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.25)' },
                    { stage: 'Hired', label: 'Mark as Hired', color: '#059669', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
                    { stage: 'Screening', label: 'Move to Screening', color: 'var(--info)', bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.2)' },
                    { stage: 'Rejected', label: 'Reject Candidate', color: 'var(--error)', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.2)' },
                  ].map(a => (
                    <motion.button key={a.stage} whileHover={{ x: 3 }} onClick={() => handleStageUpdate(a.stage)}
                      disabled={stageUpdating || curStage === a.stage}
                      style={{ padding: '12px 16px', borderRadius: '10px', textAlign: 'left', border: `1.5px solid ${curStage === a.stage ? a.border : 'var(--border-color)'}`, background: curStage === a.stage ? a.bg : 'var(--bg-card)', color: curStage === a.stage ? a.color : 'var(--text-primary)', fontSize: '13px', fontWeight: '700', cursor: curStage === a.stage ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {a.label}
                      {curStage === a.stage ? <CheckCircle2 size={15} /> : <ChevronRight size={15} color="var(--text-muted)" />}
                    </motion.button>
                  ))}
                </div>
                <div className="divider" style={{ margin: '16px 0' }} />
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>Notes</div>
                <textarea className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Decision notes…" style={{ fontSize: '12px', marginBottom: '8px' }} />
                <button className="btn-primary" onClick={saveNotes} disabled={saving} style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save Notes</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Action Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-width)', right: 0, background: 'rgba(253,248,244,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-color)', padding: '12px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 30, gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {score != null && <ScoreRing score={score} size={40} />}
          <div>
            <div style={{ fontWeight: '700', fontSize: '13px' }}>{name}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{curStage} · {candidate.final_decision || 'Pending'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => handleStageUpdate('Screening')} disabled={stageUpdating || curStage === 'Screening'} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
            {updatingStage === 'Screening' ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Shortlist
          </button>
          <button onClick={() => handleStageUpdate('Interview')} disabled={stageUpdating || curStage === 'Interview'} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px' }}>
            {updatingStage === 'Interview' ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />} To Interview
          </button>
          <button onClick={() => handleStageUpdate('Offer')} disabled={stageUpdating || curStage === 'Offer'} className="btn-primary" style={{ fontSize: '12px', padding: '8px 18px' }}>
            {updatingStage === 'Offer' ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />} Move to Offer
          </button>
          <button onClick={() => handleStageUpdate('Rejected')} disabled={stageUpdating || curStage === 'Rejected'} className="btn-secondary" style={{ fontSize: '12px', padding: '8px 14px', color: 'var(--error)', borderColor: 'rgba(220,38,38,.25)' }}>
            {updatingStage === 'Rejected' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}
