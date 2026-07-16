'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApprovedVia, DmQueueItemDto, ReplyQueueItemDto, ReviewQueueItemDto } from '@outreach-engine/types';
import { getDmQueue, getReplyQueue, getReviewQueue } from '../data/queues';
import { getLines, type LineFixture } from '../data/lines';
import type { DoneStatus } from '../badges';

export type Role = 'operator' | 'admin';
export type QueueKey = 'review' | 'reply' | 'dm';

export interface Decision {
  status: DoneStatus;
  approvedVia?: ApprovedVia;
}

export interface DraftEdit {
  subject?: string;
  body?: string;
}

interface AppStateValue {
  // session
  role: Role | null;
  userEmail: string;
  signIn: (email: string, role: Role) => void;
  signOut: () => void;

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
  decide: (queue: QueueKey, id: string, status: DoneStatus, approvedVia?: ApprovedVia) => void;
  isDecided: (queue: QueueKey, id: string) => Decision | undefined;
  resetQueues: () => void;

  drafts: Record<string, DraftEdit>;
  setDraft: (id: string, patch: DraftEdit) => void;

  selection: Record<QueueKey, string | undefined>;
  select: (queue: QueueKey, id: string) => void;

  // admin
  adminLineId: string;
  setAdminLineId: (id: string) => void;
  adminTab: 'catalogue' | 'templates' | 'targeting';
  setAdminTab: (tab: 'catalogue' | 'templates' | 'targeting') => void;
  warm: Record<string, boolean>;
  toggleWarm: (lineId: string) => void;
  channels: Record<string, { email: boolean; ig: boolean }>;
  toggleChannel: (lineId: string, channel: 'email' | 'ig') => void;
  tplId: string;
  setTplId: (id: string) => void;
  tplDrafts: Record<string, DraftEdit>;
  setTplDraft: (id: string, patch: DraftEdit) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const LINE_SWITCH_SKELETON_MS = 650;
const TOAST_MS = 2200;

// Seed a couple of items as already decided so the "sent via Telegram" badge treatment and
// the auto-suppression-on-reject copy are visible without needing a live bot session.
const INITIAL_DECISIONS: Record<string, Decision> = {
  'review:msg_7a1x4d': { status: 'sent', approvedVia: 'telegram' },
  'reply:rep_8m1e': { status: 'sent', approvedVia: 'telegram' },
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [userEmail, setUserEmail] = useState('kay@balbusgroup.co.uk');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [lines, setLines] = useState<LineFixture[]>([]);
  const [activeLineId, setActiveLineId] = useState('ln_aurora');
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

  const [adminLineId, setAdminLineId] = useState('ln_aurora');
  const [adminTab, setAdminTab] = useState<'catalogue' | 'templates' | 'targeting'>('catalogue');
  const [warm, setWarm] = useState<Record<string, boolean>>({ ln_aurora: true, ln_forge: false });
  const [channels, setChannels] = useState<Record<string, { email: boolean; ig: boolean }>>({
    ln_aurora: { email: true, ig: true },
    ln_forge: { email: true, ig: false },
  });
  const [tplId, setTplId] = useState('tpl_01h2x');
  const [tplDrafts, setTplDrafts] = useState<Record<string, DraftEdit>>({});

  useEffect(() => {
    getLines().then(setLines);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const loadQueuesForLine = useCallback((lineId: string) => {
    getReviewQueue(lineId).then((items) => {
      setReviewItems(items);
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
  }, []);

  useEffect(() => {
    loadQueuesForLine(activeLineId);
  }, [activeLineId, loadQueuesForLine]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const signIn = useCallback((email: string, signedInRole: Role) => {
    setUserEmail(email);
    setRole(signedInRole);
  }, []);

  const signOut = useCallback(() => {
    setRole(null);
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

  const decide = useCallback(
    (queue: QueueKey, id: string, status: DoneStatus, approvedVia?: ApprovedVia) => {
      const key = `${queue}:${id}`;
      setDecisions((prev) => ({ ...prev, [key]: { status, approvedVia } }));

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
        sent: 'Sent',
        skipped: 'Skipped',
        rejected: 'Rejected → added to suppression list',
        escalated: 'Escalated to admin',
        handled: 'Marked handled',
      };
      showToast(verb[status]);
    },
    [decisions, reviewItems, replyItems, dmItems, showToast],
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

  const toggleWarm = useCallback((lineId: string) => {
    setWarm((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  }, []);

  const toggleChannel = useCallback((lineId: string, channel: 'email' | 'ig') => {
    setChannels((prev) => {
      const current = prev[lineId] ?? { email: true, ig: false };
      return { ...prev, [lineId]: { ...current, [channel]: !current[channel] } };
    });
  }, []);

  const setTplDraft = useCallback((id: string, patch: DraftEdit) => {
    setTplDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      role,
      userEmail,
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
      role, userEmail, signIn, signOut, theme, toggleTheme, lines, activeLineId, switchLine, isLoadingLine,
      lineMenuOpen, toast, showToast, reviewItems, replyItems, dmItems, decisions, decide, isDecided, resetQueues,
      drafts, setDraft, selection, select, adminLineId, adminTab, warm, toggleWarm, channels, toggleChannel,
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
