'use client';

import { User } from '@/types';

export function saveAuth(accessToken: string, refreshToken: string, user: User): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function getDashboardPath(role: string): string {
  if (role === 'tenant') return '/tenant/dashboard';
  if (role === 'landlord') return '/landlord/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/';
}
