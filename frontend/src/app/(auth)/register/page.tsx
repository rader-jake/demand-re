'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, MapPin, Users, Home, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, getErrorMessage } from '@/lib/api';
import { saveAuth, getDashboardPath } from '@/lib/auth';
import { User } from '@/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  role: z.enum(['tenant', 'landlord']),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/\d/, 'Must include a number'),
  agreeTerms: z.boolean().refine(v => v === true, 'You must agree to the Terms of Service'),
  agreeData: z.boolean().refine(v => v === true, 'You must acknowledge the data policy'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = (searchParams.get('role') as 'tenant' | 'landlord') || 'tenant';
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  });

  const role = watch('role');

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register(data as { email: string; password: string; role: string; firstName: string; lastName: string });
      const { accessToken, refreshToken, user } = res.data;
      saveAuth(accessToken, refreshToken, user as User);
      toast.success("Account created! Let's set up your profile.");
      router.push(data.role === 'tenant' ? '/tenant/onboarding' : getDashboardPath(data.role));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

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
            The smartest way to<br />
            <span className="text-accent-400">lease commercial space</span><br />
            in New York City.
          </h2>
          <div className="space-y-3">
            {[
              'Free to join — no listing fees',
              'Verified tenants with real financial data',
              'Proprietary Desirability Index scoring',
              'Deal pipeline CRM built in',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-sm text-brand-300">
                <CheckCircle className="w-4 h-4 text-accent-400 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-brand-600">demandre.ai</div>
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
            <h1 className="text-2xl font-black text-white">Create your account</h1>
            <p className="text-brand-400 text-sm mt-1">Join NYC&apos;s tenant-driven CRE platform</p>
          </div>

          <div className="bg-brand-900/80 border border-brand-800/60 rounded-2xl p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Role selector */}
              <div className="form-group">
                <label className="label !text-brand-300">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'tenant', label: 'Tenant / Business', icon: Users, desc: 'Looking for space' },
                    { value: 'landlord', label: 'Landlord / Broker', icon: Home, desc: 'Finding tenants' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('role', opt.value as 'tenant' | 'landlord')}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                        role === opt.value
                          ? opt.value === 'tenant'
                            ? 'border-accent-400 bg-accent-400/10 text-white'
                            : 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-brand-800 bg-brand-800/40 text-brand-400 hover:border-brand-700'
                      )}
                    >
                      <opt.icon className={cn('w-5 h-5', role === opt.value && opt.value === 'tenant' ? 'text-accent-400' : role === opt.value ? 'text-brand-400' : '')} />
                      <div>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register('role')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label !text-brand-300">First name</label>
                  <input
                    {...register('firstName')}
                    type="text"
                    autoComplete="given-name"
                    className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500"
                  />
                  {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
                </div>
                <div className="form-group">
                  <label className="label !text-brand-300">Last name</label>
                  <input
                    {...register('lastName')}
                    type="text"
                    autoComplete="family-name"
                    className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500"
                  />
                  {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="label !text-brand-300">Work email</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500"
                />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

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

              {/* Legal agreements */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    {...register('agreeTerms')}
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-brand-700 bg-brand-800 text-brand-500 focus:ring-brand-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-brand-400 group-hover:text-brand-300 leading-relaxed">
                    I agree to the{' '}
                    <Link href="/legal/terms" target="_blank" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                      Terms of Service
                    </Link>
                    , including that Demand RE owns all platform data and activity.
                  </span>
                </label>
                {errors.agreeTerms && <p className="error-text">{errors.agreeTerms.message}</p>}

                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    {...register('agreeData')}
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-brand-700 bg-brand-800 text-brand-500 focus:ring-brand-500 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-brand-400 group-hover:text-brand-300 leading-relaxed">
                    I have read and agree to the{' '}
                    <Link href="/legal/privacy" target="_blank" className="text-accent-400 hover:text-accent-300 underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    , including the collection and use of my data.
                  </span>
                </label>
                {errors.agreeData && <p className="error-text">{errors.agreeData.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  'w-full btn-lg font-bold mt-1',
                  role === 'tenant' ? 'btn-accent' : 'btn-primary'
                )}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create account'}
              </button>
            </form>
          </div>

          <p className="text-center text-brand-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-400 hover:text-accent-300 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
