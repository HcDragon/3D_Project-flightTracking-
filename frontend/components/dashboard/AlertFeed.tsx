"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AlertItem } from "@/lib/types";

type Props = {
  alerts: AlertItem[];
};

export function AlertFeed({ alerts }: Props) {
  return (
    <Card className="glass-panel max-h-[320px] border-orange-400/25 shadow-[0_0_40px_rgba(251,146,60,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-orange-200 to-amber-100 bg-clip-text text-transparent">
          <AlertTriangle className="h-4 w-4 text-orange-400" />
          Alert stream
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[220px] px-5 pb-5">
          <div className="flex flex-col gap-2 pr-3">
            <AnimatePresence initial={false}>
              {alerts.length === 0 ? (
                <p className="text-sm text-amber-100/45">
                  No automated alerts yet. Zone entry and anomaly rules are
                  active.
                </p>
              ) : (
                alerts.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-orange-500/15 bg-gradient-to-br from-white/[0.07] to-orange-950/20 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      {a.severity === "warning" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-400" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 text-cyan-400" />
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              a.severity === "warning" ? "warning" : "default"
                            }
                          >
                            {a.type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-amber-100/40">
                            {a.entity?.kind} · {a.entity?.id}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-amber-50/90">
                          {a.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
