'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, MapPin, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import { User } from '@/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Invalid email'),
  token: z.string().min(1, 'Token required'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/\d/, 'Must include a number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <ActivateForm />
    </Suspense>
  );
}

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: emailParam,
      token: tokenParam,
    },
  });

  const { useEffect } = require('react');

  useEffect(() => {
    if (!emailParam || !tokenParam) {
      setTokenError('Email and token are required in the activation link.');
      setChecking(false);
      return;
    }

    api.get(`/auth/activate?email=${encodeURIComponent(emailParam)}&token=${encodeURIComponent(tokenParam)}`)
      .then(res => {
        if (res.data.valid) {
          setName(res.data.name);
        } else {
          setTokenError(res.data.error || 'Invalid activation token.');
        }
      })
      .catch(err => {
        setTokenError(getErrorMessage(err) || 'Failed to verify activation token.');
      })
      .finally(() => setChecking(false));
  }, [emailParam, tokenParam]);

  const onSubmit = async (data: FormData) => {
    try {
      // POST to activate endpoint
      const res = await api.post('/auth/activate', {
        email: data.email,
        token: data.token,
        password: data.password,
      });

      const { accessToken, refreshToken, user } = res.data;
      saveAuth(accessToken, refreshToken, user as User);
      toast.success("Account activated successfully! Redirecting...");
      router.push('/tenant/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err) || "Failed to activate account");
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
          <p className="text-brand-300 font-medium text-sm">Verifying activation link...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-brand-900/80 border border-brand-800/60 p-8 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-red-950 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 font-extrabold text-2xl">
            !
          </div>
          <h2 className="text-xl font-bold text-white">Activation Failed</h2>
          <p className="text-brand-400 text-sm">{tokenError}</p>
          <Link href="/login" className="w-full btn-lg font-bold inline-block text-center btn-accent mt-2">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-950 flex overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 60%, rgba(59,130,246,0.2) 0%, transparent 55%), radial-gradient(circle at 75% 20%, rgba(245,158,11,0.12) 0%, transparent 50%)' }}
        />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-2xl tracking-tight">
              <span className="text-white">Demand</span>
              <span className="text-accent-400"> RE</span>
            </span>
          </Link>
        </div>
        <div className="relative space-y-5">
          <h2 className="text-3xl font-black text-white leading-tight">
            Activate Your<br />
            <span className="text-accent-400">Demand RE Account</span>
          </h2>
          <div className="space-y-3">
            {[
              'Track your space requirements',
              'Receive curated matching opportunities',
              'Update your requirements anytime',
              'Directly connect with NYC landlords',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-sm text-brand-300">
                <CheckCircle className="w-4 h-4 text-accent-400 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-brand-600">demand-re.com</div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto min-w-0">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-xl tracking-tight">
                <span className="text-white">Demand</span>
                <span className="text-accent-400"> RE</span>
              </span>
            </Link>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-black text-white">
              {name ? `Welcome, ${name}!` : 'Activate your account'}
            </h1>
            <p className="text-brand-400 text-sm mt-1">Set a password to secure your tenant demand profile</p>
          </div>

          <div className="bg-brand-900/80 border border-brand-800/60 rounded-2xl p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              
              {/* Email (prefilled and locked) */}
              <div className="form-group">
                <label className="label !text-brand-300">Email address</label>
                <input
                  type="email"
                  value={emailParam}
                  disabled
                  className="input !bg-brand-800/30 !border-brand-800 !text-brand-400 cursor-not-allowed"
                />
                <input type="hidden" {...register('email')} />
              </div>

              {/* Token (hidden) */}
              <input type="hidden" {...register('token')} />

              {/* Password */}
              <div className="form-group">
                <label className="label !text-brand-300">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="label !text-brand-300">Confirm Password</label>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-lg font-bold mt-1 btn-accent"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Activate account'}
              </button>
            </form>
          </div>

          <p className="text-center text-brand-500 text-sm mt-6">
            Already activated?{' '}
            <Link href="/login" className="text-accent-400 hover:text-accent-300 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
