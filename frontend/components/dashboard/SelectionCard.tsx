"use client";

import { useEffect, useState } from "react";
import { Crosshair, Plane, PlaneLanding, PlaneTakeoff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRoute } from "@/lib/api";
import type { Flight, FlightRoute } from "@/lib/types";

type Props = {
  flight: Flight;
  onFlyTo: () => void;
  onClose: () => void;
  onRoute: (r: FlightRoute | null) => void;
};

function headingToCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function SelectionCard({ flight, onFlyTo, onClose, onRoute }: Props) {
  const f = flight;
  const [route, setRoute] = useState<FlightRoute | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const callsign = (f.callsign || "").trim();
    if (!callsign) { setRoute({ found: false }); onRoute(null); return; }

    setLoading(true);
    setRoute(null);
    fetchRoute(callsign)
      .then((data) => {
        const r = data ?? { found: false };
        setRoute(r);
        onRoute(r);
      })
      .catch(() => { setRoute({ found: false }); onRoute(null); })
      .finally(() => setLoading(false));
  }, [f.icao24, f.callsign]);

  const cardinal = f.heading_deg != null ? headingToCardinal(f.heading_deg) : null;

  return (
    <Card className="glass-panel glass-panel--sunlit w-full max-w-sm border-cyan-400/30">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/30 to-amber-500/25 ring-1 ring-cyan-400/35">
            <Plane className="h-4 w-4 text-cyan-200" />
          </span>
          <div className="flex flex-col">
            <span className="bg-gradient-to-r from-cyan-100 to-amber-100 bg-clip-text text-transparent font-bold">
              {(f.callsign || f.icao24).trim()}
            </span>
            {route?.airline && (
              <span className="text-[10px] text-amber-200/60 font-normal">{route.airline}</span>
            )}
          </div>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">

        {/* ── Route block ── */}
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            <span className="text-xs text-cyan-300/70">Looking up route…</span>
          </div>
        ) : route?.found ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
            {/* Origin */}
            <div className="flex items-start gap-2">
              <PlaneTakeoff className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-emerald-300">
                    {route.origin?.iata || route.origin?.icao}
                  </span>
                  <span className="text-[10px] text-amber-200/50">{route.origin?.municipality}</span>
                </div>
                <p className="text-[11px] text-amber-100/70 truncate">{route.origin?.name}</p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-1 pl-1">
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-rose-500/40" />
              <span className="text-[10px] text-amber-200/40">
                {cardinal ? `${cardinal} ·` : ""} {f.heading_deg?.toFixed(0)}°
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-rose-500/40" />
            </div>

            {/* Destination */}
            <div className="flex items-start gap-2">
              <PlaneLanding className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-rose-300">
                    {route.destination?.iata || route.destination?.icao}
                  </span>
                  <span className="text-[10px] text-amber-200/50">{route.destination?.municipality}</span>
                </div>
                <p className="text-[11px] text-amber-100/70 truncate">{route.destination?.name}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2">
            <span className="text-xs text-amber-200/50">Route data unavailable for this flight</span>
          </div>
        )}

        {/* ── Flight stats ── */}
        <Row label="ICAO24" value={f.icao24} mono />
        <Row
          label="Altitude"
          value={f.altitude_m != null ? `${Math.round(f.altitude_m).toLocaleString()} m` : "—"}
        />
        <Row
          label="Speed"
          value={f.velocity_ms != null ? `${(f.velocity_ms * 1.944).toFixed(0)} kts` : "—"}
        />
        <Row
          label="Status"
          value={f.on_ground ? "On Ground" : "Airborne"}
        />

        <Button
          variant="outline"
          className="w-full gap-2 border-amber-400/35 bg-gradient-to-r from-amber-500/10 to-cyan-500/10 text-amber-50 hover:from-amber-500/20 hover:to-cyan-500/15"
          onClick={onFlyTo}
        >
          <Crosshair className="h-4 w-4 text-amber-300" />
          Zoom to aircraft
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-amber-500/10 py-1 last:border-0">
      <span className="text-amber-200/50">{label}</span>
      <span className={mono ? "font-mono text-xs text-cyan-100/90" : "text-right text-amber-50/90"}>
        {value}
      </span>
    </div>
  );
}
