'use client';

import { useEffect, useState } from 'react';
import type { TemplateDto } from '@outreach-engine/types';
import {
  createProduct,
  deleteProduct,
  getProducts,
  setProductActive,
  toCatalogueRows,
  type CatalogueRow,
  type ProductRaw,
} from '../../../../lib/data/catalogue';
import {
  createTargetingProfile,
  deleteTargetingProfile,
  getTargetingProfiles,
  setTargetingProfileActive,
  updateTargetingProfile,
  type TargetingProfileRaw,
} from '../../../../lib/data/targeting';
import { createTemplate, deleteTemplate, getTemplates, updateTemplate } from '../../../../lib/data/templates';
import { tokens } from '../../../../lib/mock-data';
import { statusBadge } from '../../../../lib/badges';
import { useAppState } from '../../../../lib/state/app-state';
import { Badge } from '../../../../components/Badge';

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

const field = 'flex flex-col gap-1.5';
const labelCls = 'text-xs font-medium text-label';
const inputCls = 'rounded-control border border-border3 bg-bg px-2.5 py-2 text-[13px] text-text';

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

function parseList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default function AdminCataloguePage() {
  const { adminLineId, adminTab, setAdminTab, tplId, setTplId, tplDrafts, setTplDraft, showToast } = useAppState();

  const [products, setProducts] = useState<ProductRaw[]>([]);
  const [targeting, setTargeting] = useState<TargetingProfileRaw[]>([]);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);

  const [showAddItem, setShowAddItem] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const refreshProducts = () => getProducts(adminLineId).then(setProducts);
  const refreshTargeting = () => getTargetingProfiles(adminLineId).then(setTargeting);
  const refreshTemplates = () => getTemplates(adminLineId).then((ts) => {
    setTemplates(ts);
    if (!tplId || !ts.some((t) => t.id === tplId)) setTplId(ts[0]?.id ?? '');
  });

  useEffect(() => {
    if (!adminLineId) return;
    refreshProducts();
    refreshTargeting();
    refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLineId]);

  const catalogueRows: CatalogueRow[] = toCatalogueRows(products);
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
              <button
                onClick={() => setShowAddItem((v) => !v)}
                className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] font-medium text-text hover:border-border-hover"
              >
                {showAddItem ? 'Cancel' : '+ Add item'}
              </button>
            </div>

            {showAddItem && (
              <AddProductForm
                onCancel={() => setShowAddItem(false)}
                onCreate={async (input) => {
                  try {
                    await createProduct(adminLineId, input);
                    showToast('Item added');
                    setShowAddItem(false);
                    refreshProducts();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Failed to add item.');
                  }
                }}
              />
            )}

            <div className="overflow-x-auto rounded-[7px] border border-border2">
              <div className="grid min-w-[760px] grid-cols-[110px_1fr_140px_100px_90px_80px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                <span>SKU</span>
                <span>Item</span>
                <span>Wholesale</span>
                <span>MOQ</span>
                <span>Status</span>
                <span></span>
              </div>
              {catalogueRows.map((r) => (
                <div key={r.variantId ?? r.productId} className="grid min-w-[760px] grid-cols-[110px_1fr_140px_100px_90px_80px] items-center gap-3 border-b border-border px-3.5 py-2.5 text-[13px]">
                  <span className="font-mono text-[11.5px] text-text-secondary">{r.sku}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono text-xs">{r.priceLabel}</span>
                  <span className="font-mono text-xs text-text-secondary">{r.moq ?? '—'}</span>
                  <button
                    onClick={async () => {
                      try {
                        await setProductActive(adminLineId, r.productId, !r.active);
                        refreshProducts();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed to update item.');
                      }
                    }}
                  >
                    <Badge spec={statusBadge(r.active ? 'active' : 'paused')} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
                      const product = products.find((p) => p.id === r.productId);
                      try {
                        await deleteProduct(adminLineId, r.productId, product?.variants.map((v) => v.id) ?? []);
                        showToast('Item deleted');
                        refreshProducts();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed to delete item.');
                      }
                    }}
                    className="text-[12px] text-text-muted hover:text-red"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {catalogueRows.length === 0 && (
                <div className="px-3.5 py-6 text-center text-[13px] text-text-muted">No items yet — add one above.</div>
              )}
            </div>
          </>
        )}

        {adminTab === 'templates' && (
          <div className="grid grid-cols-1 items-start gap-5 oe:grid-cols-[300px_1fr]">
            <div>
              <div className="mb-3 flex items-center">
                <div className="text-[15px] font-semibold">Templates</div>
                <div className="flex-1" />
                <button
                  onClick={async () => {
                    try {
                      const created = await createTemplate(adminLineId, { type: 'email_outbound', subjectSkeleton: 'New subject', bodySkeleton: 'New template body' });
                      showToast('Template created');
                      await refreshTemplates();
                      setTplId(created.id);
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Failed to create template.');
                    }
                  }}
                  className="rounded-control border border-border3 bg-raised2 px-2.5 py-1.5 text-xs text-text"
                >
                  + New
                </button>
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
                      <span className="block font-mono text-[11px] text-text-muted">{tp.id.slice(0, 8)}</span>
                      <span className="mt-0.5 block font-mono text-[10.5px] text-text-muted">
                        {TEMPLATE_CHANNEL_LABEL[tp.type]}{!tp.active && ' · inactive'}
                      </span>
                    </span>
                  </button>
                ))}
                {templates.length === 0 && <div className="px-2 py-3 text-[12.5px] text-text-muted">No templates yet.</div>}
              </div>
            </div>

            {tsel && (
              <div className="rounded-[7px] border border-border2 bg-surface p-[18px]">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <div className="text-[14px] font-semibold">{TEMPLATE_CHANNEL_LABEL[tsel.type]} template</div>
                  <span className="font-mono text-[10.5px] text-text-muted">{tsel.id}</span>
                  <div className="flex-1" />
                  <button
                    onClick={async () => {
                      if (!confirm('Delete this template?')) return;
                      try {
                        await deleteTemplate(adminLineId, tsel.id);
                        showToast('Template deleted');
                        refreshTemplates();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed to delete template.');
                      }
                    }}
                    className="rounded-control border border-border3 px-2.5 py-1 text-[11.5px] text-text-muted hover:text-red"
                  >
                    Delete
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await updateTemplate(adminLineId, tsel.id, { subjectSkeleton: tplSubject || null, bodySkeleton: tplBody });
                        showToast('Template saved');
                        refreshTemplates();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Failed to save template.');
                      }
                    }}
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
                        onClick={() => setTplDraft(tsel.id, { subject: tplSubject, body: `${tplBody} ${tk}` })}
                        className="rounded-[4px] px-2.5 py-1 font-mono text-[11px] text-link2"
                        style={{ background: 'rgba(110,168,254,.08)', border: '1px solid rgba(110,168,254,.3)' }}
                      >
                        {tk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {adminTab === 'targeting' && (
          <>
            <div className="mb-3 flex items-center">
              <div className="text-[15px] font-semibold">Targeting profiles</div>
              <div className="flex-1" />
              <button
                onClick={() => setShowNewProfile((v) => !v)}
                className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] font-medium text-text"
              >
                {showNewProfile ? 'Cancel' : '+ New profile'}
              </button>
            </div>

            {showNewProfile && (
              <TargetingProfileForm
                submitLabel="Add profile"
                onCancel={() => setShowNewProfile(false)}
                onSubmit={async (input) => {
                  try {
                    await createTargetingProfile(adminLineId, input);
                    showToast('Targeting profile created');
                    setShowNewProfile(false);
                    refreshTargeting();
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : 'Failed to create profile.');
                  }
                }}
              />
            )}

            <div className="overflow-x-auto rounded-[7px] border border-border2">
              <div className="grid min-w-[820px] grid-cols-[1fr_1fr_1fr_100px_80px] gap-3 border-b border-border2 bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                <span>Profile</span>
                <span>Place types / keywords</span>
                <span>Exclusions</span>
                <span>Status</span>
                <span></span>
              </div>
              {targeting.map((r) => (
                <div key={r.id}>
                  <div className="grid min-w-[820px] grid-cols-[1fr_1fr_1fr_100px_130px] items-center gap-3 border-b border-border px-3.5 py-2.5 text-[13px]">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-[11.5px] text-text-secondary">{[...r.googlePlaceTypes, ...r.keywords].join(', ') || '—'}</span>
                    <span className="text-[11.5px] text-text-secondary">{r.exclusions.join(', ') || '—'}</span>
                    <button
                      onClick={async () => {
                        try {
                          await setTargetingProfileActive(adminLineId, r.id, !r.active);
                          refreshTargeting();
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Failed to update profile.');
                        }
                      }}
                    >
                      <Badge spec={statusBadge(r.active ? 'active' : 'paused')} />
                    </button>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setEditingProfileId((v) => (v === r.id ? null : r.id))}
                        className="text-[12px] text-text-muted hover:text-text"
                      >
                        {editingProfileId === r.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
                          try {
                            await deleteTargetingProfile(adminLineId, r.id);
                            showToast('Profile deleted');
                            refreshTargeting();
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Failed to delete profile — it may still have batch history.');
                          }
                        }}
                        className="text-[12px] text-text-muted hover:text-red"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {editingProfileId === r.id && (
                    <TargetingProfileForm
                      initial={r}
                      submitLabel="Save changes"
                      onCancel={() => setEditingProfileId(null)}
                      onSubmit={async (input) => {
                        try {
                          await updateTargetingProfile(adminLineId, r.id, input);
                          showToast('Targeting profile updated');
                          setEditingProfileId(null);
                          refreshTargeting();
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Failed to update profile.');
                        }
                      }}
                    />
                  )}
                </div>
              ))}
              {targeting.length === 0 && (
                <div className="px-3.5 py-6 text-center text-[13px] text-text-muted">No targeting profiles yet — add one above.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddProductForm({ onCreate, onCancel }: { onCreate: (input: Parameters<typeof createProduct>[1]) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keyFeatures, setKeyFeatures] = useState('');
  const [targetBusinessTypes, setTargetBusinessTypes] = useState('');
  const [link, setLink] = useState('');
  const [variantName, setVariantName] = useState('');
  const [price, setPrice] = useState('');
  const [moq, setMoq] = useState('1');

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-[7px] border border-border2 bg-surface p-4 oe:grid-cols-2">
      <div className={field}>
        <label className={labelCls}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Link</label>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={inputCls} />
      </div>
      <div className={`${field} col-span-full`}>
        <label className={labelCls}>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Key features (comma-separated)</label>
        <input value={keyFeatures} onChange={(e) => setKeyFeatures(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Target business types (comma-separated)</label>
        <input value={targetBusinessTypes} onChange={(e) => setTargetBusinessTypes(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Variant name</label>
        <input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. 100-pack, medium" className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Wholesale price</label>
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>MOQ</label>
        <input type="number" min={1} value={moq} onChange={(e) => setMoq(e.target.value)} className={inputCls} />
      </div>
      <div className="col-span-full flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-control border border-border3 px-3.5 py-1.5 text-[12.5px] text-text">Cancel</button>
        <button
          onClick={() =>
            onCreate({
              name,
              description,
              keyFeatures: parseList(keyFeatures),
              targetBusinessTypes: parseList(targetBusinessTypes),
              link,
              variantName,
              price: Number(price) || 0,
              moq: Number(moq) || 1,
            })
          }
          disabled={!name || !variantName}
          className="rounded-control border border-action bg-action px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          Add item
        </button>
      </div>
    </div>
  );
}

function TargetingProfileForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TargetingProfileRaw;
  submitLabel: string;
  onSubmit: (input: Parameters<typeof createTargetingProfile>[1]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [googlePlaceTypes, setGooglePlaceTypes] = useState(initial?.googlePlaceTypes.join(', ') ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? '');
  const [exclusions, setExclusions] = useState(initial?.exclusions.join(', ') ?? '');

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-[7px] border border-border2 bg-surface p-4 oe:grid-cols-2">
      <div className={field}>
        <label className={labelCls}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Google Place types (comma-separated)</label>
        <input value={googlePlaceTypes} onChange={(e) => setGooglePlaceTypes(e.target.value)} placeholder="e.g. grocery_or_supermarket" className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Keywords (comma-separated)</label>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} />
      </div>
      <div className={field}>
        <label className={labelCls}>Exclusions (comma-separated)</label>
        <input value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="e.g. Tesco, Sainsbury" className={inputCls} />
      </div>
      <div className="col-span-full flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-control border border-border3 px-3.5 py-1.5 text-[12.5px] text-text">Cancel</button>
        <button
          onClick={() =>
            onSubmit({
              name,
              googlePlaceTypes: parseList(googlePlaceTypes),
              keywords: parseList(keywords),
              exclusions: parseList(exclusions),
            })
          }
          disabled={!name}
          className="rounded-control border border-action bg-action px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
