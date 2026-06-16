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
    refresh().catch((e) => setError(e?.message || "Could not reach the API (it may be waking up — retry in ~30s)."));
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
