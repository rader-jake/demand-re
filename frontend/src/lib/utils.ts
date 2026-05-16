import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function getScoreTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'A', color: 'text-emerald-600 bg-emerald-50' };
  if (score >= 65) return { label: 'B', color: 'text-blue-600 bg-blue-50' };
  if (score >= 50) return { label: 'C', color: 'text-amber-600 bg-amber-50' };
  return { label: 'D', color: 'text-red-600 bg-red-50' };
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName ?? '')[0] ?? ''}${(lastName ?? '')[0] ?? ''}`.toUpperCase();
}

export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}
