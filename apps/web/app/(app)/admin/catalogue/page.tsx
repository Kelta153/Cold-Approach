'use client';

import { useEffect, useState } from 'react';
import type { CatalogueRowDto, TargetingRowDto } from '@outreach-engine/types';
import { getCatalogue, getTargeting, getTemplates } from '../../../../lib/data/admin';
import { templateNames, tokens } from '../../../../lib/mock-data';
import { statusBadge } from '../../../../lib/badges';
import { useAppState } from '../../../../lib/state/app-state';
import { Badge } from '../../../../components/Badge';
import type { TemplateDto } from '@outreach-engine/types';

const TABS = [
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'templates', label: 'Templates' },
  { key: 'targeting', label: 'Targeting profiles' },
] as const;

const TEMPLATE_CHANNEL_LABEL: Record<string, string> = {
  email_outbound: 'email',
  email_reply: 'email',
  instagram_dm: 'instagram',
};

function tabButtonStyle(active: boolean) {
  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--oe-text)' : 'var(--oe-text-secondary)',
    borderBottom: `2px solid ${active ? '#3b6fe0' : 'transparent'}`,
    marginBottom: -1,
    fontFamily: 'inherit',
  } as const;
}

export default function AdminCataloguePage() {
  const { adminLineId, adminTab, setAdminTab, tplId, setTplId, tplDrafts, setTplDraft, showToast } = useAppState();
  const [catalogue, setCatalogue] = useState<CatalogueRowDto[]>([]);
  const [targeting, setTargeting] = useState<TargetingRowDto[]>([]);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);

  useEffect(() => {
    getCatalogue(adminLineId).then(setCatalogue);
    getTargeting(adminLineId).then(setTargeting);
    getTemplates(adminLineId).then(setTemplates);
  }, [adminLineId]);

  const tsel = templates.find((t) => t.id === tplId) ?? templates[0];
  const tplSubject = tplDrafts[tsel?.id ?? '']?.subject ?? tsel?.subjectSkeleton ?? '';
  const tplBody = tplDrafts[tsel?.id ?? '']?.body ?? tsel?.bodySkeleton ?? '';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-5 oe:p-7">
        <div className="mb-5 flex gap-0.5 border-b border-border">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setAdminTab(t.key)} style={tabButtonStyle(adminTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {adminTab === 'catalogue' && (
          <>
            <div className="mb-3 flex items-center">
              <div className="text-[15px] font-semibold">Catalogue</div>
              <div className="flex-1" />
              <button className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] font-medium text-text hover:border-border-hover">+ Add item</button>
            </div>
            <div className="overflow-x-auto rounded-[7px] border border-border2">
              <div className="grid min-w-[680px] grid-cols-[110px_1fr_140px_110px_100px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                <span>SKU</span>
                <span>Item</span>
                <span>Wholesale</span>
                <span>MOQ</span>
                <span>Status</span>
              </div>
              {catalogue.map((r) => (
                <div key={r.sku} className="grid min-w-[680px] grid-cols-[110px_1fr_140px_110px_100px] items-center gap-3 border-b border-border px-3.5 py-2.5 text-[13px]">
                  <span className="font-mono text-[11.5px] text-text-secondary">{r.sku}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono text-xs">{r.priceLabel}</span>
                  <span className="font-mono text-xs text-text-secondary">{r.moq}</span>
                  <Badge spec={statusBadge(r.active ? 'active' : 'paused')} />
                </div>
              ))}
            </div>
          </>
        )}

        {adminTab === 'templates' && tsel && (
          <div className="grid grid-cols-1 items-start gap-5 oe:grid-cols-[300px_1fr]">
            <div>
              <div className="mb-3 flex items-center">
                <div className="text-[15px] font-semibold">Templates</div>
                <div className="flex-1" />
                <button className="rounded-control border border-border3 bg-raised2 px-2.5 py-1.5 text-xs text-text">+ New</button>
              </div>
              <div className="flex flex-col gap-1">
                {templates.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setTplId(tp.id)}
                    className="flex w-full rounded-md border px-3 py-2.5 text-left text-text"
                    style={{ borderColor: tp.id === tplId ? 'var(--oe-border-selected)' : 'var(--oe-border)', background: tp.id === tplId ? 'var(--oe-selected-bg)' : 'var(--oe-surface2)' }}
                  >
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold">{templateNames[tp.id] ?? tp.id}</span>
                      <span className="mt-0.5 block font-mono text-[10.5px] text-text-muted">
                        {TEMPLATE_CHANNEL_LABEL[tp.type]} · v{tp.version}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[7px] border border-border2 bg-surface p-[18px]">
              <div className="mb-3.5 flex items-center gap-2.5">
                <div className="text-[14px] font-semibold">{templateNames[tsel.id] ?? tsel.id}</div>
                <span className="font-mono text-[10.5px] text-text-muted">{tsel.id}</span>
                <div className="flex-1" />
                <button
                  onClick={() => showToast('Template saved')}
                  className="rounded-control border border-action bg-action px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-action-hover"
                >
                  Save
                </button>
              </div>
              <div className="mb-3 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-label">Subject</label>
                <input
                  value={tplSubject}
                  onChange={(e) => setTplDraft(tsel.id, { subject: e.target.value, body: tplBody })}
                  className="rounded-control border border-border3 bg-bg px-2.5 py-2 text-[13px] text-text"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-label">Body</label>
                <textarea
                  value={tplBody}
                  onChange={(e) => setTplDraft(tsel.id, { subject: tplSubject, body: e.target.value })}
                  spellCheck={false}
                  className="min-h-[200px] resize-y rounded-control border border-border3 bg-bg p-3 font-mono text-[13px] leading-[1.65] text-body"
                />
              </div>
              <div className="mt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Insert token</div>
                <div className="flex flex-wrap gap-1.5">
                  {tokens.map((tk) => (
                    <button
                      key={tk}
                      onClick={() => {
                        setTplDraft(tsel.id, { subject: tplSubject, body: `${tplBody} ${tk}` });
                        showToast('Token inserted');
                      }}
                      className="rounded-[4px] px-2.5 py-1 font-mono text-[11px] text-link2"
                      style={{ background: 'rgba(110,168,254,.08)', border: '1px solid rgba(110,168,254,.3)' }}
                    >
                      {tk}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'targeting' && (
          <>
            <div className="mb-3 flex items-center">
              <div className="text-[15px] font-semibold">Targeting profiles</div>
              <div className="flex-1" />
              <button className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] font-medium text-text">+ New profile</button>
            </div>
            <div className="overflow-x-auto rounded-[7px] border border-border2">
              <div className="grid min-w-[760px] grid-cols-[1fr_180px_140px_130px_100px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                <span>Profile</span>
                <span>Geography</span>
                <span>Channel</span>
                <span>Prospects found</span>
                <span>Status</span>
              </div>
              {targeting.map((r) => (
                <div key={r.name} className="grid min-w-[760px] grid-cols-[1fr_180px_140px_130px_100px] items-center gap-3 border-b border-border px-3.5 py-2.5 text-[13px]">
                  <span>
                    <span className="block font-semibold">{r.name}</span>
                    <span className="text-[11.5px] text-text-muted">{r.description}</span>
                  </span>
                  <span className="text-[12.5px] text-text-secondary">{r.geography}</span>
                  <span className="text-[12.5px] text-text-secondary">{r.channel}</span>
                  <span className="font-mono text-xs">{r.prospectsFound.toLocaleString()}</span>
                  <Badge spec={statusBadge(r.active ? 'active' : 'paused')} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
