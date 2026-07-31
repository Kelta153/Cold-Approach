'use client';

import { useEffect, useState } from 'react';
import type { UserRole } from '@outreach-engine/types';
import { createUser, getUsers, removeUser, resetUserPassword, type UserRow } from '../../../../lib/data/users';
import { badge } from '../../../../lib/badges';
import { useAppState } from '../../../../lib/state/app-state';
import { Badge } from '../../../../components/Badge';

const field = 'flex flex-col gap-1.5';
const labelCls = 'text-xs font-medium text-label';
const inputCls = 'rounded-control border border-border3 bg-bg px-2.5 py-2 text-[13px] text-text';

function roleBadge(role: UserRole) {
  return role === 'admin' ? badge('#e8a33d', 'admin') : badge('#6ea8fe', 'operator');
}

/** Shown once, right after a create or reset — the only moment the plaintext password exists
 * anywhere outside BetterAuth's hash. Closing this panel is the only way to dismiss it; there is
 * no way to see the password again afterward. */
function GeneratedPasswordPanel({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mb-[22px] rounded-[7px] p-4" style={{ background: 'rgba(63,206,138,.05)', border: '1px solid rgba(63,206,138,.35)' }}>
      <div className="mb-1 text-[13.5px] font-semibold">Password generated for {email}</div>
      <div className="mb-3 text-xs text-text-secondary">
        Copy this now and send it to them — it will not be shown again. Resetting later generates a new one.
      </div>
      <div className="flex items-center gap-2.5">
        <code className="flex-1 rounded-control border border-border3 bg-bg px-2.5 py-2 font-mono text-[13px] text-text">{password}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(password);
            setCopied(true);
          }}
          className="rounded-control border border-action bg-action px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-action-hover"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button onClick={onClose} className="rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[12.5px] text-text">
          Done
        </button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { userEmail, showToast } = useAppState();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [creating, setCreating] = useState(false);

  const refreshUsers = () => getUsers().then(setUsers);

  useEffect(() => {
    refreshUsers();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { user, generatedPassword } = await createUser({ email: email.trim(), name: name.trim() || undefined, role });
      setReveal({ email: user.email, password: generatedPassword });
      setShowAddUser(false);
      setEmail('');
      setName('');
      setRole('operator');
      refreshUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u: UserRow) => {
    if (!confirm(`Reset the password for ${u.email}? Their current password stops working immediately.`)) return;
    try {
      const { generatedPassword } = await resetUserPassword(u.id);
      setReveal({ email: u.email, password: generatedPassword });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset password.');
    }
  };

  const handleRemove = async (u: UserRow) => {
    if (!confirm(`Remove ${u.email}? They will no longer be able to sign in. This can't be undone.`)) return;
    try {
      await removeUser(u.id);
      showToast('User removed');
      refreshUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove user.');
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-[22px] oe:p-7">
        {reveal && (
          <GeneratedPasswordPanel email={reveal.email} password={reveal.password} onClose={() => setReveal(null)} />
        )}

        <div className="mb-4 flex items-center">
          <div className="text-[16px] font-semibold">Users</div>
          <div className="flex-1" />
          <button
            onClick={() => setShowAddUser((v) => !v)}
            className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] font-medium text-text hover:border-border-hover"
          >
            {showAddUser ? 'Cancel' : '+ New user'}
          </button>
        </div>

        {showAddUser && (
          <div className="mb-[22px] grid grid-cols-1 gap-3.5 rounded-[7px] border border-border2 bg-surface p-4 oe:grid-cols-[1fr_1fr_140px_auto]">
            <div className={field}>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputCls} />
            </div>
            <div className={field}>
              <label className={labelCls}>Display name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Defaults to the email's first part" className={inputCls} />
            </div>
            <div className={field}>
              <label className={labelCls}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={creating || !email.trim()}
                className="w-full rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 oe:w-auto"
              >
                {creating ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-[7px] border border-border2">
          <div className="grid min-w-[760px] grid-cols-[1fr_1fr_110px_140px_180px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
            <span>Email</span>
            <span>Name</span>
            <span>Role</span>
            <span>Created</span>
            <span></span>
          </div>
          {users.map((u) => {
            const isSelf = u.email === userEmail;
            return (
              <div key={u.id} className="grid min-w-[760px] grid-cols-[1fr_1fr_110px_140px_180px] items-center gap-3 border-b border-border px-3.5 py-2.5 text-[13px]">
                <span className="font-medium">{u.email}</span>
                <span className="text-text-secondary">{u.name || '—'}</span>
                <span><Badge spec={roleBadge(u.role)} /></span>
                <span className="text-[12.5px] text-text-secondary">{u.createdAt.slice(0, 10)}</span>
                <div className="flex items-center justify-end gap-2.5">
                  <button onClick={() => handleResetPassword(u)} className="text-[12px] text-text-muted hover:text-text">
                    Reset password
                  </button>
                  <button
                    onClick={() => handleRemove(u)}
                    disabled={isSelf}
                    title={isSelf ? "You can't remove your own account" : undefined}
                    className="text-[12px] text-text-muted hover:text-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-muted"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[13px] text-text-muted">No users yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
