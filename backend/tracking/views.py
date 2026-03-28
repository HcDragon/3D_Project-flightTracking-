import threading

import requests as http_requests
from rest_framework.response import Response
from rest_framework.views import APIView

from tracking.services.world_state import get_cached_snapshot, refresh_world

ADSBDB_URL = "https://api.adsbdb.com/v0/callsign/{}"
_route_cache: dict = {}
_route_lock = threading.Lock()


class RouteView(APIView):
    """Lookup origin/destination for a callsign via adsbdb.com (free, no auth)."""

    def get(self, request, callsign: str):
        callsign = callsign.strip().upper()
        if not callsign:
            return Response({"error": "missing callsign"}, status=400)

        with _route_lock:
            if callsign in _route_cache:
                return Response(_route_cache[callsign])

        try:
            r = http_requests.get(
                ADSBDB_URL.format(callsign),
                timeout=8,
                headers={"User-Agent": "WorldPulse/1.0"},
            )
            if r.status_code == 404:
                result = {"found": False}
            else:
                r.raise_for_status()
                data = r.json()
                fr = data.get("response", {}).get("flightroute", {})
                if not fr:
                    result = {"found": False}
                else:
                    origin = fr.get("origin") or {}
                    dest = fr.get("destination") or {}
                    result = {
                        "found": True,
                        "airline": (fr.get("airline") or {}).get("name", ""),
                        "origin": {
                            "iata": origin.get("iata_code", ""),
                            "icao": origin.get("icao_code", ""),
                            "name": origin.get("name", ""),
                            "municipality": origin.get("municipality", ""),
                            "country": origin.get("country_name", ""),
                            "lat": origin.get("latitude"),
                            "lon": origin.get("longitude"),
                        },
                        "destination": {
                            "iata": dest.get("iata_code", ""),
                            "icao": dest.get("icao_code", ""),
                            "name": dest.get("name", ""),
                            "municipality": dest.get("municipality", ""),
                            "country": dest.get("country_name", ""),
                            "lat": dest.get("latitude"),
                            "lon": dest.get("longitude"),
                        },
                    }
        except Exception:
            result = {"found": False}

        with _route_lock:
            _route_cache[callsign] = result

        return Response(result)


class SnapshotView(APIView):
    def get(self, request):
        snap = get_cached_snapshot()
        if not snap["full"]["flights"]:
            refresh_world()
            snap = get_cached_snapshot()
        return Response(snap)


class RefreshView(APIView):
    def post(self, request):
        return Response(refresh_world())


class AnalyticsView(APIView):
    def get(self, request):
        snap = get_cached_snapshot()
        return Response(snap.get("analytics", {}))


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "worldpulse"})
