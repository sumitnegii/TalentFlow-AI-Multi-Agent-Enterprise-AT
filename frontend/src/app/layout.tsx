import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import ConditionalLayout from '@/components/ConditionalLayout';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata: Metadata = {
  title: 'TalentFlow — AI Recruitment Platform',
  description: 'Hire smarter with TalentFlow — AI-powered applicant tracking, multi-agent evaluation, and end-to-end workflow automation.',
  keywords: ['ATS', 'AI Recruitment', 'Applicant Tracking', 'HR', 'Hiring'],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${outfit.variable}`}>
        {/* Animated Background */}
        <div className="bg-animated" aria-hidden="true">
          <div className="bg-blob bg-blob-1" />
          <div className="bg-blob bg-blob-2" />
          <div className="bg-blob bg-blob-3" />
          <div className="bg-blob bg-blob-4" />
        </div>
        <div className="bg-grid" aria-hidden="true" />

        {/* ConditionalLayout decides whether to show sidebar or not */}
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
