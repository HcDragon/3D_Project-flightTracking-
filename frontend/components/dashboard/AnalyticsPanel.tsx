"use client";

import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Analytics } from "@/lib/types";

type Props = {
  analytics: Analytics | null;
  spark: { t: string; v: number }[];
};

export function AnalyticsPanel({ analytics, spark }: Props) {
  if (!analytics) {
    return (
      <Card className="glass-panel border-amber-500/15">
        <CardHeader>
          <CardTitle className="text-amber-100/80">Analytics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-100/50">
          Awaiting telemetry…
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45 }}
      className="flex flex-col gap-3"
    >
      <Card className="glass-panel glass-panel--sunlit border-cyan-500/15">
        <CardHeader className="pb-2">
          <CardTitle className="bg-gradient-to-r from-amber-200/90 to-cyan-200/80 bg-clip-text text-transparent">
            Live aircraft
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Active tracks" value={String(analytics.active_flights)} />
          <Metric label="On ground" value={String(analytics.on_ground)} />
          <Metric
            label="Avg speed"
            value={`${analytics.average_speed_ms} m/s`}
          />
          <Metric
            label="Avg altitude"
            value={`${Math.round(analytics.average_altitude_m)} m`}
          />
          <Metric
            label="Busiest grid"
            value={analytics.busiest_region}
            className="col-span-2"
          />
        </CardContent>
      </Card>

      <Card className="glass-panel border-violet-500/15">
        <CardHeader className="pb-0">
          <CardTitle className="bg-gradient-to-r from-violet-200/85 to-amber-200/70 bg-clip-text text-transparent">
            Traffic pulse
          </CardTitle>
        </CardHeader>
        <CardContent className="h-36 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <defs>
                <linearGradient id="wp-sun" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9} />
                  <stop offset="45%" stopColor="#f97316" stopOpacity={0.75} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="wp-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,27,75,0.95))",
                  border: "1px solid rgba(251,191,36,0.25)",
                  borderRadius: 12,
                  color: "#fef3c7",
                }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="url(#wp-sun)"
                fill="url(#wp-fill)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-amber-100/45">
        Last update:{" "}
        <span className="font-mono text-cyan-200/80">
          {analytics.last_update_iso}
        </span>
      </p>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`wp-metric-tile ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-amber-200/45">
        {label}
      </div>
      <div className="mt-1 bg-gradient-to-r from-amber-50 to-cyan-100 bg-clip-text font-mono text-base font-semibold text-transparent">
        {value}
      </div>
    </div>
  );
}
