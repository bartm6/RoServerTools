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
  const RSD = globalThis.RSD;

  function getDebugEnabled() {
    return typeof RSD.getDebugEnabled === "function"
      ? RSD.getDebugEnabled()
      : false;
  }

  function createLogger(scope = "RSD") {
    return typeof RSD.createLogger === "function"
      ? RSD.createLogger(scope)
      : console;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function invariant(condition, message) {
    if (!condition) throw new Error(message || "Invariant failed");
  }

  function warnOnce(key, ...args) {
    try {
      RSD.__warnedOnce = RSD.__warnedOnce || new Set();
      if (RSD.__warnedOnce.has(key)) return;
      RSD.__warnedOnce.add(key);
    } catch {}
    console.warn("[RSD]", ...args);
  }

  async function mapLimit(items, limit, iterator, { onError } = {}) {
    invariant(Array.isArray(items), "mapLimit: items must be an array");
    const safeLimit = Math.max(1, Number(limit) || 1);

    const results = new Array(items.length);
    let i = 0;
    const workers = new Array(Math.min(safeLimit, items.length))
      .fill(0)
      .map(async () => {
        while (true) {
          const idx = i++;
          if (idx >= items.length) break;
          try {
            results[idx] = await iterator(items[idx], idx);
          } catch (e) {
            results[idx] = null;
            try {
              if (typeof onError === "function") onError(e, items[idx], idx);
            } catch {}
            if (getDebugEnabled()) console.debug("[RSD] mapLimit error", e);
          }
        }
      });
    await Promise.all(workers);
    return results;
  }

  function safeJsonParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "style" && v && typeof v === "object")
        Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function")
        el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, String(v));
    }
    for (const child of children || []) {
      if (child == null) continue;
      el.append(
        child.nodeType ? child : document.createTextNode(String(child)),
      );
    }
    return el;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function ensureOptionalPermissions({ permissions = [], origins = [] } = {}) {
    try {
      if (!chrome?.permissions?.contains || !chrome?.permissions?.request) return false;
      const permObj = {};
      if (Array.isArray(permissions) && permissions.length) permObj.permissions = permissions;
      if (Array.isArray(origins) && origins.length) permObj.origins = origins;

      const already = await new Promise((resolve) => {
        try {
          chrome.permissions.contains(permObj, (ok) => resolve(!!ok));
        } catch {
          resolve(false);
        }
      });
      if (already) return true;

      const granted = await new Promise((resolve) => {
        try {
          chrome.permissions.request(permObj, (ok) => resolve(!!ok));
        } catch {
          resolve(false);
        }
      });
      return !!granted;
    } catch {
      return false;
    }
  }

  RSD.utils = {
    delay,
    mapLimit,
    invariant,
    warnOnce,
    safeJsonParse,
    escapeHtml,
    qs,
    qsa,
    createEl,
    haversineKm,
    ensureOptionalPermissions,
    getDebugEnabled,
    createLogger,
  };
})();
