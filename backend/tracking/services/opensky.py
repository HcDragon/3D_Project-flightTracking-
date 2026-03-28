"""
ADS-B Exchange via adsb.lol — free, no auth, ~10 000 live aircraft worldwide.
Uses httpx async so it never blocks the ASGI event loop.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

ADSB_URL = "https://api.adsb.lol/v2/lat/0/lon/0/dist/10000"
HEADERS  = {"User-Agent": "WorldPulse/1.0"}

_last_error_time = 0.0
_backoff_sec     = 5.0


async def fetch_flights_async(timeout: float = 12.0) -> list[dict[str, Any]]:
    """Fetch live aircraft from adsb.lol asynchronously. Returns [] on failure."""
    global _last_error_time, _backoff_sec

    now = time.monotonic()
    if now - _last_error_time < _backoff_sec:
        remaining = _backoff_sec - (now - _last_error_time)
        logger.warning("adsb.lol in backoff (%.0fs remaining)", remaining)
        return []

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(ADSB_URL, headers=HEADERS)
        r.raise_for_status()
        data = r.json()
        _backoff_sec = 5.0
    except Exception as e:
        logger.warning("adsb.lol request failed: %s", e)
        _last_error_time = time.monotonic()
        _backoff_sec = min(_backoff_sec * 2, 60.0)
        return []

    out: list[dict[str, Any]] = []
    for ac in data.get("ac") or []:
        lat = ac.get("lat")
        lon = ac.get("lon")
        if lat is None or lon is None:
            continue

        alt_ft = ac.get("alt_geom") or ac.get("alt_baro")
        alt_m: float | None = None
        if isinstance(alt_ft, (int, float)):
            alt_m = round(float(alt_ft) * 0.3048, 1)

        gs    = ac.get("gs")
        vel_ms: float | None = round(float(gs) * 0.514444, 2) if gs is not None else None

        vr = ac.get("baro_rate") or ac.get("geom_rate")
        vert_ms: float | None = round(float(vr) * 0.00508, 3) if vr is not None else None

        on_ground = ac.get("alt_baro") == "ground"

        out.append({
            "icao24":       (ac.get("hex") or "").lower(),
            "callsign":     (ac.get("flight") or "").strip(),
            "latitude":     float(lat),
            "longitude":    float(lon),
            "altitude_m":   alt_m,
            "velocity_ms":  vel_ms,
            "heading_deg":  ac.get("track"),
            "on_ground":    on_ground,
            "vertical_rate": vert_ms,
            "timestamp":    int(time.time()),
        })

    logger.info("adsb.lol: %d aircraft fetched", len(out))
    return out


# ── sync shim kept for views.py (REST snapshot endpoint) ─────────────────────
def fetch_opensky_states(
    auth_user: str | None = None,
    auth_pass: str | None = None,
    timeout: float = 12.0,
) -> list[dict[str, Any]]:
    """Synchronous wrapper used only by the REST snapshot view."""
    try:
        return asyncio.run(fetch_flights_async(timeout))
    except RuntimeError:
        # Already inside a running event loop (shouldn't happen in REST views)
        return []
