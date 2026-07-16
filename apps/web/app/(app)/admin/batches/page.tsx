'use client';

import { useEffect, useState } from 'react';
import type { BatchDto } from '@outreach-engine/types';
import { getBatches } from '../../../../lib/data/admin';
import { batchStats as batchStatsFixture } from '../../../../lib/mock-data';
import { statusBadge } from '../../../../lib/badges';
import { useAppState } from '../../../../lib/state/app-state';
import { Badge } from '../../../../components/Badge';

export default function AdminBatchesPage() {
  const { adminLineId } = useAppState();
  const [rows, setRows] = useState<BatchDto[]>([]);

  useEffect(() => {
    getBatches(adminLineId).then(({ rows }) => setRows(rows));
  }, [adminLineId]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-[22px] oe:p-7">
        <div className="mb-4 text-[16px] font-semibold">Batch history</div>

        <div className="mb-[22px] grid grid-cols-2 gap-3 oe:grid-cols-4">
          {batchStatsFixture.map((st) => (
            <div key={st.label} className="rounded-[7px] border border-border2 bg-surface p-3.5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{st.label}</div>
              <div className="font-mono text-[22px] font-semibold tracking-tight">{st.value}</div>
              <div className="mt-0.5 text-[11.5px] text-text-secondary">{st.sub}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-[7px] border border-border2">
          <div className="grid min-w-[880px] grid-cols-[130px_110px_1fr_280px_100px_90px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
            <span>Batch</span>
            <span>Date</span>
            <span>Targeting profile</span>
            <span>Funnel · disc → enr → draft → sent</span>
            <span>API spend</span>
            <span>Status</span>
          </div>
          {rows.map((b) => (
            <div key={b.id} className="grid min-w-[880px] grid-cols-[130px_110px_1fr_280px_100px_90px] items-center gap-3 border-b border-border px-3.5 py-3 text-[13px]">
              <span className="font-mono text-[11.5px] text-link2">{b.id}</span>
              <span className="text-[12.5px] text-text-secondary">{b.date}</span>
              <span className="font-medium">{b.profile}</span>
              <span className="font-mono text-xs text-body">{b.funnelLabel}</span>
              <span className="font-mono text-xs">{b.apiSpendLabel}</span>
              <Badge spec={statusBadge(b.status)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
