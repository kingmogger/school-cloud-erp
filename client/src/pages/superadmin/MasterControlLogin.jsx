import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  Lock,
  KeyRound,
  Terminal,
  Activity,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getApiErrorMessage } from '../../api/client';
import { Button } from '../../components/ui';

const rootLoginSchema = z.object({
  email: z.string().email('Enter a valid administrator email'),
  password: z.string().min(6, 'Password required'),
});

export function MasterControlLogin() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(rootLoginSchema),
    defaultValues: {
      email: 'superadmin@schoolcloud.io',
      password: 'Password@123',
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const user = await login(values.email, values.password, '');
      if (user.role !== 'super_admin') {
        setServerError('ACCESS DENIED: This account does not possess Super Administrator root privileges.');
        return;
      }
      addToast('Root Administrator authenticated successfully', 'success');
      navigate('/master-control');
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  const handleQuickConnect = () => {
    setValue('email', 'superadmin@schoolcloud.io');
    setValue('password', 'Password@123');
    handleSubmit(onSubmit)();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-violet-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-600/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 p-0.5 shadow-xl shadow-cyan-500/20">
            <div className="h-full w-full rounded-[14px] bg-slate-950 flex items-center justify-center">
              <Shield className="h-7 w-7 text-cyan-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">StudyX Platform OS</h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                ROOT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Master Control Console & Tenant Orchestration Engine</p>
          </div>
        </div>

        {/* Security Notice Card */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold">Restricted Platform Access:</span> This terminal is reserved exclusively for the Master System Administrator. All session activities and database alterations are recorded.
          </div>
        </div>

        {/* Login Form Container */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-5">
          {serverError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Administrator Identifier
              </label>
              <div className="relative">
                <input
                  type="email"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                  placeholder="superadmin@schoolcloud.io"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-400 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Master Security Key
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                  placeholder="••••••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400 font-medium">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Authenticating Root Key...</span>
              ) : (
                <>
                  <span>Access Master Control Console</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Connect Helper */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleQuickConnect}
              disabled={isSubmitting}
              className="w-full py-2 px-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Quick Connect: Demo Super Admin</span>
            </button>
          </div>
        </div>

        {/* School ERP Portal Switcher Link */}
        <div className="text-center text-xs text-slate-500">
          Looking for teacher, student, or school admin portal?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium underline">
            Go to School ERP Login
          </Link>
        </div>
      </div>
    </div>
  );
}
