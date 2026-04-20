'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle,
  Briefcase, Cpu, BarChart2, Users, ChevronLeft, Edit3, Plus, X, Check
} from 'lucide-react';
import { jobApi } from '@/lib/api';

type Step = 1 | 2 | 3 | 4;

interface FormData {
  title: string;
  department: string;
  positions: string;
  prompt: string;
}

interface GeneratedData {
  campaignId: string;
  title: string;
  generated_jd: string;
  jd_analysis: {
    must_have_skills?: string[];
    optional_skills?: string[];
    experience_required?: string;
    weightage?: Record<string, number>;
  };
}

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations', 'Finance', 'HR', 'Data', 'DevOps', 'Other'];

const STEP_META = [
  { n: 1, label: 'Role Details',  desc: 'Basic information about the position' },
  { n: 2, label: 'AI Generates',  desc: 'Claude creates your job description' },
  { n: 3, label: 'Review & Edit', desc: 'Confirm skills and requirements' },
  { n: 4, label: 'Published',     desc: 'Role is live and ready for candidates' },
];

export default function CreateJD() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ title: '', department: '', positions: '1', prompt: '' });
  const [generated, setGenerated] = useState<GeneratedData | null>(null);
  const [editedJd, setEditedJd] = useState('');
  const [editingJd, setEditingJd] = useState(false);
  const [extraSkill, setExtraSkill] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!form.title.trim() || !form.prompt.trim()) { setError('Role title and description are required.'); return; }
    setLoading(true); setError(null); setStep(2);
    try {
      const res = await jobApi.create({ title: form.title, prompt: form.prompt, department: form.department || 'General' });
      if (res.data.success) {
        const data: GeneratedData = {
          campaignId: res.data.job.id,
          title: res.data.job.title,
          generated_jd: res.data.job.generated_jd,
          jd_analysis: res.data.job.jd_analysis || {},
        };
        setGenerated(data);
        setEditedJd(data.generated_jd || '');
        setStep(3);
      } else {
        setError(res.data.error || 'Failed to generate JD.'); setStep(1);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'An error occurred.');
      setStep(1);
    } finally { setLoading(false); }
  };

  const handlePublish = () => {
    setStep(4);
  };

  const addCustomSkill = () => {
    const s = extraSkill.trim();
    if (s && !customSkills.includes(s)) { setCustomSkills(p => [...p, s]); }
    setExtraSkill('');
  };

  const allMustHaveSkills = [...(generated?.jd_analysis?.must_have_skills || []), ...customSkills];

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="white" />
          </div>
          <span className="badge badge-accent">AI-Powered</span>
        </div>
        <h1 className="page-title" style={{ marginBottom: '6px' }}>Post a New Role</h1>
        <p className="page-subtitle">Describe the position. Claude will handle the rest.</p>
      </div>

      {/* Step progress */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '36px', gap: 0 }}>
        {STEP_META.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '80px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: done ? 'var(--success)' : active ? 'var(--accent-primary)' : 'rgba(0,0,0,0.06)', border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent-primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', flexShrink: 0 }}>
                  {done ? <CheckCircle2 size={16} color="white" /> : active && loading ? <Loader2 size={14} className="animate-spin" color="white" /> : <span style={{ fontWeight: '800', fontSize: '13px', color: active ? 'white' : 'var(--text-muted)' }}>{s.n}</span>}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: active ? 'var(--text-primary)' : done ? 'var(--success)' : 'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
              {i < STEP_META.length - 1 && (
                <div style={{ flex: 1, height: '2px', background: step > s.n ? 'var(--success)' : 'var(--border-color)', margin: '0 4px', marginBottom: '20px', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Role Details ───────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="card" style={{ padding: '36px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px' }}>Role Information</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="input-label">Role Title *</label>
                  <input className="input" type="text" required placeholder="e.g. Senior Backend Engineer"
                    value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Department</label>
                  <select className="input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={{ cursor: 'pointer' }}>
                    <option value="">Select department…</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="input-label">Number of Openings</label>
                <input className="input" type="number" min="1" max="99" value={form.positions}
                  onChange={e => setForm(p => ({ ...p, positions: e.target.value }))} style={{ maxWidth: '100px' }} />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Role Description *</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{form.prompt.length} chars</span>
                </div>
                <textarea className="input" required rows={7}
                  placeholder="Describe the role in plain English. Include: responsibilities, required skills, experience level, team context, tech stack, and any specific requirements.&#10;&#10;Example: 'We need a senior backend engineer with 5+ years experience in Node.js and PostgreSQL. They'll own our payments microservice, work with a 6-person team, and should have experience with high-traffic systems…'"
                  value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
                  style={{ resize: 'vertical', lineHeight: 1.6 }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
                  💡 More detail = better JD. Mention seniority, tech stack, team size, and key responsibilities.
                </p>
              </div>

              {error && (
                <div className="error-banner" style={{ marginBottom: '20px' }}>
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button className="btn-primary" onClick={handleGenerate} disabled={!form.title.trim() || !form.prompt.trim()}
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}>
                <Sparkles size={17} /> Generate Job Description <ArrowRight size={16} />
              </button>
            </div>

            {/* How it works */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '20px' }}>
              {[
                { icon: Edit3, label: 'You describe', desc: 'Role in plain English' },
                { icon: Cpu, label: 'AI writes JD', desc: 'Professional, structured' },
                { icon: BarChart2, label: 'Skills extracted', desc: 'Auto-weighted requirements' },
                { icon: Users, label: 'Ready to hire', desc: 'Upload CVs and evaluate' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ padding: '14px', background: 'rgba(0,0,0,0.01)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                    <s.icon size={13} color="var(--accent-primary)" />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '3px' }}>{s.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Generating ─────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--shadow-accent)' }}>
                <Sparkles size={28} color="white" />
              </motion.div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>AI is crafting your job description</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Agent 1 is writing the JD, Agent 2 is extracting requirements…</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '260px', margin: '0 auto' }}>
                {[
                  { label: 'Analyzing your brief', done: true },
                  { label: 'Writing job description', done: false, active: true },
                  { label: 'Extracting skill requirements', done: false },
                  { label: 'Setting evaluation weights', done: false },
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: t.active ? 'var(--accent-soft)' : t.done ? 'rgba(5,150,105,0.06)' : 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                    {t.done ? <CheckCircle2 size={13} color="var(--success)" /> : t.active ? <Loader2 size={13} className="animate-spin" color="var(--accent-primary)" /> : <div style={{ width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid var(--border-color)' }} />}
                    <span style={{ fontSize: '12px', color: t.active ? 'var(--accent-primary)' : t.done ? 'var(--success)' : 'var(--text-muted)', fontWeight: t.active ? '700' : '500' }}>{t.label}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '20px' }}>This usually takes 10–25 seconds.</p>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Review ─────────────────────────────────────────── */}
        {step === 3 && generated && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* JD Preview */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <CheckCircle2 size={16} color="var(--success)" /> Job Description Generated
                  </h3>
                  <button onClick={() => setEditingJd(!editingJd)} className="btn-secondary" style={{ fontSize: '11px', padding: '5px 12px' }}>
                    <Edit3 size={11} /> {editingJd ? 'Preview' : 'Edit JD'}
                  </button>
                </div>
                {editingJd ? (
                  <textarea className="input" value={editedJd} onChange={e => setEditedJd(e.target.value)}
                    style={{ minHeight: '280px', fontSize: '12px', lineHeight: 1.7, resize: 'vertical' }} />
                ) : (
                  <div style={{ maxHeight: '260px', overflowY: 'auto', fontSize: '12px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{editedJd}</pre>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <BarChart2 size={15} color="var(--accent-primary)" /> Required Skills
                </h3>

                {allMustHaveSkills.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Must-Have</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {allMustHaveSkills.map((s, i) => (
                        <span key={i} className="tag tag-warn" style={{ fontSize: '11px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {(generated.jd_analysis?.optional_skills?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Nice-to-Have</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {generated.jd_analysis.optional_skills?.map((s, i) => (
                        <span key={i} className="tag" style={{ fontSize: '11px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {generated.jd_analysis?.experience_required && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Experience Required</div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{generated.jd_analysis.experience_required}</div>
                  </div>
                )}

                {/* Scoring weights */}
                {generated.jd_analysis?.weightage && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Evaluation Weights</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(generated.jd_analysis.weightage).map(([k, v]) => (
                        <div key={k} style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.025)', borderRadius: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'capitalize' }}>{k}</div>
                          <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>{v}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add custom skill */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="input" style={{ flex: 1, fontSize: '12px' }} value={extraSkill} onChange={e => setExtraSkill(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                    placeholder="Add extra skill (Enter)…" />
                  <button onClick={addCustomSkill} className="btn-secondary" style={{ padding: '0 12px', fontSize: '11px' }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setStep(1); setGenerated(null); }} className="btn-secondary" style={{ fontSize: '13px', padding: '11px 20px' }}>
                  <ChevronLeft size={14} /> Start Over
                </button>
                <button onClick={handlePublish} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px', fontSize: '15px' }}>
                  <CheckCircle2 size={17} /> Publish Role <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Published ──────────────────────────────────────── */}
        {step === 4 && generated && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.4 }}
                style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(5,150,105,0.12)', border: '2px solid rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={36} color="var(--success)" />
              </motion.div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Role Published!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                <strong>{generated.title}</strong> is now live. Start uploading candidate CVs.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => router.push(`/jd/${generated.campaignId}`)} className="btn-primary" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  <Users size={15} /> Add Candidates
                </button>
                <button onClick={() => router.push('/')} className="btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  Dashboard
                </button>
                <button onClick={() => { setStep(1); setGenerated(null); setForm({ title: '', department: '', positions: '1', prompt: '' }); }} className="btn-secondary" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  <Plus size={14} /> New Role
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
