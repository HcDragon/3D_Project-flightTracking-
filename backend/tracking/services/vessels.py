"""
Maritime tracking: AISStream requires API key / WebSocket.
We provide animated sample routes + optional HTTP placeholder.
"""

from __future__ import annotations

import math
import time
from typing import Any


def _sample_vessels(t: float) -> list[dict[str, Any]]:
    """Simulated vessels moving along great-circle-ish paths."""
    vessels = []
    routes = [
        {
            "mmsi": "123456789",
            "name": "NORDIC SPIRIT",
            "base_lat": 35.0,
            "base_lon": -10.0,
            "speed_kn": 18.5,
            "phase": 0.0,
        },
        {
            "mmsi": "987654321",
            "name": "PACIFIC TRADER",
            "base_lat": 1.0,
            "base_lon": 103.0,
            "speed_kn": 12.0,
            "phase": 1.2,
        },
        {
            "mmsi": "555666777",
            "name": "ATLANTIC LINK",
            "base_lat": 45.0,
            "base_lon": -35.0,
            "speed_kn": 21.0,
            "phase": 2.5,
        },
    ]
    for i, r in enumerate(routes):
        phase = r["phase"] + t * 0.00002 * (i + 1)
        lat = r["base_lat"] + 3.0 * math.sin(phase)
        lon = r["base_lon"] + 5.0 * math.cos(phase * 0.8)
        heading = (math.degrees(math.atan2(math.cos(phase), math.sin(phase * 0.9))) + 360) % 360
        vessels.append(
            {
                "mmsi": r["mmsi"],
                "name": r["name"],
                "latitude": lat,
                "longitude": lon,
                "speed_kn": r["speed_kn"] + 0.5 * math.sin(phase * 3),
                "heading_deg": heading,
                "timestamp": int(time.time()),
            }
        )
    return vessels


def fetch_vessel_positions() -> list[dict[str, Any]]:
    """Live AIS feeds typically need keys; we simulate realistic movement."""
    return _sample_vessels(time.time())
