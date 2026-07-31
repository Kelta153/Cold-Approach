'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApprovedVia, DmQueueItemDto, ReplyQueueItemDto, ReviewQueueItemDto } from '@outreach-engine/types';
import { getDmQueue, getReplyQueue, getReviewQueue } from '../data/queues';
import {
  attemptSend,
  escalateReply,
  markDmSent,
  markReplyHandled,
  regenerateDraft as regenerateDraftAction,
  rejectDmLead,
  rejectReviewLead,
  skipDmLead,
  skipReply,
  skipReviewLead,
} from '../data/actions';
import { getLines, updateBusinessLine, type LineFixture } from '../data/lines';
import type { DoneStatus } from '../badges';
import { authClient } from '../auth-client';

export type Role = 'operator' | 'admin';
export type QueueKey = 'review' | 'reply' | 'dm';

export interface Decision {
  status: DoneStatus;
  approvedVia?: ApprovedVia;
  simulated?: boolean;
}

export interface DraftEdit {
  subject?: string;
  body?: string;
}

interface AppStateValue {
  // session — real BetterAuth session against apps/api, not client-side mocked state
  role: Role | null;
  userEmail: string;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;

  // theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // business lines
  lines: LineFixture[];
  activeLineId: string;
  activeLine: LineFixture | undefined;
  switchLine: (id: string) => void;
  isLoadingLine: boolean;
  lineMenuOpen: boolean;
  setLineMenuOpen: (open: boolean) => void;

  // toast
  toast: string | null;
  showToast: (message: string) => void;

  // queue data
  reviewItems: ReviewQueueItemDto[];
  replyItems: ReplyQueueItemDto[];
  dmItems: DmQueueItemDto[];

  // decisions + drafts (keyed "queue:id")
  decisions: Record<string, Decision>;
  /** `backendId` is the id the real API action needs — the Lead id for skip/reject/dm-sent,
   * distinct from `id` (the local decision key, which stays the Draft/Reply/DmDraft id so list
   * rows and selection keep working unchanged). Defaults to `id` when they're the same thing
   * (sending a Draft, or any Reply action — Reply's queue-item id already is the Reply id). */
  decide: (queue: QueueKey, id: string, status: DoneStatus, approvedVia?: ApprovedVia, backendId?: string) => Promise<void>;
  isDecided: (queue: QueueKey, id: string) => Decision | undefined;
  resetQueues: () => void;

  drafts: Record<string, DraftEdit>;
  setDraft: (id: string, patch: DraftEdit) => void;
  /** Real re-drafting for one lead — replaces the old client-side text mutation. Refreshes the
   * review queue and re-selects the new draft (a new Draft row, new id) on success. */
  regenerateDraft: (leadId: string) => Promise<void>;

  selection: Record<QueueKey, string | undefined>;
  select: (queue: QueueKey, id: string) => void;

  // admin
  adminLineId: string;
  setAdminLineId: (id: string) => void;
  adminTab: 'catalogue' | 'templates' | 'targeting';
  setAdminTab: (tab: 'catalogue' | 'templates' | 'targeting') => void;
  warm: Record<string, boolean>;
  toggleWarm: (lineId: string) => Promise<void>;
  channels: Record<string, { email: boolean; ig: boolean }>;
  toggleChannel: (lineId: string, channel: 'email' | 'ig') => Promise<void>;
  tplId: string;
  setTplId: (id: string) => void;
  tplDrafts: Record<string, DraftEdit>;
  setTplDraft: (id: string, patch: DraftEdit) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const LINE_SWITCH_SKELETON_MS = 650;
const TOAST_MS = 2200;

// Real data now — a decided item's "sent via Telegram"/simulated badge comes from the real
// Send row (see seedDecisionsFromSend below), not a hardcoded demo seed.
const INITIAL_DECISIONS: Record<string, Decision> = {};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [lines, setLines] = useState<LineFixture[]>([]);
  const [activeLineId, setActiveLineId] = useState('');
  const [isLoadingLine, setIsLoadingLine] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [reviewItems, setReviewItems] = useState<ReviewQueueItemDto[]>([]);
  const [replyItems, setReplyItems] = useState<ReplyQueueItemDto[]>([]);
  const [dmItems, setDmItems] = useState<DmQueueItemDto[]>([]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(INITIAL_DECISIONS);
  const [drafts, setDrafts] = useState<Record<string, DraftEdit>>({});
  const [selection, setSelection] = useState<Record<QueueKey, string | undefined>>({ review: undefined, reply: undefined, dm: undefined });

  const [adminLineId, setAdminLineId] = useState('');
  const [adminTab, setAdminTab] = useState<'catalogue' | 'templates' | 'targeting'>('catalogue');
  const [warm, setWarm] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState<Record<string, { email: boolean; ig: boolean }>>({});
  const [tplId, setTplId] = useState('tpl_01h2x');
  const [tplDrafts, setTplDrafts] = useState<Record<string, DraftEdit>>({});

  // Requires a session — GET /business-lines is authenticated, so this must wait for sign-in
  // rather than firing unconditionally on mount (which would 401 while still on /login).
  useEffect(() => {
    if (!role) return;
    getLines().then((ls) => {
      setLines(ls);
      const first = ls[0];
      if (!first) return;
      setActiveLineId((prev) => prev || first.id);
      setAdminLineId((prev) => prev || first.id);
      setWarm((prev) => (first.id in prev ? prev : { ...prev, [first.id]: first.warmupComplete }));
      setChannels((prev) => (first.id in prev ? prev : { ...prev, [first.id]: { email: first.channelsEnabled.email, ig: first.channelsEnabled.instagram } }));
    });
  }, [role]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // A page reload re-fetches from the real API — any item that already has a `.send` (a real,
  // previously-completed send) must show as decided immediately, not flash as pending again.
  const seedDecisionsFromSend = useCallback((queue: QueueKey, items: { id: string; send?: { approvedVia: ApprovedVia; simulated: boolean } }[]) => {
    const withSend = items.filter((it) => it.send);
    if (withSend.length === 0) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const it of withSend) {
        const key = `${queue}:${it.id}`;
        if (!next[key]) next[key] = { status: 'sent', approvedVia: it.send!.approvedVia, simulated: it.send!.simulated };
      }
      return next;
    });
  }, []);

  const loadQueuesForLine = useCallback((lineId: string) => {
    getReviewQueue(lineId).then((items) => {
      setReviewItems(items);
      seedDecisionsFromSend('review', items);
      setSelection((sel) => ({ ...sel, review: sel.review && items.some((i) => i.id === sel.review) ? sel.review : items[0]?.id }));
    });
    getReplyQueue(lineId).then((items) => {
      setReplyItems(items);
      setSelection((sel) => ({ ...sel, reply: sel.reply && items.some((i) => i.id === sel.reply) ? sel.reply : items[0]?.id }));
    });
    getDmQueue(lineId).then((items) => {
      setDmItems(items);
      setSelection((sel) => ({ ...sel, dm: sel.dm && items.some((i) => i.id === sel.dm) ? sel.dm : items[0]?.id }));
    });
  }, [seedDecisionsFromSend]);

  useEffect(() => {
    if (activeLineId) loadQueuesForLine(activeLineId);
  }, [activeLineId, loadQueuesForLine]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const applySession = useCallback((user: { email: string; role?: string } | null | undefined) => {
    if (user && (user.role === 'admin' || user.role === 'operator')) {
      setUserEmail(user.email);
      setRole(user.role);
    } else {
      setUserEmail('');
      setRole(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!cancelled) {
          applySession(data?.user as { email: string; role?: string } | undefined);
        }
      })
      .catch(() => {
        // A failed session check (network error, misconfigured API URL, CORS, etc.) must still
        // resolve authLoading — otherwise the root page's `if (authLoading) return;` never fires
        // and the app hangs on a permanently blank screen instead of falling back to /login.
        if (!cancelled) {
          applySession(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error || !data?.user) {
        return { ok: false as const, error: error?.message ?? 'Sign in failed.' };
      }
      applySession(data.user as { email: string; role?: string });
      return { ok: true as const };
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setRole(null);
    setUserEmail('');
    setLineMenuOpen(false);
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const switchLine = useCallback(
    (id: string) => {
      if (id === activeLineId) {
        setLineMenuOpen(false);
        return;
      }
      setActiveLineId(id);
      setAdminLineId(id);
      setLineMenuOpen(false);
      setIsLoadingLine(true);
      setTimeout(() => setIsLoadingLine(false), LINE_SWITCH_SKELETON_MS);
    },
    [activeLineId],
  );

  // Real API call per (queue, status) — the action that actually persists the decision.
  // `undefined` means "no real endpoint for this yet" (Regenerate has no real drafting pipeline
  // to call, so it stays a local-only edit — see the queue pages).
  const runBackendAction = useCallback(
    async (queue: QueueKey, id: string, status: DoneStatus, backendId: string): Promise<{ approvedVia?: ApprovedVia; simulated?: boolean } | void> => {
      if (queue === 'review') {
        if (status === 'sent') {
          const result = await attemptSend(id, activeLineId);
          if (!result.allowed) throw new Error(result.blockedReasons.join(' '));
          // attemptSend's response is just {allowed, blockedReasons} — refetch to learn the real
          // approvedVia/simulated flag the backend actually recorded on the Send row.
          const refreshed = await getReviewQueue(activeLineId);
          setReviewItems(refreshed);
          const sentItem = refreshed.find((it) => it.id === id);
          return { approvedVia: sentItem?.send?.approvedVia ?? 'webapp', simulated: sentItem?.send?.simulated };
        }
        if (status === 'skipped') return void (await skipReviewLead(backendId, activeLineId));
        if (status === 'rejected') return void (await rejectReviewLead(backendId, activeLineId));
      }
      if (queue === 'dm') {
        if (status === 'sent') return void (await markDmSent(backendId, activeLineId));
        if (status === 'skipped') return void (await skipDmLead(backendId, activeLineId));
        if (status === 'rejected') return void (await rejectDmLead(backendId, activeLineId));
      }
      if (queue === 'reply') {
        if (status === 'handled') return void (await markReplyHandled(backendId, activeLineId));
        if (status === 'escalated') return void (await escalateReply(backendId, activeLineId));
        if (status === 'skipped') return void (await skipReply(backendId, activeLineId));
        if (status === 'sent') return; // no modeled reply-send path yet — see docs/project.md
      }
    },
    [activeLineId],
  );

  const decide = useCallback(
    async (queue: QueueKey, id: string, status: DoneStatus, approvedVia?: ApprovedVia, backendId?: string) => {
      let sendResult: { approvedVia?: ApprovedVia; simulated?: boolean } | void;
      try {
        sendResult = await runBackendAction(queue, id, status, backendId ?? id);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed.');
        return;
      }

      const key = `${queue}:${id}`;
      setDecisions((prev) => ({
        ...prev,
        [key]: { status, approvedVia: sendResult?.approvedVia ?? approvedVia, simulated: sendResult?.simulated },
      }));

      const items = queue === 'review' ? reviewItems : queue === 'reply' ? replyItems : dmItems;
      const idx = items.findIndex((it) => it.id === id);
      if (idx >= 0) {
        for (let i = 1; i <= items.length; i++) {
          const candidate = items[(idx + i) % items.length];
          if (!decisions[`${queue}:${candidate.id}`] && candidate.id !== id) {
            setSelection((sel) => ({ ...sel, [queue]: candidate.id }));
            break;
          }
        }
      }

      const verb: Record<DoneStatus, string> = {
        sent: sendResult?.simulated ? 'Sent (simulated — no INSTANTLY_API_KEY configured)' : 'Sent',
        skipped: 'Skipped',
        rejected: 'Rejected → added to suppression list',
        escalated: 'Escalated to admin',
        handled: 'Marked handled',
      };
      showToast(verb[status]);
    },
    [decisions, reviewItems, replyItems, dmItems, showToast, runBackendAction],
  );

  const isDecided = useCallback((queue: QueueKey, id: string) => decisions[`${queue}:${id}`], [decisions]);

  const resetQueues = useCallback(() => {
    setDecisions(INITIAL_DECISIONS);
    setDrafts({});
  }, []);

  const setDraft = useCallback((id: string, patch: DraftEdit) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const select = useCallback((queue: QueueKey, id: string) => {
    setSelection((sel) => ({ ...sel, [queue]: id }));
  }, []);

  const regenerateDraft = useCallback(
    async (leadId: string) => {
      try {
        const { draftId } = await regenerateDraftAction(leadId, activeLineId);
        const refreshed = await getReviewQueue(activeLineId);
        setReviewItems(refreshed);
        select('review', draftId);
        showToast('Draft regenerated');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to regenerate draft.');
      }
    },
    [activeLineId, select, showToast],
  );

  // Real, persisted fields (BusinessLine.warmupComplete / channelsEnabled) — admin-only PATCH,
  // not local-only demo state. Optimistic update, reconciled with the server response; reverted
  // with a toast on failure (e.g. an operator hitting the admin-only route).
  const toggleWarm = useCallback(
    async (lineId: string) => {
      const next = !warm[lineId];
      setWarm((prev) => ({ ...prev, [lineId]: next }));
      try {
        const updated = await updateBusinessLine(lineId, { warmupComplete: next });
        setWarm((prev) => ({ ...prev, [lineId]: updated.warmupComplete }));
      } catch (err) {
        setWarm((prev) => ({ ...prev, [lineId]: !next }));
        showToast(err instanceof Error ? err.message : 'Failed to update warm-up status.');
      }
    },
    [warm, showToast],
  );

  const toggleChannel = useCallback(
    async (lineId: string, channel: 'email' | 'ig') => {
      const current = channels[lineId] ?? { email: true, ig: false };
      const nextLocal = { ...current, [channel]: !current[channel] };
      setChannels((prev) => ({ ...prev, [lineId]: nextLocal }));
      try {
        const updated = await updateBusinessLine(lineId, {
          channelsEnabled: { email: nextLocal.email, instagram: nextLocal.ig },
        });
        setChannels((prev) => ({ ...prev, [lineId]: { email: updated.channelsEnabled.email, ig: updated.channelsEnabled.instagram } }));
      } catch (err) {
        setChannels((prev) => ({ ...prev, [lineId]: current }));
        showToast(err instanceof Error ? err.message : 'Failed to update channel.');
      }
    },
    [channels, showToast],
  );

  const setTplDraft = useCallback((id: string, patch: DraftEdit) => {
    setTplDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      role,
      userEmail,
      authLoading,
      signIn,
      signOut,
      theme,
      toggleTheme,
      lines,
      activeLineId,
      activeLine: lines.find((l) => l.id === activeLineId),
      switchLine,
      isLoadingLine,
      lineMenuOpen,
      setLineMenuOpen,
      toast,
      showToast,
      reviewItems,
      replyItems,
      dmItems,
      decisions,
      decide,
      isDecided,
      resetQueues,
      drafts,
      setDraft,
      regenerateDraft,
      selection,
      select,
      adminLineId,
      setAdminLineId,
      adminTab,
      setAdminTab,
      warm,
      toggleWarm,
      channels,
      toggleChannel,
      tplId,
      setTplId,
      tplDrafts,
      setTplDraft,
    }),
    [
      role, userEmail, authLoading, signIn, signOut, theme, toggleTheme, lines, activeLineId, switchLine, isLoadingLine,
      lineMenuOpen, toast, showToast, reviewItems, replyItems, dmItems, decisions, decide, isDecided, resetQueues,
      drafts, setDraft, regenerateDraft, selection, select, adminLineId, adminTab, warm, toggleWarm, channels, toggleChannel,
      tplId, tplDrafts, setTplDraft,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
