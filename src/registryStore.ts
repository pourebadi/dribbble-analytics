/**
 * Tiny shared store for the two registries (promotions and collections).
 *
 * Why this exists — three bugs had the same root cause:
 *
 *  1. Switching tabs unmounted the page, so a registry edit that had not been
 *     saved yet was silently thrown away. You would add a boost, navigate to
 *     Growth Analysis, come back, and it was gone.
 *  2. Every page mount re-fetched from the network, so the Collections page
 *     stalled for a second or two each time it was opened.
 *  3. The Analysis tab kept its own copy fetched at its own mount time, so it
 *     could not see something the Promotions page had just saved — and it had
 *     no way to be told.
 *
 * A module-level cache with subscribers fixes all three: the data is fetched
 * once, survives navigation, and every subscriber updates the moment it
 * changes. It deliberately stays tiny — no dependency, no context provider,
 * just a value, a listener set and a promise guard.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { BoostEntry, fetchBoosts, persistBoosts, PersistResult } from './boosts.ts';
import { Collection } from './collections.ts';
import { fetchCollections, persistCollections } from './collectionsIO.ts';

interface StoreState<T> {
  data: T[];
  loaded: boolean;
  /** true while the very first fetch is in flight */
  loading: boolean;
}

function createStore<T>(fetcher: () => Promise<T[]>) {
  let state: StoreState<T> = { data: [], loaded: false, loading: false };
  const listeners = new Set<() => void>();
  let inflight: Promise<void> | null = null;

  const emit = () => listeners.forEach((l) => l());

  const set = (next: Partial<StoreState<T>>) => {
    state = { ...state, ...next };
    emit();
  };

  const load = (force = false): Promise<void> => {
    if (state.loaded && !force) return Promise.resolve();
    if (inflight && !force) return inflight;
    set({ loading: true });
    inflight = fetcher()
      .then((data) => set({ data, loaded: true, loading: false }))
      .catch(() => set({ data: [], loaded: true, loading: false }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    load,
    /** replace the cached value — used after a successful save */
    set(data: T[]) {
      set({ data, loaded: true, loading: false });
    },
  };
}

const boostStore = createStore<BoostEntry>(fetchBoosts);
const collectionStore = createStore<Collection>(fetchCollections);

/** Reads a store and triggers the initial load exactly once per session. */
function useStore<T>(store: ReturnType<typeof createStore<T>>) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.load();
  }, [store]);
  return snapshot;
}

export function useBoosts() {
  const { data, loaded, loading } = useStore(boostStore);
  return { boosts: data, loaded, loading };
}

export function useCollections() {
  const { data, loaded, loading } = useStore(collectionStore);
  return { collections: data, loaded, loading };
}

// ---------------------------------------------------------------------------
// Draft state that survives navigation
// ---------------------------------------------------------------------------
/**
 * Unsaved edits are kept here rather than in component state, so navigating
 * away and back does not discard work in progress. `dirty` tells the UI that
 * the draft differs from what is actually persisted.
 */
const drafts: { boosts: BoostEntry[] | null; collections: Collection[] | null } = {
  boosts: null,
  collections: null,
};
const draftListeners = new Set<() => void>();
const emitDrafts = () => draftListeners.forEach((l) => l());

export function useBoostDraft() {
  const { boosts, loaded, loading } = useBoosts();
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    draftListeners.add(l);
    return () => {
      draftListeners.delete(l);
    };
  }, []);

  const working = drafts.boosts ?? boosts;
  const dirty = drafts.boosts !== null;

  return {
    working,
    dirty,
    loaded,
    loading,
    setWorking(next: BoostEntry[]) {
      drafts.boosts = next;
      emitDrafts();
    },
    discard() {
      drafts.boosts = null;
      emitDrafts();
    },
    async save(tokenOverride?: string): Promise<PersistResult> {
      const res = await persistBoosts(working, tokenOverride);
      if (res.ok) {
        boostStore.set(working);
        drafts.boosts = null;
        emitDrafts();
      }
      return res;
    },
  };
}

export function useCollectionDraft() {
  const { collections, loaded, loading } = useCollections();
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    draftListeners.add(l);
    return () => {
      draftListeners.delete(l);
    };
  }, []);

  const working = drafts.collections ?? collections;
  const dirty = drafts.collections !== null;

  return {
    working,
    dirty,
    loaded,
    loading,
    setWorking(next: Collection[]) {
      drafts.collections = next;
      emitDrafts();
    },
    discard() {
      drafts.collections = null;
      emitDrafts();
    },
    async save(tokenOverride?: string): Promise<PersistResult> {
      const res = await persistCollections(working, tokenOverride);
      if (res.ok) {
        collectionStore.set(working);
        drafts.collections = null;
        emitDrafts();
      }
      return res;
    },
  };
}

/** True when either registry has edits that have not been written yet. */
export function hasUnsavedWork(): boolean {
  return drafts.boosts !== null || drafts.collections !== null;
}
