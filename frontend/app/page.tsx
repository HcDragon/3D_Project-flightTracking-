"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Activity, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { SelectionCard } from "@/components/dashboard/SelectionCard";
import { Badge } from "@/components/ui/badge";
import { useWorldPulse } from "@/hooks/useWorldPulse";
import type { Flight, FlightRoute } from "@/lib/types";

const CesiumGlobe = dynamic(
  () =>
    import("@/components/globe/CesiumGlobe").then((m) => m.CesiumGlobe),
  { ssr: false, loading: () => <GlobeLoading /> }
);

function GlobeLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-950 via-indigo-950/90 to-slate-950">
      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 opacity-90 shadow-sun blur-[1px]" />
      <div className="text-sm font-medium text-amber-100/90">
        Initializing globe…
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-amber-300 to-orange-400" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { full, analytics, alerts, spark, connected, error } = useWorldPulse();
  const [selection, setSelection] = useState<{
    id: string;
    data: Flight;
  } | null>(null);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const [activeRoute, setActiveRoute] = useState<FlightRoute | null>(null);

  const deselect = useCallback(() => {
    setSelection(null);
    setFocus(null);
    setActiveRoute(null);
  }, []);

  const onSelect = useCallback((sel: { id: string; data: Flight } | null) => {
    setSelection(sel);
    if (sel) setFocus({ id: sel.id });
    else setFocus(null);
  }, []);

  // Escape key → exit individual tracking, back to globe view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") deselect();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deselect]);

  const flights = full?.flights ?? [];
  const flightTrails = full?.flight_trails ?? {};

  const sparkData = useMemo(
    () => (spark.length ? spark : [{ t: "—", v: 0 }]),
    [spark]
  );

  const routeArc =
    activeRoute?.found &&
    activeRoute.origin?.lat != null &&
    activeRoute.destination?.lat != null
      ? {
          originLat: activeRoute.origin.lat!,
          originLon: activeRoute.origin.lon!,
          destLat: activeRoute.destination.lat!,
          destLon: activeRoute.destination.lon!,
        }
      : null;

  return (
    <main className="wp-ambient relative h-screen w-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-20 z-[5] h-56 w-56 opacity-90 md:h-72 md:w-72">
        <div className="wp-sun-orb h-full w-full scale-100" />
      </div>

      <div className="absolute inset-0 z-0">
        <CesiumGlobe
          flights={flights}
          flightTrails={flightTrails}
          onSelect={onSelect}
          focusTarget={focus}
          routeArc={routeArc}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-slate-950/88 via-transparent to-indigo-950/75"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-sun-fade opacity-80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-sky-fade opacity-90"
        aria-hidden
      />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto flex flex-wrap items-center gap-4"
        >
          <div className="glass-panel glass-panel--sunlit flex items-center gap-3 px-5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/30 via-cyan-500/25 to-indigo-500/30 ring-1 ring-amber-400/40">
              <Activity className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h1 className="wp-title-gradient text-lg font-bold tracking-tight">
                WorldPulse
              </h1>
              <p className="text-xs text-amber-100/55">
                Live aircraft · adsb.lol
              </p>
            </div>
          </div>
          <Badge
            variant={connected ? "default" : "secondary"}
            className="gap-1.5 rounded-full border-amber-500/25 bg-gradient-to-r from-emerald-500/20 to-cyan-500/15 px-3 py-1 shadow-sun"
          >
            <Radio
              className={`h-3 w-3 ${connected ? "text-emerald-300" : "text-slate-500"}`}
            />
            {connected ? "Stream online" : "Connecting…"}
          </Badge>
          {error && (
            <span className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-2 py-1 text-xs text-rose-200">
              {error}
            </span>
          )}
        </motion.div>
      </header>

      <aside className="pointer-events-none absolute bottom-6 right-6 top-24 z-20 flex w-[min(380px,92vw)] flex-col gap-4">
        <div className="pointer-events-auto">
          <AnalyticsPanel analytics={analytics} spark={sparkData} />
        </div>
        <div className="pointer-events-auto">
          <AlertFeed alerts={alerts} />
        </div>
      </aside>

      {selection && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto absolute bottom-6 left-6 z-20 max-w-[min(400px,92vw)] flex flex-col gap-2"
        >
          {/* ESC hint */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 w-fit">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/60 border border-white/20">ESC</kbd>
            <span className="text-[10px] text-white/40">exit tracking</span>
          </div>
          <SelectionCard
            flight={selection.data}
            onClose={() => deselect()}
            onFlyTo={() => setFocus({ id: selection.id })}
            onRoute={setActiveRoute}
          />
        </motion.div>
      )}

      <footer className="pointer-events-none absolute bottom-4 left-6 z-10 max-w-md text-[10px] leading-relaxed text-amber-100/45">
        <span className="bg-gradient-to-r from-cyan-300/80 to-amber-200/70 bg-clip-text text-transparent">
          OpenSky Network
        </span>
        <span className="text-white/35"> · Not for navigation</span>
      </footer>
    </main>
  );
}
