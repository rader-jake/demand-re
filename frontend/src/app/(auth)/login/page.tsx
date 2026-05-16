'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { authApi, getErrorMessage } from '@/lib/api';
import { saveAuth, getDashboardPath } from '@/lib/auth';
import { User } from '@/types';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password);
      const { accessToken, refreshToken, user } = res.data;
      saveAuth(accessToken, refreshToken, user as User);
      toast.success(`Welcome back, ${user.firstName}!`);
      router.push(getDashboardPath(user.role));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 flex overflow-hidden">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(59,130,246,0.2) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245,158,11,0.1) 0%, transparent 50%)' }}
        />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <MapPin className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-2xl tracking-tight">
              <span className="text-white">Demand</span>
              <span className="text-accent-400"> RE</span>
            </span>
          </Link>
        </div>
        <div className="relative space-y-6">
          <blockquote className="text-2xl font-bold text-white leading-snug">
            "NYC&apos;s most qualified tenants,<br />
            <span className="text-accent-400">all in one place.</span>"
          </blockquote>
          <div className="flex gap-4">
            {[
              { v: '500+', l: 'Active tenants' },
              { v: '40+', l: 'Neighborhoods' },
              { v: '$85', l: 'Avg PSF budget' },
            ].map((s) => (
              <div key={s.l} className="bg-brand-900/60 rounded-2xl px-4 py-3 border border-brand-800/60">
                <div className="text-xl font-black text-accent-400">{s.v}</div>
                <div className="text-xs text-brand-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-brand-600">demand-re.com</div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
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

          <div className="mb-8">
            <h1 className="text-2xl font-black text-white">Welcome back</h1>
            <p className="text-brand-400 text-sm mt-1">Sign in to your Demand RE account</p>
          </div>

          <div className="bg-brand-900/80 border border-brand-800/60 rounded-2xl p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="form-group">
                <label className="label !text-brand-300">Email address</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500 focus:!ring-brand-600"
                />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

              <div className="form-group">
                <label className="label !text-brand-300">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    className="input !bg-brand-800/60 !border-brand-700/60 !text-white placeholder:!text-brand-500 focus:!border-brand-500 focus:!ring-brand-600 pr-10"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full btn-lg !bg-brand-600 hover:!bg-brand-500 mt-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-brand-500 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-accent-400 hover:text-accent-300 font-semibold">
              Get started free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
