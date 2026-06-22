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
      // Phase 1: wait for the backend to be awake (single request per attempt).
      let awake = false;
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        try {
          await api.health();
          awake = true;
          break;
        } catch {
          if (cancelled) return;
          setError(
            "Waking the server… (free-tier cold start, ~30–60s). This will load automatically.",
          );
          // exponential backoff, capped at 12s, so we never flood the server.
          await sleep(Math.min(3000 * Math.pow(1.4, attempt), 12000));
        }
      }
      if (cancelled || !awake) return;

      // Phase 2: backend is warm — load everything once (with a couple of
      // gentle retries spaced out, just in case).
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
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
