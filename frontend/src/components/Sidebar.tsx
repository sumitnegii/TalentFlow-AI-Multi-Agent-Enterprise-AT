'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, PlusCircle, Users, Settings, Zap, LogOut,
  Bell, ChevronRight, PieChart, X, CheckCircle2, Upload, AlertCircle, Info, Menu,
} from 'lucide-react';

// ── Global Notification Context ────────────────────────────────
export type Notif = { id: string; icon: 'upload' | 'complete' | 'alert' | 'info'; title: string; body: string; time: Date; read: boolean };
type NCtx = { notifs: Notif[]; addNotif: (n: Omit<Notif, 'id' | 'time' | 'read'>) => void; markRead: (id: string) => void; clearAll: () => void };
const NotifContext = createContext<NCtx>({ notifs: [], addNotif: () => {}, markRead: () => {}, clearAll: () => {} });
export const useNotifs = () => useContext(NotifContext);

let _addNotif: NCtx['addNotif'] = () => {};
export const pushNotif = (n: Omit<Notif, 'id' | 'time' | 'read'>) => _addNotif(n);

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: '0', icon: 'info', title: 'Welcome to TalentFlow!', body: 'Create a role and upload CVs to get started.', time: new Date(), read: false },
  ]);
  const addNotif = useCallback((n: Omit<Notif, 'id' | 'time' | 'read'>) => {
    const notif: Notif = { ...n, id: Date.now().toString(), time: new Date(), read: false };
    setNotifs(prev => [notif, ...prev].slice(0, 20));
  }, []);
  useEffect(() => { _addNotif = addNotif; }, [addNotif]);
  const markRead = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearAll = () => setNotifs([]);
  return <NotifContext.Provider value={{ notifs, addNotif, markRead, clearAll }}>{children}</NotifContext.Provider>;
}

// ── Notification Panel ─────────────────────────────────────────
function NotifPanel({ onClose }: { onClose: () => void }) {
  const { notifs, markRead, clearAll } = useNotifs();
  const unread = notifs.filter(n => !n.read).length;
  const ICON_MAP = { upload: Upload, complete: CheckCircle2, alert: AlertCircle, info: Info };
  const COLOR_MAP = { upload: '#2563EB', complete: '#059669', alert: '#DC2626', info: '#D97706' };

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const fmt = (d: Date) => {
    const diff = now - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div style={{ position: 'absolute', left: '260px', top: '0', width: '340px', background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)', zIndex: 200, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px' }}>Notifications</div>
          {unread > 0 && <div style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>{unread} unread</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {notifs.length > 0 && <button className="btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={clearAll}>Clear all</button>}
          <button className="btn-ghost" style={{ padding: '4px' }} onClick={onClose}><X size={14} /></button>
        </div>
      </div>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No notifications yet</div>
        ) : notifs.map(n => {
          const Icon = ICON_MAP[n.icon];
          const color = COLOR_MAP[n.icon];
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{ padding: '13px 18px', display: 'flex', gap: '12px', borderBottom: '1px solid rgba(0,0,0,.04)', background: !n.read ? `${color}06` : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <Icon size={14} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.read ? '500' : '700', fontSize: '13px', marginBottom: '2px' }}>{n.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{fmt(n.time)}</div>
              </div>
              {!n.read && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '6px' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Nav Items ──────────────────────────────────────────────────
const menuItems = [
  { name: 'Dashboard',   icon: LayoutDashboard, href: '/' },
  { name: 'Post a Role', icon: PlusCircle,       href: '/create-jd' },
  { name: 'Candidates',  icon: Users,            href: '/candidates' },
  { name: 'Analytics',   icon: PieChart,         href: '/analytics' },
  { name: 'AI Config',   icon: Zap,              href: '/config' },
];

// ── Sidebar Component ──────────────────────────────────────────
function SidebarInner() {
  const pathname = usePathname();
  const { notifs } = useNotifs();
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifs.filter(n => !n.read).length;

  return (
    <aside style={{
      width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
      height: '100vh', position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.88)',
      borderRight: '1px solid var(--border-color)',
      backdropFilter: 'blur(20px)', zIndex: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 14px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', marginBottom: '24px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '17px', color: 'white', flexShrink: 0, boxShadow: '0 4px 14px rgba(232,98,42,.4)', fontFamily: 'var(--font-display)' }}>T</div>
          <div>
            <div className="text-gradient" style={{ fontSize: '16px', fontWeight: '800', lineHeight: 1.1, fontFamily: 'var(--font-display)' }}>TalentFlow</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: '2px', fontWeight: '700', textTransform: 'uppercase' }}>AI Platform</div>
          </div>
          {/* Mobile close button — only visible when sidebar is open as drawer */}
          <button
            className="btn-icon sidebar-close-btn"
            onClick={() => {
              // Dispatch a custom event that ConditionalLayout can listen to
              window.dispatchEvent(new CustomEvent('close-sidebar'));
            }}
            aria-label="Close menu"
            style={{ marginLeft: 'auto', display: 'none' }}
          >
            <X size={16} />
          </button>
          {/* Bell */}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button className="btn-icon" style={{ width: '32px', height: '32px', position: 'relative' }} onClick={() => setShowNotifs(p => !p)}>
              <Bell size={14} color={unread > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--accent-primary)', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '800', color: 'white' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {showNotifs && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowNotifs(false)} />
                <div style={{ position: 'absolute', left: '40px', top: '-8px', zIndex: 200 }}>
                  <NotifPanel onClose={() => setShowNotifs(false)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '0 12px', marginBottom: '8px', textTransform: 'uppercase' }}>Main Menu</div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link href={item.href} className={`nav-item${isActive ? ' active' : ''}`}>
                    <Icon size={17} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {isActive && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Quick create */}
          <div style={{ marginTop: '24px', padding: '0 2px' }}>
            <div className="card-accent" style={{ borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '5px' }}>New Campaign</div>
              <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '10px', lineHeight: 1.4 }}>AI-generate a full JD in seconds.</div>
              <Link href="/create-jd" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,.2)', borderRadius: '7px', padding: '6px 11px', fontSize: '11px', fontWeight: '700', color: 'white', backdropFilter: 'blur(8px)' }}>
                <PlusCircle size={12} /> Post a Role
              </Link>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background 0.15s', marginBottom: '6px' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin User</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Administrator</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Link href="/config" className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}><Settings size={12} />Settings</Link>
            <button className="btn-ghost" style={{ color: 'var(--error)', fontSize: '11px' }}><LogOut size={12} /></button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <NotifProvider>
      <SidebarInner />
    </NotifProvider>
  );
}
