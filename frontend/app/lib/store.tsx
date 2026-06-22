"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "./api";

type Data = {
  health: any;
  leads: any[];
  creatives: any[];
  campaigns: any[];
  audit: any[];
  verify: any;
};

type Store = Data & {
  ready: boolean;
  busy: string;
  error: string;
  refresh: () => Promise<void>;
  run: (name: string, fn: () => Promise<any>) => Promise<any>;
  setError: (s: string) => void;
};

const empty: Data = {
  health: null,
  leads: [],
  creatives: [],
  campaigns: [],
  audit: [],
  verify: null,
};

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(empty);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [health, leads, creatives, campaigns, audit, verify] = await Promise.all([
      api.health(),
      api.leads(),
      api.creatives(),
      api.campaigns(),
      api.audit(),
      api.verify(),
    ]);
    setData({ health, leads, creatives, campaigns, audit, verify });
    setReady(true);
  }, []);

  const run = useCallback(
    async (name: string, fn: () => Promise<any>) => {
      setError("");
      setBusy(name);
      try {
        const r = await fn();
        await refresh();
        return r;
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setBusy("");
      }
    },
    [refresh],
  );

  useEffect(() => {
    // WAKE-UP GATE. A free-tier backend can be cold (~30–70s). To avoid
    // hammering it (which triggers 429 rate-limiting), we probe ONE cheap
    // endpoint (/health) on a backoff until it answers — exactly one request
    // per tick — and only THEN load all the data once.
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const connect = async () => {
      // Phase 1: wait for the backend to be awake. ONE request per attempt,
      // backoff capped at 10s, and it NEVER gives up — so if the free-tier
      // backend takes a while (or wakes late), the page recovers on its own
      // with no manual refresh. The steady probing also helps keep it warm.
      let attempt = 0;
      while (!cancelled) {
        try {
          await api.health();
          break; // awake!
        } catch {
          if (cancelled) return;
          setError(
            "Waking the server… (free-tier cold start — can take up to ~90s). " +
              "It loads automatically, no need to refresh.",
          );
          await sleep(Math.min(2500 * Math.pow(1.35, attempt), 10000));
          attempt += 1;
        }
      }
      if (cancelled) return;

      // Phase 2: backend is warm — load everything once, with a few gentle
      // retries, then fall back to probing again if it somehow fails.
      for (let i = 0; i < 5 && !cancelled; i++) {
        try {
          await refresh();
          if (!cancelled) setError("");
          return;
        } catch (e: any) {
          if (cancelled) return;
          setError(e?.message || "Connecting…");
          await sleep(4000);
        }
      }
      // Extremely rare: warm probe succeeded but loads kept failing — restart.
      if (!cancelled) connect();
    };

    connect();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ ...data, ready, busy, error, refresh, run, setError }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used within DataProvider");
  return v;
}
