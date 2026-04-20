'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, BrainCircuit, Cpu, Save, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MODELS = [
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', note: 'Recommended · Best quality & speed balance', tag: 'Recommended' },
  { id: 'claude-3-opus',     label: 'Claude 3 Opus',      note: 'Highest quality · Slower & more expensive', tag: 'Most Capable' },
  { id: 'claude-3-haiku',   label: 'Claude 3 Haiku',     note: 'Fastest & cheapest · Good for high-volume', tag: 'Fast' },
];

const SETTINGS_SECTIONS = [
  {
    title: 'Evaluation Pipeline', icon: BrainCircuit, items: [
      { key: 'hr_top_n', label: 'HR Review Top N', desc: 'How many top candidates Agent 9 reviews in detail.', type: 'number', defaultValue: 5, min: 1, max: 20 },
      { key: 'enable_debate', label: 'Enable Debate Agents (6+7)', desc: 'Run the Counter + Reconciliation debate step. Improves accuracy but increases API cost.', type: 'toggle', defaultValue: true },
      { key: 'auto_process', label: 'Auto-evaluate on Upload', desc: 'Automatically trigger the evaluation pipeline when CVs are uploaded.', type: 'toggle', defaultValue: false },
    ]
  },
  {
    title: 'AI Model', icon: Cpu, items: [
      { key: 'model', label: 'Primary AI Model', desc: 'Used for all agent calls (JD creation, CV analysis, evaluation).', type: 'model', defaultValue: 'claude-3-5-sonnet' },
    ]
  },
  {
    title: 'Scoring', icon: Zap, items: [
      { key: 'min_score_shortlist', label: 'Minimum Score to Shortlist', desc: 'Candidates below this score will be marked NO automatically.', type: 'number', defaultValue: 55, min: 0, max: 100 },
      { key: 'strong_yes_threshold', label: 'Strong Yes Threshold', desc: 'Candidates above this score are marked STRONG_YES.', type: 'number', defaultValue: 80, min: 0, max: 100 },
    ]
  },
];

export default function ConfigPage() {
  const [values, setValues] = useState<Record<string, any>>({
    hr_top_n: 5, enable_debate: true, auto_process: false,
    model: 'claude-3-5-sonnet', min_score_shortlist: 55, strong_yes_threshold: 80,
  });
  const [saved, setSaved] = useState(false);

  const set = (key: string, val: any) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem('talentflow_config', JSON.stringify(values));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: '780px' }}>
      <div className="page-header">
        <h1 className="page-title">AI Configuration</h1>
        <p className="page-subtitle">Customize the multi-agent evaluation pipeline, scoring thresholds, and model selection.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {SETTINGS_SECTIONS.map((section, si) => {
          const SectionIcon = section.icon;
          return (
            <motion.div
              key={section.title}
              className="card"
              style={{ padding: '28px' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.08 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SectionIcon size={16} color="var(--accent-primary)" />
                </div>
                <h2 style={{ fontSize: '15px', fontWeight: '700' }}>{section.title}</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {section.items.map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>

                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      {item.type === 'toggle' && (
                        <button
                          onClick={() => set(item.key, !values[item.key])}
                          style={{
                            width: '48px', height: '26px', borderRadius: '13px',
                            background: values[item.key] ? 'var(--accent-gradient)' : 'rgba(0,0,0,0.12)',
                            border: 'none', cursor: 'pointer', position: 'relative',
                            transition: 'background 0.2s',
                          }}
                        >
                          <motion.div
                            animate={{ x: values[item.key] ? 22 : 2 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
                          />
                        </button>
                      )}

                      {item.type === 'number' && (
                        <input
                          type="number"
                          className="input"
                          style={{ width: '100px', textAlign: 'center' }}
                          value={values[item.key]}
                          min={(item as any).min}
                          max={(item as any).max}
                          onChange={e => set(item.key, Number(e.target.value))}
                        />
                      )}

                      {item.type === 'model' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                          {MODELS.map(m => (
                            <button
                              key={m.id}
                              onClick={() => set(item.key, m.id)}
                              style={{
                                padding: '12px 16px', borderRadius: 'var(--radius)',
                                border: `1.5px solid ${values[item.key] === m.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                background: values[item.key] === m.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                display: 'flex', flexDirection: 'column', gap: '2px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: '600', fontSize: '13px', color: values[item.key] === m.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{m.label}</span>
                                {values[item.key] === m.id && <CheckCircle2 size={14} color="var(--accent-primary)" />}
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.note}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Info note */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', borderRadius: 'var(--radius)', background: 'var(--info-bg)', border: '1px solid rgba(37,99,235,0.2)', fontSize: '13px', color: 'var(--info)' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>These settings are saved to your browser and will take effect on the next evaluation run. For production deployments, configure via environment variables in <code style={{ fontFamily: 'monospace', background: 'rgba(37,99,235,0.1)', padding: '1px 5px', borderRadius: '3px' }}>backend/.env</code>.</span>
        </div>

        {/* Save */}
        <button
          className="btn-primary"
          onClick={save}
          style={{ alignSelf: 'flex-start', padding: '12px 28px' }}
        >
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Configuration</>}
        </button>
      </div>
    </div>
  );
}
