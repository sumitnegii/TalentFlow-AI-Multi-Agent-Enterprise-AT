'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart2, Users, CheckCircle2, TrendingUp, Award, Briefcase,
  Loader2, ArrowRight, Target, Zap, Activity, AlertTriangle,
  Clock, TrendingDown, ThumbsUp
} from 'lucide-react';
import { jobApi } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────── */
interface AnalyticSummary {
  totalCampaigns: number;
  totalCandidates: number;
  shortlisted: number;
  interviewed: number;
  hired: number;
  conversionRate: number;
}
interface AnalyticsData {
  summary: AnalyticSummary;
  funnel: Record<string, number>;
  decisions: Record<string, number>;
  topSkills: { name: string; count: number }[];
  campaignScores: { id: string; title: string; candidateCount: number; avgScore: number | null }[];
  timeToHire?: number;
  bottlenecks?: any[];
  stageConversions?: any[];
}

// ── Pure CSS Bar ──────────────────────────────────────────────
const Bar = ({ data, max, colorFn }: { data: { label: string; value: number }[]; max: number; colorFn?: (v: number) => string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    {data.map((item, i) => {
      const pct = max > 0 ? (item.value / max) * 100 : 0;
      const color = colorFn ? colorFn(item.value) : 'var(--accent-primary)';
      return (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{item.label}</span>
            <span style={{ fontWeight: '700', color }}>{item.value}</span>
          </div>
          <div className="progress-bar">
            <motion.div className="progress-fill" style={{ background: color, width: 0 }}
              animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }} />
          </div>
        </div>
      );
    })}
  </div>
);

// ── Donut Chart ───────────────────────────────────────────────
const Donut = ({ segments }: { segments: { label: string; value: number; color: string }[] }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>No data yet</div>;
  const size = 160; const r = 58; const circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((seg, i) => {
            if (seg.value === 0) return null;
            const dash = (seg.value / total) * circ;
            const off = circ - cum; cum += dash;
            return (
              <motion.circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={22}
                strokeDasharray={`${dash} ${circ}`} strokeDashoffset={off}
                initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${dash} ${circ}` }} transition={{ duration: 0.6, delay: i * 0.1 }} />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{total}</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{seg.value}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Enhanced Funnel with Drop-off ─────────────────────────────
const FunnelChart = ({ funnel }: { funnel: Record<string, number> }) => {
  const stages = [
    { key: 'Applied', label: 'Applied', color: '#9CA3AF' },
    { key: 'Screening', label: 'Screening', color: '#2563EB' },
    { key: 'Interview', label: 'Interview', color: '#7C3AED' },
    { key: 'Offer', label: 'Offer', color: '#059669' },
    { key: 'Hired', label: 'Hired', color: '#16A34A' },
  ];
  const max = Math.max(...stages.map(s => funnel[s.key] || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {stages.map((stage, i) => {
        const val = funnel[stage.key] || 0;
        const pct = (val / max) * 100;
        const prevVal = i > 0 ? funnel[stages[i - 1].key] || 0 : val;
        const dropOff = i > 0 && prevVal > 0 ? Math.round(((prevVal - val) / prevVal) * 100) : null;
        const isBottleneck = dropOff !== null && dropOff > 70;
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '72px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'right', flexShrink: 0 }}>{stage.label}</div>
            <div style={{ flex: 1, position: 'relative', height: '40px', display: 'flex', alignItems: 'center' }}>
              <motion.div
                style={{ height: '30px', background: isBottleneck ? `${stage.color}15` : `${stage.color}20`, border: `1px solid ${isBottleneck ? '#DC2626' : stage.color}33`, borderRadius: '6px', display: 'flex', alignItems: 'center', paddingLeft: '12px', minWidth: '40px' }}
                initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 6)}%` }} transition={{ duration: 0.7, delay: i * 0.1 }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: stage.color, whiteSpace: 'nowrap' }}>{val}</span>
              </motion.div>
              {dropOff !== null && (
                <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <TrendingDown size={11} color={isBottleneck ? '#DC2626' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '11px', color: isBottleneck ? '#DC2626' : 'var(--text-muted)', fontWeight: isBottleneck ? '700' : '500' }}>
                    {dropOff}% drop-off {isBottleneck ? '⚠' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Bottleneck Alerts ─────────────────────────────────────────
const BottleneckAlerts = ({ bottlenecks }: { bottlenecks: any[] }) => {
  if (!bottlenecks?.length) return null;
  return (
    <motion.div className="card" style={{ padding: '22px', marginBottom: '20px', border: '1.5px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.02)' }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={15} color="#DC2626" />
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#DC2626' }}>⚠ Hiring Bottlenecks Detected</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stages with &gt;70% candidate drop-off</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {bottlenecks.map((b: any, i: number) => (
          <div key={i} style={{ padding: '14px 16px', borderRadius: 'var(--radius)', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#DC2626', fontFamily: 'var(--font-display)', flexShrink: 0, minWidth: '48px' }}>{b.dropOff}%</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '2px' }}>Drop-off at {b.stage} stage</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{b.from} candidates entered, only {b.to} advanced. Review your {b.stage.toLowerCase()} criteria.</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ── Main Analytics Page ────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobApi.getAnalytics().then(r => { if (r.data.success) setData(r.data); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '14px' }}>
      <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Aggregating pipeline intelligence…</p>
    </div>
  );

  if (!data || data.summary.totalCampaigns === 0) return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Data-driven insights across all hiring campaigns.</p>
      </div>
      <div className="card empty-state">
        <BarChart2 size={44} className="empty-state-icon" />
        <h3 style={{ fontWeight: '700', fontSize: '17px' }}>No data yet</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Create campaigns and upload candidates to see analytics.</p>
        <Link href="/create-jd" className="btn-primary" style={{ marginTop: '8px' }}><Briefcase size={15} /> Post First Role</Link>
      </div>
    </div>
  );

  const { summary, funnel, decisions, campaignScores, topSkills, bottlenecks, timeToHire, stageConversions } = data;

  const decSegs = [
    { label: 'Strong Yes', value: decisions.STRONG_YES || 0, color: '#059669' },
    { label: 'Yes',        value: decisions.YES || 0,        color: '#0D9488' },
    { label: 'Maybe',      value: decisions.MAYBE || 0,      color: '#D97706' },
    { label: 'No',         value: decisions.NO || 0,         color: '#DC2626' },
    { label: 'Pending',    value: decisions.PENDING || 0,    color: '#9CA3AF' },
  ];

  const maxSkill = Math.max(...(topSkills || []).map((s: any) => s.count), 1);

  // Compute bottlenecks from funnel if backend doesn't return them
  const computedBottlenecks = (() => {
    const order = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const bn: any[] = [];
    for (let i = 1; i < order.length; i++) {
      const from = funnel[order[i - 1]] || 0;
      const to = funnel[order[i]] || 0;
      if (from > 0) {
        const drop = Math.round(((from - to) / from) * 100);
        if (drop > 70) bn.push({ stage: order[i], from, to, dropOff: drop });
      }
    }
    return bottlenecks || bn;
  })();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Pipeline intelligence across {summary.totalCampaigns} campaign{summary.totalCampaigns !== 1 ? 's' : ''}.</p>
        </div>
        <Link href="/" className="btn-secondary" style={{ fontSize: '13px' }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Dashboard</Link>
      </div>

      {/* Bottleneck Alerts */}
      <BottleneckAlerts bottlenecks={computedBottlenecks} />

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total CVs',      value: summary.totalCandidates, icon: Users,       color: 'var(--accent-primary)' },
          { label: 'Shortlisted',    value: summary.shortlisted,     icon: ThumbsUp,    color: 'var(--success)' },
          { label: 'Interviewed',    value: summary.interviewed,     icon: Activity,    color: '#7C3AED' },
          { label: 'Hired',          value: summary.hired,           icon: Award,       color: '#16A34A' },
          { label: 'Conversion',     value: `${summary.conversionRate}%`, icon: Target, color: '#D97706' },
          { label: 'Avg to Hire',    value: timeToHire ? `${timeToHire}d` : 'N/A',   icon: Clock,   color: 'var(--info)' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-label" style={{ fontSize: '9px' }}>{s.label}</div>
                  <div className="stat-card-value" style={{ color: s.color, fontSize: '22px' }}>{s.value}</div>
                </div>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} color={s.color} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Row 1: Funnel + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <motion.div className="card" style={{ padding: '24px' }} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={15} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Hiring Funnel</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stage conversion + drop-off rates</div>
            </div>
          </div>
          <FunnelChart funnel={funnel} />
        </motion.div>

        <motion.div className="card" style={{ padding: '24px' }} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(124,58,237,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#7C3AED" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>AI Decision Split</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Outcome across all evaluated candidates</div>
            </div>
          </div>
          <Donut segments={decSegs} />
        </motion.div>
      </div>

      {/* Row 2: Skills + Campaigns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {topSkills?.length > 0 && (
          <motion.div className="card" style={{ padding: '24px' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(5,150,105,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="var(--success)" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>Top Skills in Demand</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Across all job descriptions</div>
              </div>
            </div>
            <Bar data={topSkills.map((s: any) => ({ label: s.name, value: s.count }))} max={maxSkill}
              colorFn={v => v >= maxSkill ? 'var(--accent-primary)' : v >= maxSkill * 0.6 ? '#D97706' : 'var(--success)'} />
          </motion.div>
        )}

        {campaignScores?.length > 0 && (
          <motion.div className="card" style={{ padding: '24px' }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(37,99,235,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={15} color="var(--info)" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>Avg Match Score / Campaign</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quality of candidate pool per role</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {campaignScores.slice(0, 7).map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Link href={`/jd/${c.id}`} style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                    className="hover:text-accent">{c.title}</Link>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{c.candidateCount} CVs</div>
                  {c.avgScore != null ? (
                    <div style={{ fontSize: '18px', fontWeight: '800', color: c.avgScore >= 70 ? 'var(--success)' : c.avgScore >= 50 ? '#D97706' : 'var(--error)', fontFamily: 'var(--font-display)', minWidth: '36px', textAlign: 'right', flexShrink: 0 }}>{c.avgScore}</div>
                  ) : <div style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>—</div>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
