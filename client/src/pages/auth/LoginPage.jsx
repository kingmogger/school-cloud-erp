import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { getApiErrorMessage } from '../../api/client';
import { Button, FormField, inputClass } from '../../components/ui';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  schoolCode: z.string().optional(),
});

const ROLE_HOME = {
  super_admin: '/superadmin',
  school_admin: '/admin',
  faculty: '/faculty',
  student: '/student',
  parent: '/parent',
};

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'superadmin@schoolcloud.io', code: '' },
  { role: 'School Admin (Active)', email: 'admin@greenfield.edu', code: 'GREENFIELD' },
  { role: 'School Admin (Suspended)', email: 'admin@oakridge.edu', code: 'OAKRIDGE' },
  { role: 'Faculty (GF)', email: 'marcus.gf@greenfield.edu', code: 'GREENFIELD' },
  { role: 'Student (GF)', email: 'liam.gf@greenfield.edu', code: 'GREENFIELD' },
  { role: 'Parent (GF)', email: 'parent.gf@greenfield.edu', code: 'GREENFIELD' },
];

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', schoolCode: '' },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const { user: loggedUser, school } = await login(values.email, values.password, values.schoolCode);
      addToast(`Welcome back, ${loggedUser.name}`, 'success');
      if (loggedUser.role === 'school_admin' && school?.subscription?.isBlocked) {
        navigate('/admin/subscription', { replace: true });
      } else {
        navigate(ROLE_HOME[loggedUser.role] || '/', { replace: true });
      }
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  const fillDemo = (email, code) => {
    setValue('email', email);
    setValue('password', 'Password@123');
    setValue('schoolCode', code);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle color theme"
        className="fixed right-4 top-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">SchoolCloud SaaS ERP</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Multi-Tenant School Management & Academic Intelligence</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <div role="alert" className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {serverError}
              </div>
            )}

            <FormField label="Email Address" htmlFor="email" error={errors.email?.message} required>
              <input id="email" type="email" autoComplete="email" placeholder="you@school.edu" className={inputClass} {...register('email')} />
            </FormField>

            <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
              <input id="password" type="password" autoComplete="current-password" placeholder="••••••••" className={inputClass} {...register('password')} />
            </FormField>

            <FormField label="School Code (Optional)" htmlFor="schoolCode">
              <input id="schoolCode" type="text" placeholder="e.g. GREENFIELD" className={inputClass} {...register('schoolCode')} />
            </FormField>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <span>Quick Demo Accounts (Password@123)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.code)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{acc.role}</p>
                  <p className="truncate text-slate-500 dark:text-slate-400">{acc.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
