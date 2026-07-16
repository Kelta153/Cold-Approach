'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppState, type Role } from '../../lib/state/app-state';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme, signIn } = useAppState();
  const [email, setEmail] = useState('kay@balbusgroup.co.uk');
  const [pickedRole, setPickedRole] = useState<Role>('operator');

  const segmentStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: 'inherit',
    background: active ? 'var(--oe-segment-active-bg)' : 'transparent',
    color: active ? 'var(--oe-text)' : 'var(--oe-text-secondary)',
  });

  const onSignIn = () => {
    signIn(email, pickedRole);
    router.replace('/review');
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center"
      style={{ background: 'radial-gradient(ellipse 900px 500px at 50% -10%, var(--oe-raised) 0%, var(--oe-bg) 60%)' }}
    >
      <button
        onClick={toggleTheme}
        className="absolute right-[18px] top-[18px] rounded-control border border-border3 bg-raised px-3 py-1.5 text-xs text-text-secondary hover:text-text hover:border-border-hover"
      >
        {theme === 'light' ? '☾ Dark' : '☀ Light'}
      </button>

      <div className="w-[380px]" style={{ maxWidth: 'calc(100vw - 32px)' }}>
        <div className="mb-[26px] flex flex-col items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="Outreach Engine logo"
            width={88}
            height={88}
            className="rounded-[16px] bg-white object-cover"
          />
          <div className="text-[17px] font-semibold tracking-tight">Outreach Engine</div>
        </div>

        <div className="rounded-card border border-border2 bg-surface p-7">
          <div className="mb-1 text-[17px] font-semibold">Sign in</div>
          <div className="mb-[22px] text-[13px] text-text-secondary">Operator console access</div>

          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-control border border-border3 bg-bg px-[11px] py-[9px] text-[13.5px] text-text"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-label">Password</label>
              <input
                type="password"
                value="demo-password"
                readOnly
                className="rounded-control border border-border3 bg-bg px-[11px] py-[9px] text-[13.5px] text-text"
              />
            </div>
            <div className="mt-0.5 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-label">Sign in as</label>
              <div className="flex overflow-hidden rounded-control border border-border3">
                <button onClick={() => setPickedRole('operator')} style={segmentStyle(pickedRole === 'operator')}>
                  Operator
                </button>
                <button onClick={() => setPickedRole('admin')} style={segmentStyle(pickedRole === 'admin')}>
                  Admin
                </button>
              </div>
              <div className="text-[11.5px] text-text-muted">
                {pickedRole === 'admin'
                  ? 'Queues + line management, templates, targeting, batches.'
                  : 'Queues only — review, replies, Instagram.'}
              </div>
            </div>
            <button
              onClick={onSignIn}
              className="mt-2 rounded-control border border-action bg-action py-[10px] text-[13.5px] font-semibold text-white hover:bg-action-hover"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
