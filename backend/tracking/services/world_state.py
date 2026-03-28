"""
Central cache, delta computation, analytics, and alerts (aircraft only).
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from django.conf import settings

from tracking.services.opensky import fetch_flights_async, fetch_opensky_states

logger = logging.getLogger(__name__)


def _parse_alert_zone() -> tuple[float, float, float, float] | None:
    raw = getattr(settings, "WORLDPULSE_ALERT_ZONE", None)
    if not raw:
        return None
    try:
        parts = [float(x.strip()) for x in str(raw).split(",")]
        if len(parts) == 4:
            return parts[0], parts[1], parts[2], parts[3]
    except ValueError:
        pass
    return None


@dataclass
class WorldState:
    flights: dict[str, dict[str, Any]] = field(default_factory=dict)
    flight_trails: dict[str, list[list[float]]] = field(default_factory=dict)
    last_update: float = 0.0
    prev_speed_flight: dict[str, float] = field(default_factory=dict)
    inside_zone_flight: set[str] = field(default_factory=set)


_state = WorldState()
_sync_lock = threading.Lock()   # for sync REST views
_async_lock = asyncio.Lock()    # for async consumer — created lazily per event loop


def _get_async_lock() -> asyncio.Lock:
    """Return a per-event-loop asyncio.Lock (safe across restarts)."""
    global _async_lock
    try:
        loop = asyncio.get_running_loop()
        if not hasattr(_async_lock, "_loop") or _async_lock._loop is not loop:  # type: ignore[attr-defined]
            _async_lock = asyncio.Lock()
    except RuntimeError:
        pass
    return _async_lock


TRAIL_MAX = 40
SPEED_SPIKE_FLIGHT_MS = 80.0


def _append_trail(
    trails: dict[str, list[list[float]]],
    key: str,
    lon: float,
    lat: float,
    alt: float | None,
) -> None:
    trail = trails.setdefault(key, [])
    trail.append([lon, lat, alt if alt is not None else 0.0])
    if len(trail) > TRAIL_MAX:
        trail[:] = trail[-TRAIL_MAX:]


def _build_payload(flights_raw: list[dict[str, Any]]) -> dict[str, Any]:
    """Update shared state from raw flight list and return broadcast payload."""
    zone = _parse_alert_zone()
    alerts: list[dict[str, Any]] = []

    if not flights_raw and _state.flights:
        logger.debug("No new data; serving cached state (%d flights)", len(_state.flights))
        return _cached_payload()

    new_flights: dict[str, dict[str, Any]] = {}
    for f in flights_raw:
        icao = f.get("icao24") or ""
        if not icao:
            continue
        new_flights[icao] = f
        alt = f.get("altitude_m")
        _append_trail(
            _state.flight_trails, icao,
            float(f["longitude"]), float(f["latitude"]),
            float(alt) if alt is not None else None,
        )

    for icao, f in new_flights.items():
        lat, lon = f.get("latitude"), f.get("longitude")
        if lat is None or lon is None:
            continue
        if zone:
            zmin_lat, zmax_lat, zmin_lon, zmax_lon = zone
            inside = zmin_lat <= lat <= zmax_lat and zmin_lon <= lon <= zmax_lon
            was_inside = icao in _state.inside_zone_flight
            if inside and not was_inside:
                alerts.append({
                    "id": f"zone-{icao}-{int(time.time())}",
                    "severity": "warning",
                    "type": "aircraft_zone_entry",
                    "message": f"Aircraft {f.get('callsign') or icao} entered monitored zone",
                    "entity": {"kind": "flight", "id": icao},
                })
            if inside:
                _state.inside_zone_flight.add(icao)
            else:
                _state.inside_zone_flight.discard(icao)

        vel = f.get("velocity_ms")
        if vel is not None and icao in _state.prev_speed_flight:
            prev = _state.prev_speed_flight[icao]
            if prev > 10 and vel > prev + SPEED_SPIKE_FLIGHT_MS:
                alerts.append({
                    "id": f"spike-{icao}-{int(time.time())}",
                    "severity": "info",
                    "type": "speed_spike",
                    "message": f"Unusual speed change for {f.get('callsign') or icao}",
                    "entity": {"kind": "flight", "id": icao},
                })
        if vel is not None:
            _state.prev_speed_flight[icao] = float(vel)

    _state.flights = new_flights
    _state.last_update = time.time()

    analytics = _compute_analytics(new_flights)

    airborne = [
        {
            "icao24":       f["icao24"],
            "callsign":     f.get("callsign", ""),
            "latitude":     round(f["latitude"], 4),
            "longitude":    round(f["longitude"], 4),
            "altitude_m":   round(f["altitude_m"], 0) if f.get("altitude_m") is not None else None,
            "velocity_ms":  round(f["velocity_ms"], 1) if f.get("velocity_ms") is not None else None,
            "heading_deg":  round(f["heading_deg"], 1) if f.get("heading_deg") is not None else None,
            "on_ground":    f.get("on_ground", False),
            "vertical_rate": f.get("vertical_rate"),
            "timestamp":    f.get("timestamp", 0),
        }
        for f in new_flights.values() if not f.get("on_ground")
    ]
    airborne.sort(key=lambda x: x.get("altitude_m") or 0, reverse=True)

    return {
        "timestamp": int(_state.last_update),
        "full": {
            "flights": airborne[:1500],
            "vessels": [],
            "flight_trails": {},
            "vessel_trails": {},
        },
        "delta":     {"flights": {}, "vessels": {}},
        "analytics": analytics,
        "alerts":    alerts[-50:],
    }


def _cached_payload() -> dict[str, Any]:
    airborne = [f for f in _state.flights.values() if not f.get("on_ground")]
    airborne.sort(key=lambda x: x.get("altitude_m") or 0, reverse=True)
    return {
        "timestamp": int(_state.last_update),
        "full": {
            "flights": airborne[:1500],
            "vessels": [],
            "flight_trails": {},
            "vessel_trails": {},
        },
        "delta":     {"flights": {}, "vessels": {}},
        "analytics": _compute_analytics(_state.flights),
        "alerts":    [],
    }


# ── Async entry point (used by WebSocket consumer) ───────────────────────────

async def refresh_world_async() -> dict[str, Any]:
    """Async fetch + update. Never blocks the event loop."""
    async with _get_async_lock():
        flights_raw = await fetch_flights_async()
        return _build_payload(flights_raw)


# ── Sync entry point (used by REST views only) ────────────────────────────────

def refresh_world() -> dict[str, Any]:
    with _sync_lock:
        flights_raw = fetch_opensky_states()
        return _build_payload(flights_raw)


def get_cached_snapshot() -> dict[str, Any]:
    with _sync_lock:
        return {
            "timestamp": int(_state.last_update or time.time()),
            "full": {
                "flights": list(_state.flights.values()),
                "vessels": [],
                "flight_trails": dict(_state.flight_trails),
                "vessel_trails": {},
            },
            "analytics": _compute_analytics(_state.flights),
        }


def _compute_analytics(flights: dict[str, dict[str, Any]]) -> dict[str, Any]:
    speeds: list[float] = []
    alts:   list[float] = []
    on_ground = 0
    for f in flights.values():
        v = f.get("velocity_ms")
        if v is not None:
            speeds.append(float(v))
        a = f.get("altitude_m")
        if a is not None:
            alts.append(float(a))
        if f.get("on_ground"):
            on_ground += 1

    buckets: dict[str, int] = {}
    for f in flights.values():
        lat, lon = f.get("latitude"), f.get("longitude")
        if lat is None or lon is None:
            continue
        key = f"{int(lat // 10) * 10},{int(lon // 10) * 10}"
        buckets[key] = buckets.get(key, 0) + 1

    return {
        "active_flights":    len(flights),
        "on_ground":         on_ground,
        "average_speed_ms":  round(sum(speeds) / len(speeds) if speeds else 0.0, 2),
        "average_altitude_m": round(sum(alts) / len(alts) if alts else 0.0, 0),
        "busiest_region":    max(buckets, key=buckets.get) if buckets else "—",
        "last_update_iso":   time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(_state.last_update or time.time())
        ),
    }
