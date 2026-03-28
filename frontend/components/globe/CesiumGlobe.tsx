"use client";

import { useEffect, useRef } from "react";
import type { Flight, Trail } from "@/lib/types";
import { AIRCRAFT_MODEL_URI } from "@/lib/cesium-aircraft";

type CesiumWindow = Window & {
  Cesium?: typeof import("cesium");
  CESIUM_BASE_URL?: string;
};

type RouteArc = { originLat: number; originLon: number; destLat: number; destLon: number } | null;

type Props = {
  flights: Flight[];
  flightTrails: Record<string, Trail>;
  onSelect: (sel: { id: string; data: Flight } | null) => void;
  focusTarget?: { id: string } | null;
  routeArc?: RouteArc;
};

const MAX_FLIGHTS = 1500;

/** Draws a clean SVG-style airplane silhouette on a canvas, rotated to heading. */
const _iconCache = new Map<number, HTMLCanvasElement>();
function getAircraftIcon(headingDeg: number): HTMLCanvasElement {
  const bucket = Math.round((((headingDeg % 360) + 360) % 360) / 10) * 10;
  let c = _iconCache.get(bucket);
  if (c) return c;

  const size = 32;
  c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  // heading 0 = north = up on screen; canvas default 0 = right, offset -90°
  ctx.rotate((bucket * Math.PI) / 180 - Math.PI / 2);

  const s = size * 0.42; // scale factor

  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 3;

  ctx.fillStyle = "#38bdf8";   // cyan body
  ctx.strokeStyle = "#0e7490"; // darker cyan outline
  ctx.lineWidth = 0.8;

  // ── fuselage (elongated ellipse along X axis) ──
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.95, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ── nose cone (pointed right = forward) ──
  ctx.beginPath();
  ctx.moveTo(s * 0.95, 0);
  ctx.lineTo(s * 0.65, -s * 0.12);
  ctx.lineTo(s * 0.65,  s * 0.12);
  ctx.closePath();
  ctx.fill();

  // ── main wings ──
  ctx.beginPath();
  ctx.moveTo(s * 0.1,  0);
  ctx.lineTo(-s * 0.25, -s * 0.85);
  ctx.lineTo(-s * 0.45, -s * 0.85);
  ctx.lineTo(-s * 0.2,   0);
  ctx.lineTo(-s * 0.45,  s * 0.85);
  ctx.lineTo(-s * 0.25,  s * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── tail fins ──
  ctx.beginPath();
  ctx.moveTo(-s * 0.65, 0);
  ctx.lineTo(-s * 0.95, -s * 0.42);
  ctx.lineTo(-s * 0.95, -s * 0.28);
  ctx.lineTo(-s * 0.65, -s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-s * 0.65, 0);
  ctx.lineTo(-s * 0.95,  s * 0.42);
  ctx.lineTo(-s * 0.95,  s * 0.28);
  ctx.lineTo(-s * 0.65,  s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
  _iconCache.set(bucket, c);
  return c;
}

async function setupEarth(
  Cesium: typeof import("cesium"),
  viewer: import("cesium").Viewer
) {
  viewer.imageryLayers.removeAll();
  try {
    const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
    );
    viewer.imageryLayers.addImageryProvider(esri);
  } catch {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        maximumLevel: 19,
        credit: "© OpenStreetMap © CARTO",
      })
    );
  }
  const layer = viewer.imageryLayers.get(0);
  if (layer) {
    layer.brightness = 1.08;
    layer.contrast = 1.1;
    layer.saturation = 1.15;
  }
  viewer.scene.globe.showGroundAtmosphere = true;
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;
}

/** Build orientation for Cesium_Air.glb.
 * The model's nose points along +X in model space.
 * headingPitchRollQuaternion: heading rotates around local Up,
 * pitch -90° tilts +Z (model up) to align with ENU East — not what we want.
 * Correct: heading only, pitch=0. Cesium_Air nose is already along local East
 * after headingPitchRollQuaternion applies heading rotation.
 */
function makeOrientation(
  Cesium: typeof import("cesium"),
  pos: import("cesium").Cartesian3,
  headingDeg: number
): import("cesium").Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(headingDeg),
    0,
    0
  );
  return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
}

/** Sample N points along a true great-circle arc (spherical slerp). */
function greatCirclePositions(
  Cesium: typeof import("cesium"),
  lon1: number, lat1: number,
  lon2: number, lat2: number,
  altM: number,
  steps = 80
): import("cesium").Cartesian3[] {
  const R = 1; // unit sphere — altitude added via fromRadians
  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad, λ1 = lon1 * toRad;
  const φ2 = lat2 * toRad, λ2 = lon2 * toRad;
  // Convert to unit Cartesian
  const ax = Math.cos(φ1) * Math.cos(λ1), ay = Math.cos(φ1) * Math.sin(λ1), az = Math.sin(φ1);
  const bx = Math.cos(φ2) * Math.cos(λ2), by = Math.cos(φ2) * Math.sin(λ2), bz = Math.sin(φ2);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const omega = Math.acos(dot);
  const pts: import("cesium").Cartesian3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let px: number, py: number, pz: number;
    if (omega < 1e-10) {
      px = ax; py = ay; pz = az;
    } else {
      const sa = Math.sin((1 - t) * omega) / Math.sin(omega);
      const sb = Math.sin(t * omega) / Math.sin(omega);
      px = sa * ax + sb * bx;
      py = sa * ay + sb * by;
      pz = sa * az + sb * bz;
    }
    void R;
    const lat = Math.atan2(pz, Math.sqrt(px * px + py * py));
    const lon = Math.atan2(py, px);
    pts.push(Cesium.Cartesian3.fromRadians(lon, lat, altM));
  }
  return pts;
}

export function CesiumGlobe({ flights, flightTrails, onSelect, focusTarget, routeArc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const readyRef = useRef(false);
  const lastInputRef = useRef(Date.now());

  const flightsRef = useRef(flights);
  const trailsRef = useRef(flightTrails);
  flightsRef.current = flights;
  trailsRef.current = flightTrails;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const billboardsRef = useRef<import("cesium").BillboardCollection | null>(null);
  const trailsCollRef = useRef<import("cesium").PolylineCollection | null>(null);

  const icaoToIdxRef = useRef<Map<string, number>>(new Map());
  const icaoToPolyRef = useRef<Map<string, import("cesium").Polyline>>(new Map());

  // The single 3-D model entity shown for the selected flight
  const modelEntityRef = useRef<import("cesium").Entity | null>(null);
  const selectedIcaoRef = useRef<string | null>(null);

  // Route arc polyline
  const routeArcRef = useRef<import("cesium").Polyline | null>(null);
  const routeArcDataRef = useRef<RouteArc>(null);
  routeArcDataRef.current = routeArc ?? null;

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Show the billboard for icao (restore after deselect). */
  function showBillboard(icao: string) {
    const bbs = billboardsRef.current;
    if (!bbs) return;
    const idx = icaoToIdxRef.current.get(icao);
    if (idx !== undefined) {
      const bb = bbs.get(idx);
      if (bb) bb.show = true;
    }
  }

  /** Hide the billboard for icao (while 3-D model is shown). */
  function hideBillboard(icao: string) {
    const bbs = billboardsRef.current;
    if (!bbs) return;
    const idx = icaoToIdxRef.current.get(icao);
    if (idx !== undefined) {
      const bb = bbs.get(idx);
      if (bb) bb.show = false;
    }
  }

  /** Draw (or update) the great-circle route arc on the globe. */
  function drawRouteArc(Cesium: typeof import("cesium"), arc: RouteArc, flightAltM: number) {
    const polyColl = trailsCollRef.current;
    if (!polyColl) return;
    // Remove old arc
    if (routeArcRef.current) { polyColl.remove(routeArcRef.current); routeArcRef.current = null; }
    if (!arc) return;
    const ARC_ALT = Math.max(flightAltM, 10_000);
    const positions = greatCirclePositions(
      Cesium, arc.originLon, arc.originLat, arc.destLon, arc.destLat, ARC_ALT
    );
    routeArcRef.current = polyColl.add({
      positions,
      width: 2,
      material: Cesium.Material.fromType("PolylineGlow", {
        glowPower: 0.25,
        color: Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.75),
      }),
    });
  }

  /** Remove the current 3-D model entity, untrack it, and restore its billboard. */
  function clearModel() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    // Release trackedEntity first so Cesium stops locking the camera
    if (viewer.trackedEntity) viewer.trackedEntity = undefined;
    if (modelEntityRef.current) {
      viewer.entities.remove(modelEntityRef.current);
      modelEntityRef.current = null;
    }
    if (selectedIcaoRef.current) {
      showBillboard(selectedIcaoRef.current);
      selectedIcaoRef.current = null;
    }
    // Clear route arc
    const polyColl = trailsCollRef.current;
    if (polyColl && routeArcRef.current) {
      polyColl.remove(routeArcRef.current);
      routeArcRef.current = null;
    }
  }

  /** Spawn a 3-D model entity and lock the camera to follow it (trackedEntity). */
  function spawnModel(Cesium: typeof import("cesium"), f: Flight) {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    clearModel();

    const altM =
      f.altitude_m != null && Number.isFinite(f.altitude_m) && f.altitude_m > 100
        ? f.altitude_m : 10_000;

    const pos = Cesium.Cartesian3.fromDegrees(f.longitude, f.latitude, altM);
    const ori = makeOrientation(Cesium, pos, f.heading_deg ?? 0);

    const entity = viewer.entities.add({
      id: `model-${f.icao24}`,
      position: new Cesium.ConstantPositionProperty(pos, Cesium.ReferenceFrame.FIXED),
      orientation: new Cesium.ConstantProperty(ori),
      model: {
        uri: AIRCRAFT_MODEL_URI,
        minimumPixelSize: 80,
        maximumScale: 20_000,
        scale: 1,
        runAnimations: true,
        heightReference: Cesium.HeightReference.NONE,
        silhouetteColor: Cesium.Color.CYAN.withAlpha(0.9),
        silhouetteSize: 2,
      },
    });

    modelEntityRef.current = entity;
    selectedIcaoRef.current = f.icao24;
    hideBillboard(f.icao24);

    // trackedEntity = Cesium built-in chase-cam: camera follows entity every frame
    viewer.trackedEntity = entity;

    // Set the chase-cam offset: 8 km behind, 2 km above, looking slightly down
    viewer.scene.camera.lookAtTransform(
      Cesium.Matrix4.IDENTITY,
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(f.heading_deg ?? 0),
        Cesium.Math.toRadians(-15),
        8_000
      )
    );
  }

  // ── sync billboards + trails ──────────────────────────────────────────────
  const syncRef = useRef(() => {
    const w = window as CesiumWindow;
    const Cesium = w.Cesium;
    if (!Cesium || !readyRef.current) return;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const bbs = billboardsRef.current!;
    const polyColl = trailsCollRef.current!;

    const capped = [...flightsRef.current]
      .filter((f) => !f.on_ground)
      .sort((a, b) => (b.altitude_m ?? 0) - (a.altitude_m ?? 0))
      .slice(0, MAX_FLIGHTS);

    const liveIds = new Set(capped.map((f) => f.icao24));

    for (const [icao, idx] of Array.from(icaoToIdxRef.current)) {
      if (!liveIds.has(icao)) {
        const bb = bbs.get(idx);
        if (bb) bb.show = false;
        icaoToIdxRef.current.delete(icao);
      }
    }
    for (const [icao, poly] of Array.from(icaoToPolyRef.current)) {
      if (!liveIds.has(icao)) {
        polyColl.remove(poly);
        icaoToPolyRef.current.delete(icao);
      }
    }

    for (const f of capped) {
      const altM =
        f.altitude_m != null && Number.isFinite(f.altitude_m) && f.altitude_m > 100
          ? f.altitude_m
          : 10_000;
      const pos = Cesium.Cartesian3.fromDegrees(f.longitude, f.latitude, altM);
      const icon = getAircraftIcon(f.heading_deg ?? 0);
      const isSelected = f.icao24 === selectedIcaoRef.current;

      const existingIdx = icaoToIdxRef.current.get(f.icao24);
      if (existingIdx !== undefined) {
        const bb = bbs.get(existingIdx);
        if (bb) {
          bb.position = pos;
          bb.image = icon;
          // keep hidden if this is the selected flight (3-D model is shown instead)
          if (!isSelected) bb.show = true;
        }
      } else {
        bbs.add({
          position: pos,
          image: icon,
          width: 32,
          height: 32,
          show: !isSelected,
          scaleByDistance: new Cesium.NearFarScalar(5e5, 1.4, 1.2e7, 0.55),
          id: `flight-${f.icao24}`,
        });
        icaoToIdxRef.current.set(f.icao24, bbs.length - 1);
      }

      // Keep the 3-D model entity position in sync every data update
      // so trackedEntity chase-cam follows the real-time flight position
      if (isSelected && modelEntityRef.current) {
        const w2 = window as CesiumWindow;
        const Cesium2 = w2.Cesium!;
        modelEntityRef.current.position = new Cesium2.ConstantPositionProperty(
          pos, Cesium2.ReferenceFrame.FIXED
        );
        modelEntityRef.current.orientation = new Cesium2.ConstantProperty(
          makeOrientation(Cesium2, pos, f.heading_deg ?? 0)
        );
      }

      // Trail
      const trail = trailsRef.current[f.icao24];
      if (trail && trail.length >= 2) {
        const positions = trail.map((p) =>
          Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] ?? altM)
        );
        const existing = icaoToPolyRef.current.get(f.icao24);
        if (existing) {
          existing.positions = positions;
        } else {
          const poly = polyColl.add({
            positions,
            width: 1.5,
            material: Cesium.Material.fromType("Color", {
              color: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.6),
            }),
          });
          icaoToPolyRef.current.set(f.icao24, poly);
        }
      }
    }
  });

  // ── viewer init ───────────────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    let removeTick: (() => void) | undefined;

    const w = window as CesiumWindow;
    const waitForCesium = () =>
      new Promise<typeof import("cesium")>((resolve, reject) => {
        let n = 0;
        const id = setInterval(() => {
          if (w.Cesium) { clearInterval(id); resolve(w.Cesium); }
          else if (++n > 300) { clearInterval(id); reject(new Error("Cesium timeout")); }
        }, 50);
      });

    (async () => {
      if (typeof window === "undefined" || !containerRef.current) return;
      const Cesium = await waitForCesium();
      if (destroyed || !containerRef.current) return;

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        shouldAnimate: true,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      await setupEarth(Cesium, viewer);

      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#1a3a52");
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#061018");
      if (viewer.scene.sun) viewer.scene.sun.show = true;
      if (viewer.scene.moon) viewer.scene.moon.show = true;
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-40, 25, 18_000_000),
      });

      // GPU primitive collections
      const bbs = new Cesium.BillboardCollection({ scene: viewer.scene });
      viewer.scene.primitives.add(bbs);
      billboardsRef.current = bbs;

      const polyColl = new Cesium.PolylineCollection();
      viewer.scene.primitives.add(polyColl);
      trailsCollRef.current = polyColl;

      // Hemisphere culling — hide billboards on the back side of the globe
      const _normBb = new Cesium.Cartesian3();
      const _normCam = new Cesium.Cartesian3();
      viewer.scene.postUpdate.addEventListener(() => {
        const collection = billboardsRef.current;
        if (!collection || viewer.isDestroyed()) return;
        const camPos = viewer.scene.camera.position;
        Cesium.Cartesian3.normalize(camPos, _normCam);
        const count = collection.length;
        for (let i = 0; i < count; i++) {
          const bb = collection.get(i);
          if (!bb) continue;
          // Never override the hide for the selected flight's billboard
          const bbId: string = typeof bb.id === "string" ? bb.id : "";
          const bbIcao = bbId.replace("flight-", "");
          if (bbIcao === selectedIcaoRef.current) continue;
          const bbPos = bb.position as import("cesium").Cartesian3 | undefined;
          if (!bbPos) continue;
          Cesium.Cartesian3.normalize(bbPos, _normBb);
          bb.show = Cesium.Cartesian3.dot(_normBb, _normCam) > 0;
        }
      });

      // Click handler
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((e: { position: import("cesium").Cartesian2 }) => {
        lastInputRef.current = Date.now();
        const picked = viewer.scene.pick(e.position);
        if (!picked) {
          clearModel();
          onSelectRef.current(null);
          return;
        }
        const rawId: string =
          typeof picked?.id === "string" ? picked.id
          : typeof picked?.id?.id === "string" ? picked.id.id
          : "";
        if (rawId.startsWith("flight-")) {
          const icao = rawId.replace("flight-", "");
          const f = flightsRef.current.find((x) => x.icao24 === icao);
          if (f) {
            spawnModel(Cesium, f);
            onSelectRef.current({ id: icao, data: f });
            return;
          }
        }
        // Clicked empty space — deselect
        clearModel();
        onSelectRef.current(null);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      const markInput = () => { lastInputRef.current = Date.now(); };
      viewer.screenSpaceEventHandler.setInputAction(markInput, Cesium.ScreenSpaceEventType.WHEEL);
      viewer.screenSpaceEventHandler.setInputAction(markInput, Cesium.ScreenSpaceEventType.PINCH_START);

      const tickCb = () => {
        // auto-rotate disabled
      };
      removeTick = viewer.clock.onTick.addEventListener(tickCb);

      viewerRef.current = viewer;
      readyRef.current = true;
      syncRef.current();
    })();

    return () => {
      destroyed = true;
      readyRef.current = false;
      removeTick?.();
      const v = viewerRef.current;
      if (v && !v.isDestroyed()) v.destroy();
      viewerRef.current = null;
      billboardsRef.current = null;
      trailsCollRef.current = null;
      icaoToIdxRef.current.clear();
      icaoToPolyRef.current.clear();
    };
  }, []);

  // Sync data updates
  useEffect(() => {
    if (readyRef.current) { syncRef.current(); return; }
    const id = setInterval(() => {
      if (readyRef.current) { clearInterval(id); syncRef.current(); }
    }, 100);
    return () => clearInterval(id);
  }, [flights, flightTrails]);

  // Draw/update route arc when routeArc prop changes
  useEffect(() => {
    if (!readyRef.current) return;
    const Cesium = (window as CesiumWindow).Cesium;
    if (!Cesium) return;
    const f = selectedIcaoRef.current
      ? flightsRef.current.find((x) => x.icao24 === selectedIcaoRef.current)
      : null;
    drawRouteArc(Cesium, routeArc ?? null, f?.altitude_m ?? 10_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeArc]);

  // focusTarget: null = close/deselect; non-null = re-lock chase-cam on that flight
  useEffect(() => {
    if (!focusTarget) {
      if (readyRef.current) clearModel();
      return;
    }
    if (!readyRef.current) return;
    const w = window as CesiumWindow;
    const Cesium = w.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;
    // If model already exists for this flight, just re-lock trackedEntity
    if (modelEntityRef.current && selectedIcaoRef.current === focusTarget.id) {
      viewer.trackedEntity = modelEntityRef.current;
      return;
    }
    // Otherwise spawn fresh (e.g. "Zoom to aircraft" button clicked)
    const f = flightsRef.current.find((x) => x.icao24 === focusTarget.id);
    if (f) spawnModel(Cesium, f);
  }, [focusTarget]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      style={{ touchAction: "none" }}
    />
  );
}
