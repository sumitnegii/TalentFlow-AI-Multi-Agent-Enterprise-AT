'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

const PUBLIC_PREFIXES = ['/jobs/'];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isPublic = PUBLIC_PREFIXES.some(p => path.startsWith(p));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [path]);

  // Listen to close event from within sidebar
  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    window.addEventListener('close-sidebar', handler);
    return () => window.removeEventListener('close-sidebar', handler);
  }, []);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div ref={wrapRef} className={`layout-wrap${sidebarOpen ? ' sidebar-open' : ''}`}>
      {/* Mobile overlay — click to close */}
      <div
        className="sidebar-overlay"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile top bar */}
        <header className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(p => !p)}
            aria-label="Toggle navigation"
          >
            <span className="hamburger-line" style={sidebarOpen ? { transform: 'rotate(45deg) translate(4px, 5px)' } : {}} />
            <span className="hamburger-line" style={sidebarOpen ? { opacity: 0 } : {}} />
            <span className="hamburger-line" style={sidebarOpen ? { transform: 'rotate(-45deg) translate(4px, -5px)' } : {}} />
          </button>

          <div className="mobile-topbar-logo">
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'var(--accent-gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '14px', color: 'white',
                fontFamily: 'var(--font-display)',
              }}>T</div>
              <span className="text-gradient" style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>
                TalentFlow
              </span>
            </Link>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
