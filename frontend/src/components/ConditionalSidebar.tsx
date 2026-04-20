'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function ConditionalSidebar() {
  const path = usePathname();
  // Don't render sidebar/app-shell on public job application pages
  if (path.startsWith('/jobs/')) return null;
  return <Sidebar />;
}
