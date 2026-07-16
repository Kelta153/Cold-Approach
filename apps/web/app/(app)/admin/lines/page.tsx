'use client';

import { useAppState } from '../../../../lib/state/app-state';
import { badge } from '../../../../lib/badges';
import { Badge } from '../../../../components/Badge';
import { Switch } from '../../../../components/admin/Switch';

const sectionLabel = 'mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted';
const card = 'mb-[22px] rounded-[7px] border border-border2 bg-surface p-4';
const field = 'flex flex-col gap-1.5';
const labelCls = 'text-xs font-medium text-label';
const readonlyInput = 'rounded-control border border-border3 bg-bg px-2.5 py-2 text-[13px] text-text';

export default function AdminLinesPage() {
  const { lines, adminLineId, setAdminLineId, warm, toggleWarm, channels, toggleChannel } = useAppState();

  const line = lines.find((l) => l.id === adminLineId) ?? lines[0];
  const warmOn = warm[adminLineId];
  const ch = channels[adminLineId] ?? { email: true, ig: false };

  if (!line) return null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto oe:grid-cols-[260px_1fr] oe:overflow-visible">
      <div className="border-b border-border bg-surface2 p-3.5 oe:border-b-0 oe:border-r">
        <div className="mb-3 px-2 text-[14px] font-semibold">Business lines</div>
        {lines.map((ln) => {
          const wb = warm[ln.id] ? badge('#3fce8a', 'live') : badge('#e8a33d', 'warm-up');
          return (
            <button
              key={ln.id}
              onClick={() => setAdminLineId(ln.id)}
              className="mb-[3px] flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-text"
              style={{ borderColor: ln.id === adminLineId ? 'var(--oe-border-selected)' : 'transparent', background: ln.id === adminLineId ? 'var(--oe-selected-bg)' : 'transparent' }}
            >
              <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: ln.color }} />
              <span className="flex-1 text-left text-[13px] font-semibold">{ln.name}</span>
              <Badge spec={wb} />
            </button>
          );
        })}
        <button className="mt-2 w-full rounded-md border border-dashed border-border3 p-2.5 text-[12.5px] text-text-muted hover:border-border-hover hover:text-label">
          + New business line
        </button>
      </div>

      <div className="overflow-y-auto p-6 oe:p-7">
        <div className="max-w-[640px]">
          <div className="mb-0.5 text-[18px] font-semibold tracking-tight">{line.name}</div>
          <div className="mb-6 font-mono text-[11px] text-text-muted">{line.id}</div>

          <div className={sectionLabel}>Brand identity</div>
          <div className={`${card} grid grid-cols-1 gap-3.5 oe:grid-cols-2`}>
            <div className={field}>
              <label className={labelCls}>Brand name</label>
              <input value={line.name} readOnly className={readonlyInput} />
            </div>
            <div className={field}>
              <label className={labelCls}>From name</label>
              <input value={line.senderName} readOnly className={readonlyInput} />
            </div>
            <div className={`${field} col-span-full`}>
              <label className={labelCls}>One-line positioning</label>
              <input value={line.positioning} readOnly className={readonlyInput} />
            </div>
          </div>

          <div className={sectionLabel}>Sending</div>
          <div className={card}>
            <div className={`${field} mb-3.5`}>
              <label className={labelCls}>Sending domain</label>
              <input value={line.sendingDomain} readOnly className={`${readonlyInput} font-mono text-[12.5px] text-link`} />
            </div>
            <label className={`${labelCls} mb-1.5 block`}>Inboxes</label>
            <div className="flex flex-wrap gap-1.5">
              {line.inboxes.map((ib) => (
                <span key={ib.addr} className="inline-flex items-center gap-1.5 rounded-[4px] border border-border3 bg-bg px-2.5 py-1.5 font-mono text-[11.5px] text-body">
                  {ib.addr}
                  <span
                    className="text-[9.5px] font-semibold uppercase tracking-wide"
                    style={{ color: ib.warmupStatus === 'warm' ? '#3fce8a' : '#e8a33d' }}
                  >
                    {ib.warmupStatus}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className={sectionLabel}>Compliance footer</div>
          <div className={`${card} grid grid-cols-1 gap-3.5 oe:grid-cols-2`}>
            <div className={field}>
              <label className={labelCls}>Legal entity</label>
              <input value={line.companyLegalName} readOnly className={readonlyInput} />
            </div>
            <div className={field}>
              <label className={labelCls}>Postal address</label>
              <input value={line.postalAddress ?? ''} readOnly placeholder="Not set" className={readonlyInput} />
              {!line.postalAddress && (
                <div className="text-[11px] text-amber">Missing — blocks all sends for this line until set.</div>
              )}
            </div>
            <div className={`${field} col-span-full`}>
              <label className={labelCls}>Unsubscribe copy</label>
              <input value={line.unsubscribeCopy} readOnly className={readonlyInput} />
            </div>
          </div>

          <div className={sectionLabel}>Channels &amp; pacing</div>
          <div className={card}>
            <div className="mb-4 flex gap-6">
              <div className="flex items-center gap-2.5">
                <Switch on={ch.email} color="#3b6fe0" onToggle={() => toggleChannel(line.id, 'email')} />
                <span className="text-[13px] font-medium text-text">Email</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch on={ch.ig} color="#c2508f" onToggle={() => toggleChannel(line.id, 'ig')} />
                <span className="text-[13px] font-medium text-text">Instagram DM</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3.5 oe:grid-cols-3">
              <div className={field}>
                <label className={labelCls}>Daily cap / line</label>
                <input value={line.dailyCapPerLine} readOnly className={`${readonlyInput} font-mono`} />
              </div>
              <div className={field}>
                <label className={labelCls}>Cap / inbox</label>
                <input value={line.capPerInbox} readOnly className={`${readonlyInput} font-mono`} />
              </div>
              <div className={field}>
                <label className={labelCls}>Min gap (sec)</label>
                <input value={line.minGapSeconds} readOnly className={`${readonlyInput} font-mono`} />
              </div>
            </div>
          </div>

          <div
            className="rounded-[7px] p-4"
            style={{
              background: warmOn ? 'rgba(63,206,138,.05)' : 'rgba(232,163,61,.05)',
              border: `1px solid ${warmOn ? 'rgba(63,206,138,.35)' : 'rgba(232,163,61,.4)'}`,
            }}
          >
            <div className="flex items-center gap-3.5">
              <Switch on={warmOn} color="#3fce8a" onToggle={() => toggleWarm(line.id)} />
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">Warm-up complete</div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {warmOn
                    ? 'Inboxes on this line have completed warm-up. Approved messages send for real.'
                    : 'Warm-up in progress — approved messages are held. Flipping this enables real sending.'}
                </div>
              </div>
              <Badge spec={warmOn ? badge('#3fce8a', 'sending enabled') : badge('#e8a33d', 'sending gated')} />
            </div>
            <div className="mt-3 border-t border-border3 pt-3 font-mono text-[10.5px] text-text-muted">
              this flag gates real sending · queue items stay in &quot;blocked&quot; until enabled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
