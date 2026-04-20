'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, Clock, Upload, FileText, CheckCircle2,
  Loader2, User, Mail, Phone, Calendar, ChevronRight, AlertCircle, Zap
} from 'lucide-react';
import { jobApi } from '@/lib/api';
import { JobCampaign } from '@/types';

type Stage = 'loading' | 'error' | 'view' | 'applying' | 'success';

export default function PublicJobPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<JobCampaign | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [resume, setResume] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', years: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    jobApi.getPublicJob(id)
      .then(r => { setCampaign(r.data.campaign); setStage('view'); })
      .catch(() => setStage('error'));
  }, [id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email is required.';
    if (!resume) e.resume = 'Please upload your resume.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('years_experience', form.years);
      fd.append('resume', resume!);
      await jobApi.applyToJob(id, fd);
      setStage('success');
    } catch {
      setErrors({ submit: 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setResume(f);
  };

  const skills: string[] = (() => {
    if (!campaign?.jd_analysis) return [];
    const raw = campaign.jd_analysis.must_have_skills || campaign.jd_analysis.required_skills || [];
    return raw.slice(0, 10).map((s: any) => typeof s === 'string' ? s : s.name);
  })();

  if (stage === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF8F4' }}>
      <Loader2 className="animate-spin" size={36} color="#E8622A" />
    </div>
  );

  if (stage === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#FDF8F4' }}>
      <AlertCircle size={48} color="#DC2626" />
      <h2 style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'Outfit, sans-serif' }}>Job not found</h2>
      <p style={{ color: '#78716C' }}>This role may have been closed or the link is incorrect.</p>
    </div>
  );

  if (stage === 'success') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#FDF8F4', padding: '40px' }}>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14 }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(5,150,105,0.35)' }}>
          <CheckCircle2 size={40} color="white" />
        </div>
      </motion.div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} style={{ textAlign: 'center', maxWidth: '480px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'Outfit, sans-serif', marginBottom: '12px' }}>Application Submitted!</h2>
        <p style={{ color: '#78716C', fontSize: '16px', lineHeight: 1.6 }}>
          Thank you for applying to <strong>{campaign?.title}</strong>. Our AI is screening your CV now. We'll be in touch if you're shortlisted.
        </p>
        <div style={{ marginTop: '24px', padding: '16px 20px', borderRadius: '12px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', fontSize: '13px', color: '#059669', fontWeight: '600' }}>
          🤖 Multi-agent AI evaluation typically completes within 2–5 minutes.
        </div>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#FDF8F4', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Animated background blobs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.15, width: '500px', height: '500px', background: 'radial-gradient(circle,#E8622A,transparent)', top: '-100px', right: '-100px', animation: 'blob1 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.1, width: '400px', height: '400px', background: 'radial-gradient(circle,#F5A623,transparent)', bottom: '-80px', left: '-80px', animation: 'blob2 15s ease-in-out infinite' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '60px 24px 80px' }}>
        {/* Company badge */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#E8622A,#F5A623)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '18px', color: 'white', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 14px rgba(232,98,42,0.4)' }}>T</div>
          <span style={{ fontWeight: '700', fontSize: '16px', background: 'linear-gradient(135deg,#E8622A,#F5A623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'Outfit, sans-serif' }}>TalentFlow AI</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9CA3AF', background: 'rgba(0,0,0,0.04)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.07)' }}>AI-Powered Recruitment</span>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px', alignItems: 'start' }}>
          {/* Left: JD */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <span style={{ background: 'rgba(232,98,42,0.1)', color: '#E8622A', border: '1px solid rgba(232,98,42,0.2)', fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Zap size={10} /> AI-Screened Role
                </span>
                <span style={{ background: 'rgba(0,0,0,0.04)', color: '#78716C', border: '1px solid rgba(0,0,0,0.07)', fontSize: '11px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={10} /> {campaign?.department || 'General'}
                </span>
                <span style={{ background: 'rgba(0,0,0,0.04)', color: '#78716C', border: '1px solid rgba(0,0,0,0.07)', fontSize: '11px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock size={10} /> Posted {campaign?.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'}
                </span>
              </div>
              <h1 style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2, letterSpacing: '-0.5px', marginBottom: '8px' }}>{campaign?.title}</h1>
              {campaign?.job_title && campaign.job_title !== campaign.title && (
                <p style={{ color: '#78716C', fontSize: '16px' }}>{campaign.job_title}</p>
              )}
            </div>

            {/* Skills required */}
            {skills.length > 0 && (
              <div style={{ marginBottom: '28px', padding: '20px', borderRadius: '14px', background: 'white', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Key skills we're looking for</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {skills.map((s, i) => (
                    <span key={i} style={{ padding: '5px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'rgba(232,98,42,0.08)', color: '#E8622A', border: '1px solid rgba(232,98,42,0.18)' }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* JD Text */}
            <div style={{ padding: '24px', borderRadius: '14px', background: 'white', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={12} /> About this role
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.75', color: '#44403C' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{campaign?.generated_jd}</pre>
              </div>
            </div>
          </motion.div>

          {/* Right: Application Form */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} style={{ position: 'sticky', top: '24px' }}>
            <div style={{ background: 'white', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '32px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg,#E8622A,#F5A623)' }} />
              <h2 style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'Outfit, sans-serif', marginBottom: '6px' }}>
                {campaign?.kanban_stage && campaign.kanban_stage !== 'Sourcing' ? 'Applications Closed' : 'Apply Now'}
              </h2>
              <p style={{ fontSize: '13px', color: '#78716C', marginBottom: '24px' }}>
                {campaign?.kanban_stage && campaign.kanban_stage !== 'Sourcing'
                  ? 'This role is no longer accepting new applications.'
                  : 'AI-powered screening. Results within minutes.'}
              </p>

              {campaign?.kanban_stage && campaign.kanban_stage !== 'Sourcing' ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Clock size={24} color="#9CA3AF" />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Hiring process in progress</h3>
                  <p style={{ fontSize: '13px', color: '#78716C', lineHeight: 1.5 }}>
                    We have moved to the evaluation stage for this role. Follow <strong>TalentFlow AI</strong> for future opportunities.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Name */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}><User size={11} />Full Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Jane Smith"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: errors.name ? '1.5px solid #DC2626' : '1.5px solid rgba(0,0,0,0.1)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: errors.name ? 'rgba(220,38,38,0.02)' : 'white', transition: 'border 0.15s' }}
                      />
                      {errors.name && <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px', display: 'block' }}>{errors.name}</span>}
                    </div>
                    {/* Email */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}><Mail size={11} />Email Address *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="jane@example.com"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: errors.email ? '1.5px solid #DC2626' : '1.5px solid rgba(0,0,0,0.1)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: errors.email ? 'rgba(220,38,38,0.02)' : 'white', transition: 'border 0.15s' }}
                      />
                      {errors.email && <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px', display: 'block' }}>{errors.email}</span>}
                    </div>
                    {/* Phone + Experience row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}><Phone size={11} />Phone</label>
                        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9999..."
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={11} />Exp. (yrs)</label>
                        <input type="number" min="0" max="50" value={form.years} onChange={e => setForm(f => ({ ...f, years: e.target.value }))} placeholder="3"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                      </div>
                    </div>

                    {/* Resume upload */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#57534E', marginBottom: '6px', display: 'block' }}>Resume / CV *</label>
                      <div
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        onClick={() => fileRef.current?.click()}
                        style={{
                          border: `2px dashed ${errors.resume ? '#DC2626' : dragging ? '#E8622A' : resume ? '#059669' : 'rgba(0,0,0,0.12)'}`,
                          borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer',
                          background: dragging ? 'rgba(232,98,42,0.04)' : resume ? 'rgba(5,150,105,0.04)' : 'rgba(0,0,0,0.01)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,image/png,image/jpeg,image/jpg" onChange={e => e.target.files && setResume(e.target.files[0])} />
                        {resume ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <CheckCircle2 size={18} color="#059669" />
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resume.name}</span>
                          </div>
                        ) : (
                          <>
                            <Upload size={22} color="#9CA3AF" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#57534E' }}>Drop file or click to browse</div>
                            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>PDF, DOCX, or Image (PNG/JPG) · Max 10 MB</div>
                          </>
                        )}
                      </div>
                      {errors.resume && <span style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px', display: 'block' }}>{errors.resume}</span>}
                    </div>

                    {errors.submit && (
                      <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: '13px', color: '#DC2626' }}>{errors.submit}</div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '14px', borderRadius: '12px', border: 'none',
                        background: 'linear-gradient(135deg,#E8622A,#F5A623)',
                        color: 'white', fontWeight: '700', fontSize: '15px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: '0 6px 20px rgba(232,98,42,0.4)', fontFamily: 'inherit',
                        transition: 'opacity 0.15s', opacity: submitting ? 0.7 : 1,
                        marginTop: '4px',
                      }}
                    >
                      {submitting ? <><Loader2 className="animate-spin" size={18} />Submitting…</> : <>Submit Application <ChevronRight size={18} /></>}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '11px', color: '#9CA3AF', lineHeight: 1.5 }}>
                      Your CV will be analyzed by our recruiter for skills match, experience fit, and cultural alignment.
                    </p>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
