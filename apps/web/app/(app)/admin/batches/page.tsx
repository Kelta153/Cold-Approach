'use client';

import { useEffect, useState } from 'react';
import type { BatchDto } from '@outreach-engine/types';
import {
  getBatches,
  getProductOptions,
  getTargetingProfileOptions,
  runBatch,
  type ProductOption,
  type TargetingProfileOption,
} from '../../../../lib/data/batches';
import { getHealth, type HealthStatus } from '../../../../lib/data/health';
import { statusBadge } from '../../../../lib/badges';
import { useAppState } from '../../../../lib/state/app-state';
import { Badge } from '../../../../components/Badge';

const field = 'flex flex-col gap-1.5';
const labelCls = 'text-xs font-medium text-label';
const inputCls = 'rounded-control border border-border3 bg-bg px-2.5 py-2 text-[13px] text-text';

const IN_PROGRESS: BatchDto['status'][] = ['discovering', 'enriching', 'drafting'];

// This is the one screen an admin would actually check when a batch stops progressing, so it's
// the natural place for a visible Redis-health signal. 60s keeps the extra load this polling adds
// on the real /health -> Redis PING small and predictable (~1,440 extra Redis commands/day if
// left open all day) while still surfacing an outage well before anyone would think to look at
// server logs.
const HEALTH_POLL_MS = 60_000;

export default function AdminBatchesPage() {
  const { adminLineId, showToast } = useAppState();
  const [rows, setRows] = useState<BatchDto[]>([]);
  const [profiles, setProfiles] = useState<TargetingProfileOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const [profileId, setProfileId] = useState('');
  const [productId, setProductId] = useState('');
  const [geography, setGeography] = useState('');
  const [sizeRequested, setSizeRequested] = useState(10);
  const [running, setRunning] = useState(false);

  const refreshBatches = () => {
    if (!adminLineId) return;
    getBatches(adminLineId).then(setRows);
  };

  useEffect(() => {
    if (!adminLineId) return;
    refreshBatches();
    getTargetingProfileOptions(adminLineId).then((ps) => {
      setProfiles(ps);
      setProfileId((prev) => prev || ps.find((p) => p.active)?.id || ps[0]?.id || '');
    });
    getProductOptions(adminLineId).then((ps) => {
      setProducts(ps);
      setProductId((prev) => prev || ps.find((p) => p.active)?.id || ps[0]?.id || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLineId]);

  // Poll while anything is still discovering/enriching/drafting so the funnel/status columns
  // update live without a manual refresh — this is a real, in-flight BullMQ pipeline.
  useEffect(() => {
    if (!rows.some((r) => IN_PROGRESS.includes(r.status))) return;
    const timer = setInterval(refreshBatches, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, adminLineId]);

  // Redis can stay "connected" (so nothing else here would notice) while every command it's
  // asked to run is rejected — e.g. Upstash's monthly command quota being exhausted. Without this,
  // a triggered batch just silently never progresses past "discovering" with no visible signal.
  useEffect(() => {
    const check = () => getHealth().then(setHealth).catch(() => setHealth({ status: 'degraded', redis: { ok: false, error: 'Could not reach the API.' } }));
    check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const handleRun = async () => {
    if (!profileId || !productId || !geography.trim()) {
      showToast('Pick a targeting profile, a product, and a geography.');
      return;
    }
    setRunning(true);
    try {
      await runBatch(adminLineId, { profileId, productId, geography: geography.trim(), sizeRequested });
      showToast('Batch started — discovery is running against Google Places.');
      setGeography('');
      refreshBatches();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start batch.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-[22px] oe:p-7">
        {health && !health.redis.ok && (
          <div
            className="mb-[22px] flex items-start gap-2.5 rounded-md p-[11px_14px]"
            style={{ background: 'rgba(232,163,61,.08)', border: '1px solid rgba(232,163,61,.35)' }}
          >
            <span className="text-[13px] leading-[1.4] text-amber">◆</span>
            <div className="text-[12.5px] text-amber-soft">
              <b className="font-semibold text-amber">Redis is unavailable — triggered batches will not progress.</b>
              <div className="mt-1">{health.redis.error ?? 'Redis commands are currently failing.'}</div>
              <div className="mt-1">Batches will still create a row here, but discovery/enrichment/drafting won&apos;t run until this clears.</div>
            </div>
          </div>
        )}

        <div className="mb-4 text-[16px] font-semibold">Run a batch</div>
        <div className="mb-[22px] grid grid-cols-1 gap-3.5 rounded-[7px] border border-border2 bg-surface p-4 oe:grid-cols-[1fr_1fr_1fr_90px_auto]">
          <div className={field}>
            <label className={labelCls}>Targeting profile</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={inputCls}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label className={labelCls}>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label className={labelCls}>Geography</label>
            <input value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="e.g. Bristol, UK" className={inputCls} />
          </div>
          <div className={field}>
            <label className={labelCls}>Size</label>
            <input
              type="number"
              min={1}
              max={20}
              value={sizeRequested}
              onChange={(e) => setSizeRequested(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleRun}
              disabled={running || profiles.length === 0 || products.length === 0}
              className="w-full rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 oe:w-auto"
            >
              {running ? 'Starting…' : 'Run batch'}
            </button>
          </div>
        </div>

        <div className="mb-4 text-[16px] font-semibold">Batch history</div>
        <div className="overflow-x-auto rounded-[7px] border border-border2">
          <div className="grid min-w-[880px] grid-cols-[130px_110px_1fr_280px_140px_110px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
            <span>Batch</span>
            <span>Date</span>
            <span>Targeting profile</span>
            <span>Funnel · disc → enr → draft → sent</span>
            <span>API calls</span>
            <span>Status</span>
          </div>
          {rows.map((b) => (
            <div key={b.id} className="grid min-w-[880px] grid-cols-[130px_110px_1fr_280px_140px_110px] items-center gap-3 border-b border-border px-3.5 py-3 text-[13px]">
              <span className="font-mono text-[11.5px] text-link2">{b.id.slice(0, 8)}</span>
              <span className="text-[12.5px] text-text-secondary">{b.date}</span>
              <span className="font-medium">{b.profile}</span>
              <span className="font-mono text-xs text-body">{b.funnelLabel}</span>
              <span className="font-mono text-xs">{b.apiSpendLabel}</span>
              <Badge spec={statusBadge(b.status)} />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[13px] text-text-muted">No batches yet — run one above.</div>
          )}
        </div>
      </div>
    </div>
  );
}
