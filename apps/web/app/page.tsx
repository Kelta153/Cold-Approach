'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '../lib/state/app-state';

export default function RootPage() {
  const router = useRouter();
  const { role } = useAppState();

  useEffect(() => {
    router.replace(role ? '/review' : '/login');
  }, [role, router]);

  return null;
}
