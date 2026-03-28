import type * as Cesium from "cesium";

declare global {
  interface Window {
    Cesium: typeof Cesium;
    CESIUM_BASE_URL?: string;
  }
}

export {};
