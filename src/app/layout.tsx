import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SS Realty CRM | Lead Pipeline & Visit Management',
  description: 'Real Estate Lead Pipeline & Site Visit Management CRM for SS Realty (ssrealty.org)',
  keywords: 'real estate, CRM, lead management, site visits, SS Realty',
  authors: [{ name: 'SS Realty' }],
  openGraph: {
    title: 'SS Realty CRM',
    description: 'Lead Pipeline & Visit Management System',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen font-sans selection:bg-indigo-600 selection:text-white" suppressHydrationWarning>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              fontSize: '13.5px',
              fontWeight: 500,
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#0f172a' },
              duration: 3500,
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#0f172a' },
              duration: 4000,
            },
          }}
        />
      </body>
    </html>
  );
}
