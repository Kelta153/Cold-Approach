'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppState } from '../../lib/state/app-state';
import { TopBar } from '../../components/TopBar';
import { Toast } from '../../components/Toast';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { role } = useAppState();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!role) {
      router.replace('/login');
      return;
    }
    if (role === 'operator' && pathname?.startsWith('/admin')) {
      router.replace('/review');
    }
  }, [role, pathname, router]);

  if (!role) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      {children}
      <Toast />
    </div>
  );
}
