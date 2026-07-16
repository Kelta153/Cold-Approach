'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { badge } from '../lib/badges';
import { useAppState } from '../lib/state/app-state';
import { Badge } from './Badge';

interface NavItem {
  href: string;
  label: string;
  count?: number;
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    role, userEmail, theme, toggleTheme, signOut,
    lines, activeLineId, activeLine, switchLine, lineMenuOpen, setLineMenuOpen,
    reviewItems, replyItems, dmItems, isDecided,
  } = useAppState();

  const pendingCount = (queue: 'review' | 'reply' | 'dm', items: { id: string }[]) =>
    items.filter((it) => !isDecided(queue, it.id)).length;

  const navItems: NavItem[] = [
    { href: '/review', label: 'Review', count: pendingCount('review', reviewItems) },
    { href: '/replies', label: 'Replies', count: pendingCount('reply', replyItems) },
    { href: '/instagram', label: 'Instagram', count: pendingCount('dm', dmItems) },
    ...(role === 'admin'
      ? [
          { href: '/admin/lines', label: 'Lines' },
          { href: '/admin/catalogue', label: 'Catalogue & Templates' },
          { href: '/admin/batches', label: 'Batches' },
        ]
      : []),
  ];

  const roleBadge = role === 'admin' ? badge('#e8a33d', 'admin') : badge('#6ea8fe', 'operator');

  return (
    <div className="relative z-40 flex min-h-[52px] flex-none flex-wrap items-center gap-2.5 border-b border-border bg-surface2 px-3 py-2 oe:h-[52px] oe:flex-nowrap oe:gap-4 oe:px-4 oe:py-0">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.jpeg" alt="Outreach Engine" width={26} height={26} className="rounded-[5px] bg-white object-cover" />
      </div>

      <div className="relative">
        <button
          onClick={() => setLineMenuOpen(!lineMenuOpen)}
          className="flex items-center gap-2.5 rounded-md border border-border3 bg-raised px-[11px] py-1.5 text-text hover:border-border-hover"
        >
          <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: activeLine?.color ?? '#8a90a1' }} />
          <span className="text-[13px] font-semibold">{activeLine?.name}</span>
          <span className="font-mono text-[10.5px] text-text-muted">{activeLineId}</span>
          <span className="text-[10px] text-text-muted">▾</span>
        </button>

        {lineMenuOpen && (
          <div className="absolute left-0 top-10 w-[280px] rounded-[7px] border border-border3 p-[5px]" style={{ background: 'var(--oe-raised)', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>
            <div className="px-2.5 pb-[5px] pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">Business lines</div>
            {lines.map((ln) => (
              <button
                key={ln.id}
                onClick={() => switchLine(ln.id)}
                className="flex w-full items-center gap-2.5 rounded-md border-none px-2.5 py-2 text-left hover:bg-raised2"
                style={{ background: ln.id === activeLineId ? 'var(--oe-selected-bg)' : 'transparent' }}
              >
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: ln.color }} />
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold text-text">{ln.name}</span>
                  <span className="block font-mono text-[10.5px] text-text-muted">{ln.id}</span>
                </span>
                {ln.id === activeLineId && <span className="text-xs text-green">✓</span>}
              </button>
            ))}
            <div className="mt-1 border-t border-border2 px-2.5 py-2 text-[11px] text-text-muted">
              All queues and admin data are scoped to the active line.
            </div>
          </div>
        )}
      </div>

      <div className="hidden h-[22px] w-px bg-border2 oe:block" />

      <div className="order-10 flex basis-full gap-0.5 overflow-x-auto oe:order-none oe:basis-auto">
        {navItems.map((nv) => {
          const active = pathname?.startsWith(nv.href);
          return (
            <Link
              key={nv.href}
              href={nv.href}
              className="mb-[-1px] inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-[13px]"
              style={{
                borderColor: active ? '#3b6fe0' : 'transparent',
                color: active ? 'var(--oe-text)' : 'var(--oe-text-secondary)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {nv.label}
              {typeof nv.count === 'number' && nv.count > 0 && (
                <span
                  className="ml-1.5 rounded-full px-1.5 py-px font-mono text-[10px]"
                  style={{ background: active ? 'rgba(110,168,254,.15)' : 'var(--oe-raised2)', color: active ? '#8ab4ff' : 'var(--oe-text-secondary)' }}
                >
                  {nv.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <button onClick={toggleTheme} className="rounded-control border border-border3 px-2.5 py-1 text-xs text-text-secondary hover:border-border-hover hover:text-text">
        {theme === 'light' ? '☾ Dark' : '☀ Light'}
      </button>
      <Badge spec={roleBadge} />
      <div className="hidden text-[12.5px] text-text-secondary oe:block">{userEmail}</div>
      <button
        onClick={() => {
          signOut();
          router.replace('/login');
        }}
        className="rounded-control border border-border3 px-2.5 py-1 text-xs text-text-secondary hover:border-border-hover hover:text-text"
      >
        Sign out
      </button>
    </div>
  );
}
