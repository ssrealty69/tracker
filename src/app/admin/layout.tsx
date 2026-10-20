'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Building2,
  LayoutDashboard,
  MapPin,
  TableProperties,
  LogOut,
  Menu,
  X,
  PhoneCall,
  UserCheck,
  HardHat,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/admin', label: 'Overview Dashboard', icon: LayoutDashboard },
  { href: '/admin/attendance', label: 'Site Attendance & Selfies', icon: UserCheck },
  { href: '/admin/site-staff', label: 'Site Staff & Projects', icon: HardHat },
  { href: '/admin/visits', label: 'Site Visits Center', icon: MapPin },
  { href: '/admin/leads', label: 'Leads & Dedup Grid', icon: TableProperties },
  { href: '/admin/settings', label: 'Form & Master Settings', icon: SlidersHorizontal },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 relative">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Floating Presentation Mode Toggle Button when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Show Sidebar"
          className="hidden lg:flex fixed top-4 left-2 z-50 items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
        >
          <ChevronRight size={13} />
        </button>
      )}

      {/* Sidebar - Fixed Sticky on Scroll & Collapsible */}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col bg-white border-r border-slate-200 shadow-xs transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
          ${collapsed ? 'lg:w-0 lg:overflow-hidden lg:border-none lg:opacity-0 lg:pointer-events-none' : 'lg:w-64 lg:opacity-100'}
        `}
      >
        {/* Logo & Collapse Button */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-slate-100 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[15px] font-extrabold text-slate-900 leading-tight">SS Realty</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Admin Portal</p>
            </div>
          </div>
          {/* Arrow toggle to hide sidebar for presentation mode */}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Hide Sidebar for Full-Screen Presentation Mode"
            className="hidden lg:flex w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 items-center justify-center text-slate-500 hover:text-slate-900 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" suppressHydrationWarning>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = mounted
              ? item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              : false;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                suppressHydrationWarning
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 space-y-1.5 bg-slate-50/50">
          <Link
            href="/"
            prefetch={false}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            <PhoneCall size={15} className="text-emerald-600" />
            Agent Calling Form
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-left"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Building2 size={16} />
            </div>
            <span className="text-sm font-bold text-slate-900">SS Realty Admin</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
