/**
 * Small aircraft glTF aligned with Cesium sample (heading = nose direction after orientation fix).
 * Hosted on jsDelivr from Cesium release tree (same major version as CDN Cesium.js).
 */
export const AIRCRAFT_MODEL_URI =
  process.env.NEXT_PUBLIC_AIRCRAFT_MODEL_URI ||
  "https://raw.githubusercontent.com/CesiumGS/cesium/1.115/Apps/SampleData/models/CesiumAir/Cesium_Air.glb";

/** Model units → ~meters scale so the plane reads as a small jet at cruise altitude. */
export const AIRCRAFT_MODEL_SCALE = 28;
