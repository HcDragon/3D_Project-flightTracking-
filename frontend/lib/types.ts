export type FlightRoute = {
  found: boolean;
  airline?: string;
  origin?: { iata: string; icao: string; name: string; municipality: string; country: string; lat?: number; lon?: number };
  destination?: { iata: string; icao: string; name: string; municipality: string; country: string; lat?: number; lon?: number };
};

export type Flight = {
  icao24: string;
  callsign?: string;
  latitude: number;
  longitude: number;
  altitude_m?: number | null;
  velocity_ms?: number | null;
  heading_deg?: number | null;
  on_ground?: boolean;
  vertical_rate?: number | null;
  timestamp: number;
};

export type Trail = [number, number, number][];

export type WorldFull = {
  flights: Flight[];
  flight_trails: Record<string, Trail>;
};

export type Analytics = {
  active_flights: number;
  on_ground: number;
  average_speed_ms: number;
  average_altitude_m: number;
  busiest_region: string;
  last_update_iso: string;
};

export type AlertItem = {
  id: string;
  severity: "info" | "warning" | "critical";
  type: string;
  message: string;
  entity?: { kind: string; id: string };
};

export type WorldPayload = {
  timestamp: number;
  full: WorldFull;
  delta?: {
    flights: Record<string, Flight>;
  };
  analytics: Analytics;
  alerts: AlertItem[];
};
