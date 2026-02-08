/**
 * File: utils.js
 * 
 * Part of the RoServerTools project.
 * 
 * This file implements part of the client-side logic used by the RoServerTools
 * Chrome extension. It contains concrete implementation code that supports
 * Roblox server tooling features exposed through the extension UI.
 * 
 * The responsibilities of this file are limited to its own scope and are
 * intended to be readable, maintainable, and suitable for long-term maintenance.
 * Detailed feature behavior and usage expectations are documented in the README.
 */

(() => {
  globalThis.RSD = globalThis.RSD || {};
  RSD.region_panel = RSD.region_panel || {};
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
  }

  function getFullLocationName(code, regions) {
    try {
      if (!code) return "";
      const list = Array.isArray(regions) ? regions : [];
      const item = list.find((r) => r && (r.regionCode === code || r.code === code));
      if (!item) return String(code);
      const parts = [];
      if (item.country) parts.push(item.country);
      if (item.location) parts.push(item.location);
      return parts.filter(Boolean).join(" - ") || item.name || String(code);
    } catch {
      return String(code || "");
    }
  }

  function getRegionContinentInfo(regionCode, regions) {
    try {
      const list = Array.isArray(regions) ? regions : [];
      const item = list.find((r) => r && (r.regionCode === regionCode || r.code === regionCode));
      if (!item) return { continent: null, region: null };
      const continent = item.continent || item.continentCode || null;
      return { continent, region: item };
    } catch {
      return { continent: null, region: null };
    }
  }

  function calculateAverageDistanceForContinent(continentCode, originRegion, regions) {
    try {
      if (!continentCode || !originRegion) return null;
      const list = Array.isArray(regions) ? regions : [];
      const same = list.filter((r) => (r.continent || r.continentCode) === continentCode);
      if (!same.length) return null;

      const originLat = Number(originRegion.lat ?? originRegion.latitude);
      const originLon = Number(originRegion.lon ?? originRegion.lng ?? originRegion.longitude);
      if (!Number.isFinite(originLat) || !Number.isFinite(originLon)) return null;

      let sum = 0;
      let n = 0;
      for (const r of same) {
        const lat = Number(r.lat ?? r.latitude);
        const lon = Number(r.lon ?? r.lng ?? r.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        sum += calculateDistance(originLat, originLon, lat, lon);
        n++;
      }
      return n ? sum / n : null;
    } catch {
      return null;
    }
  }

  RSD.region_panel.utils = {
    calculateDistance,
    isElementVisible,
    getFullLocationName,
    getRegionContinentInfo,
    calculateAverageDistanceForContinent,
  };
})();
