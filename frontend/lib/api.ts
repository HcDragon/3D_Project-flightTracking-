const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export function wsUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_WS_URL ||
    API_BASE.replace(/^http/, "ws") + "/ws/worldpulse/";
  return base;
}

export async function fetchRoute(callsign: string) {
  const r = await fetch(`${API_BASE}/api/route/${encodeURIComponent(callsign)}/`, { cache: "force-cache" });
  if (!r.ok) return null;
  return r.json();
}

export async function fetchSnapshot() {
  const r = await fetch(`${API_BASE}/api/snapshot/`, { cache: "no-store" });
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  return r.json();
}
