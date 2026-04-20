'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, ChevronRight, Clock, Plus, Search,
  TrendingUp, CheckCircle2, Flame, Users, BarChart2,
  Trash2, KanbanSquare, LayoutGrid, ArrowRight, X,
  ChevronDown, AlertTriangle, Bell, Activity, UserCheck,
  RefreshCw, Eye, UserPlus, Zap, TableProperties
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { JobCampaign } from '@/types';

const KANBAN_STAGES = ['Sourcing', 'Screening', 'Interview', 'Offer', 'Hired'] as const;

// Helper to format dates safely, returns placeholder for invalid dates
const fmtDate = (d: string | Date) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
type KStage = typeof KANBAN_STAGES[number];

const STAGE_COLORS: Record<KStage, { bg: string; text: string; border: string }> = {
  Sourcing:  { bg: 'rgba(245,158,11,0.07)',  text: '#D97706', border: 'rgba(245,158,11,0.2)' },
  Screening: { bg: 'rgba(37,99,235,0.07)',   text: '#2563EB', border: 'rgba(37,99,235,0.2)' },
  Interview: { bg: 'rgba(124,58,237,0.07)',  text: '#7C3AED', border: 'rgba(124,58,237,0.2)' },
  Offer:     { bg: 'rgba(5,150,105,0.07)',   text: '#059669', border: 'rgba(5,150,105,0.2)' },
  Hired:     { bg: 'rgba(16,185,129,0.12)',  text: '#059669', border: 'rgba(16,185,129,0.3)' },
};

type ViewMode = 'grid' | 'kanban';

interface AlertData {
  stuckCandidates: Array<{ _id: string; name: string; campaignTitle: string; interview_stage: string; updatedAt: string; campaignId: string }>;
  inactiveCampaigns: Array<{ _id: string; title: string; department: string; kanban_stage: string }>;
  emptyCampaigns: Array<{ _id: string; title: string; department: string }>;
  total: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<JobCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [view, setView] = useState<ViewMode | 'table'>('table');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ id: string; current: string } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);

  useEffect(() => { fetchCampaigns(); fetchAlerts(); }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await jobApi.getAll();
      if (res.data.success) setCampaigns(res.data.campaigns);
    } catch { } finally { setLoading(false); }
  };

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await jobApi.getDashboardAlerts();
      if (res.data.success && res.data.alerts.total > 0) setAlerts(res.data.alerts);
    } catch { } finally { setAlertsLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Delete this campaign and all its candidates? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await jobApi.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } catch { alert('Failed to delete.'); } finally { setDeleting(null); }
  };

  const moveToStage = async (id: string, stage: string) => {
    setMovingId(id);
    try {
      await jobApi.updateCampaignStage(id, stage);
      setCampaigns(prev => prev.map(c => c._id === id ? { ...c, kanban_stage: stage as KStage } : c));
    } catch { alert('Failed to move.'); } finally { setMovingId(null); setMoveModal(null); }
  };

  const allStages = ['All', ...KANBAN_STAGES];

  const filtered = campaigns.filter(c => {
    const matchQ = c.title?.toLowerCase().includes(query.toLowerCase()) || 
                  c.department?.toLowerCase().includes(query.toLowerCase());
    const matchS = filterStage === 'All' || (c.kanban_stage || 'Sourcing') === filterStage;
    return matchQ && matchS;
  });

  const activeJobs = filtered.filter(c => (c.kanban_stage || 'Sourcing') !== 'Hired');
  const closedJobs = filtered.filter(c => (c.kanban_stage || 'Sourcing') === 'Hired');
  
  // Dashboard Metrics logic
  const activeCount = campaigns.filter(c => (c.kanban_stage || 'Sourcing') !== 'Hired').length;
  const processCount = campaigns.reduce((s, c) => s + (c.candidateCount || 0), 0) - campaigns.reduce((s, c) => s + (c.hiredCount || 0), 0);
  const interviewsThisWeek = campaigns.reduce((s, c) => {
    // Aggregating 'Interview' stage across all active roles
    return s + (c.stageCounts?.['Interview'] || c.stageCounts?.['Technical Round 1'] || 0);
  }, 0);
  const pendingOffers = campaigns.reduce((s, c) => s + (c.stageCounts?.['Offer'] || 0), 0);


  const STAGE_MAP: Record<string, string> = {
    'Applied': 'Applied',
    'Resume Screening': 'Screening',
    'Recruiter Call': 'Screening',
    'Technical Round 1': 'Interview',
    'Technical Round 2': 'Interview',
    'Hiring Manager': 'Interview',
    'HR Round': 'Interview',
    'Offer': 'Offer',
    'Hired': 'Hired'
  };

  /* ── Funnel Bar ── */
  const FunnelBar = ({ stages = {} }: { stages?: Record<string, number> }) => {
    const funnelSteps = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    
    // Map granular stages to high-level buckets
    const bucketed: Record<string, number> = { Applied:0, Screening:0, Interview:0, Offer:0, Hired:0 };
    Object.entries(stages).forEach(([s, count]) => {
      const bucket = STAGE_MAP[s] || s;
      if (bucketed[bucket] !== undefined) bucketed[bucket] += count;
    });

    const maxVal = Math.max(...Object.values(bucketed), 1);
    
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px', padding: '0 4px' }}>
        {funnelSteps.map((step, i) => {
          const count = bucketed[step] || 0;
          const height = Math.max((count / maxVal) * 100, 10);
          return (
            <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '2px' }}>
              <div style={{ 
                width: '100%', 
                height: `${height}%`, 
                background: i === 4 ? 'var(--success)' : i === 3 ? 'var(--accent-primary)' : 'var(--info)', 
                borderRadius: '1.5px',
                opacity: 0.8 + (i * 0.05) 
              }} />
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div style={{ position: 'relative' }}>
      {/* ── Top Metrics Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Active Roles', value: activeCount, icon: Flame, color: '#D97706' },
          { label: 'Process Candidates', value: processCount, icon: Users, color: 'var(--info)' },
          { label: 'Interviews This Week', value: interviewsThisWeek, icon: Activity, color: 'var(--accent-purple)' },
          { label: 'Offers Pending', value: pendingOffers, icon: UserCheck, color: 'var(--success)' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1.1 }}>{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        
        {/* ── LEFT COLUMN: MAIN WORKFLOW ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 🔥 ACTION PANEL (Needs Attention) */}
          <AnimatePresence>
            {alerts && alerts.total > 0 && showAlerts && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                <div style={{ background: 'var(--error-bg)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={15} color="var(--error)" />
                      <span style={{ fontWeight: '800', fontSize: '12px', color: 'var(--error)', textTransform: 'uppercase' }}>Requires Immediate Action ({alerts.total})</span>
                    </div>
                    <button onClick={() => setShowAlerts(false)} className="btn-ghost" style={{ padding: '4px' }}><X size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {alerts.stuckCandidates.map(c => (
                      <div key={c._id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'white' }}>
                        <Clock size={14} color="var(--error)" />
                        <span style={{ fontSize: '12px', flex: 1 }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong> stuck in {c.interview_stage} stage for {Math.ceil((Date.now() - new Date(c.updatedAt).getTime()) / 86400000)} days.
                        </span>
                        <Link href={`/candidate/${c._id}`} style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)' }}>ACT →</Link>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── ROLES COMMAND CENTER ── */}
          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: '400px', height: '38px', borderRadius: '10px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input type="text" placeholder="Search roles, skills, depts..." value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                   {['table', 'grid', 'kanban'].map(v => (
                     <button key={v} onClick={() => setView(v as any)}
                       style={{ width: '38px', height: '38px', borderRadius: '10px', background: view === v ? 'var(--accent-soft)' : 'white', border: '1px solid var(--border-color)', color: view === v ? 'var(--accent-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                       {v === 'table' ? <TableProperties size={15} /> : v === 'grid' ? <LayoutGrid size={15} /> : <KanbanSquare size={15} />}
                     </button>
                   ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { fetchCampaigns(); fetchAlerts(); }} className="btn-secondary" style={{ height: '38px', padding: '0 12px' }}>
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <Link href="/create-jd" className="btn-primary" style={{ padding: '8px 16px', borderRadius: '9px' }}>
                  <Plus size={14} /> New Role
                </Link>
              </div>
            </div>

            {view === 'table' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Hiring Role</th>
                    <th style={{ width: '20%' }}>Process Health (Funnel)</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Total</th>
                    <th style={{ width: '15%' }}>Hiring Stage</th>
                    <th style={{ width: '15%' }}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(role => {
                    const sColors = STAGE_COLORS[role.kanban_stage as KStage] || STAGE_COLORS.Sourcing;
                    return (
                      <tr key={role._id} onClick={() => router.push(`/jd/${role._id}`)} style={{ cursor: 'pointer' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Briefcase size={14} color="var(--accent-primary)" />
                              </div>
                                <div style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {role.title}
                                  {role.isLegacy && (
                                    <span style={{ fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(107,114,128,0.1)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.2)' }}>LEGACY</span>
                                  )}
                                </div>
                            </div>
                          </td>
                          <td>
                            <FunnelBar stages={role.stageCounts} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '800', fontSize: '14px' }}>{role.candidateCount || 0}</div>
                          </td>
                          <td>
                            <span style={{ 
                              background: sColors.bg, 
                              color: sColors.text, 
                              fontSize: '10px', 
                              fontWeight: '700', 
                              padding: '3px 9px', 
                              borderRadius: '20px',
                              textTransform: 'uppercase'
                            }}>
                              {role.kanban_stage === 'Sourcing' ? 'New Applicants' : role.kanban_stage}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} /> {fmtDate(role.updatedAt)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            ) : view === 'grid' ? (
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {filtered.map(role => (
                  <Link key={role._id} href={`/jd/${role._id}`} className="job-card" style={{ padding: '16px', display: 'block', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: role.isLegacy ? 'rgba(0,0,0,0.05)' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Briefcase size={14} color={role.isLegacy ? 'var(--text-muted)' : 'var(--accent-primary)'} />
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {role.isLegacy && <span style={{ fontSize: '8px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px', background: 'rgba(107,114,128,0.1)', color: 'var(--text-muted)' }}>LEGACY</span>}
                        <span style={{ fontSize: '10px', fontWeight: '700', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '20px' }}>{role.kanban_stage}</span>
                      </div>
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>{role.title}</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>{role.department}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ fontSize: '11px', fontWeight: '700' }}><Users size={12} style={{ display:'inline', marginRight:'4px'}} /> {role.candidateCount || 0} candidates</div>
                       <ChevronRight size={14} color="var(--accent-primary)" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* Kanban view placeholder or existing Kanban component */
              <div style={{ padding: '20px' }}>
                 <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Kanban view is best experienced in the role detail page. Click a role to view the full process.</p>
                 {/* Optional: Add a small preview or redirect */}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: ACTIVITY FEED ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-lg)', background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap size={15} color="var(--accent-secondary)" />
              <span style={{ fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Activity</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Mock Activity Feed derived from campaigns/alerts */}
              {campaigns.slice(0, 8).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Activity size={12} color="var(--text-muted)" />
                  </div>
                  <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Update in</span> <strong style={{ color: 'var(--text-primary)' }}>{c.title}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>{Math.pow(i + 1, 2)}m ago</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ width: '100%', marginTop: '16px', fontSize: '11px', justifyContent: 'center' }}>View Full Audit Log</button>
          </div>
        </div>

      </div>

      {/* Move Stage Modal (Legacy support / Quick Action) */}
      {moveModal && (
        <div className="modal-overlay" onClick={() => setMoveModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Move to Stage</h3>
              <button className="btn-ghost" style={{ padding: '6px' }} onClick={() => setMoveModal(null)}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {KANBAN_STAGES.map(s => {
                const sc = STAGE_COLORS[s];
                const isCurrent = s === moveModal.current;
                return (
                  <button key={s} onClick={() => moveToStage(moveModal.id, s)}
                    disabled={isCurrent || movingId === moveModal.id}
                    style={{ padding: '12px 16px', borderRadius: 'var(--radius)', textAlign: 'left', border: `1.5px solid ${isCurrent ? sc.border : 'var(--border-color)'}`, background: isCurrent ? sc.bg : 'var(--bg-card)', color: isCurrent ? sc.text : 'var(--text-primary)', cursor: isCurrent ? 'default' : 'pointer', fontWeight: isCurrent ? '700' : '500', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{s === 'Sourcing' ? 'New Applicants' : s}</span>
                    {isCurrent ? <span style={{ fontSize: '10px', opacity: 0.7 }}>Current</span> : <ArrowRight size={13} color="var(--text-muted)" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
