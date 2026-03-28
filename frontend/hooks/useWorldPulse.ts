"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSnapshot, wsUrl } from "@/lib/api";
import type { AlertItem, Analytics, WorldFull, WorldPayload } from "@/lib/types";

function normalizeFull(raw: Record<string, unknown>): WorldFull {
  const flights = (raw.flights as WorldFull["flights"]) ?? [];
  const flight_trails =
    (raw.flight_trails as WorldFull["flight_trails"]) ?? {};
  return { flights, flight_trails };
}

export function useWorldPulse() {
  const [full, setFull] = useState<WorldFull | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [spark, setSpark] = useState<{ t: string; v: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const applyPayload = useCallback((p: WorldPayload) => {
    setFull(normalizeFull(p.full as unknown as Record<string, unknown>));
    setAnalytics(p.analytics);
    if (p.analytics) {
      const t = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setSpark((prev) =>
        [...prev, { t, v: p.analytics.active_flights }].slice(-24)
      );
    }
    if (p.alerts?.length) {
      setAlerts((prev) => [...p.alerts, ...prev].slice(0, 200));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((snap) => {
        if (cancelled) return;
        applyPayload({
          timestamp: snap.timestamp,
          full: normalizeFull(
            snap.full as unknown as Record<string, unknown>
          ),
          analytics: snap.analytics,
          alerts: [],
        });
      })
      .catch(() => {
        if (!cancelled) setError("Initial snapshot failed");
      });
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  useEffect(() => {
    const url = wsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("WebSocket error");
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "world_update" && msg.payload) {
          applyPayload(msg.payload as WorldPayload);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [applyPayload]);

  return { full, analytics, alerts, spark, connected, error, setAlerts };
}
