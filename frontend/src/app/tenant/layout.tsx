import AppShell from '@/components/shared/AppShell';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
