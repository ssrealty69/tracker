'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. Please verify your admin email and password.');
      } else {
        router.push('/admin');
        router.refresh();
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 relative overflow-hidden text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Ambient subtle light glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20 mb-1">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">SS REALTY</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin Operations Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60 p-7 sm:p-8 space-y-6">
          <div className="flex items-center justify-center border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Administrator Sign In</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            {/* Email */}
            <div>
              <label className="form-label">
                <span>Admin Email Address</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  className="form-input !pl-11 text-sm font-medium"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="Enter admin email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  suppressHydrationWarning
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="form-label">
                <span>Password</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 z-10">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input !pl-11 !pr-11 text-sm font-medium"
                  style={{ paddingLeft: '2.85rem', paddingRight: '2.85rem' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  suppressHydrationWarning
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors p-1.5 z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-fade-in-up">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 mt-2 shadow-md shadow-indigo-600/20 active:scale-[0.99]"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-900 font-semibold transition-colors"
            >
              ← Back to Agent Calling Form
            </Link>
            <span className="text-[11px] text-slate-400 font-medium">SS Realty System</span>
          </div>
        </div>
      </div>
    </div>
  );
}
