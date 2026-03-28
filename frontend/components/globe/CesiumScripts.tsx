import Script from "next/script";
import { CESIUM_CDN_BASE, cesiumScriptUrl, cesiumWidgetsCssUrl } from "@/lib/cesium-cdn";

/**
 * Loads Cesium UMD from jsDelivr; BASE URL must be set before Cesium.js executes.
 */
export function CesiumScripts() {
  const jsUrl = cesiumScriptUrl();
  const base = `${CESIUM_CDN_BASE}/`;
  return (
    <>
      <link rel="stylesheet" href={cesiumWidgetsCssUrl()} />
      <Script
        id="cesium-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  window.CESIUM_BASE_URL = ${JSON.stringify(base)};
  var s = document.createElement('script');
  s.src = ${JSON.stringify(jsUrl)};
  s.async = false;
  document.head.appendChild(s);
})();`,
        }}
      />
    </>
  );
}
