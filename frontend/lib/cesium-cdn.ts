/**
 * Cesium is loaded from CDN (see layout) to avoid Next.js bundling worker chunks in /public.
 * https://cesium.com/learn/cesiumjs/ref-doc/
 */

export const CESIUM_CDN_BASE =
  process.env.NEXT_PUBLIC_CESIUM_CDN_BASE ||
  "https://cdn.jsdelivr.net/npm/cesium@1.115.0/Build/Cesium";

export function cesiumScriptUrl() {
  return `${CESIUM_CDN_BASE}/Cesium.js`;
}

export function cesiumWidgetsCssUrl() {
  return `${CESIUM_CDN_BASE}/Widgets/widgets.css`;
}

export type CesiumNamespace = typeof import("cesium");
