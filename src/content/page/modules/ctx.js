/**
 * File: ctx.js
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

  function getDebugEnabled() {
    try {
      if (typeof globalThis.__RSD_DEBUG__ === "boolean")
        return globalThis.__RSD_DEBUG__;
      return localStorage.getItem("rsd_debug") === "1";
    } catch {
      return false;
    }
  }

  function createLogger(scope = "RSD") {
    const prefix = `[${scope}]`;
    const debugEnabled = () => getDebugEnabled();

    return {
      debug: (...args) => {
        if (debugEnabled()) console.debug(prefix, ...args);
      },
      info: (...args) => {
        if (debugEnabled()) console.info(prefix, ...args);
      },
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
    };
  }

  function createCtx({ placeId }) {
    const log = createLogger("RSD");

    return {
      placeId: placeId ?? null,
      log,
      debug: getDebugEnabled(),
      settings: {
        regionSelectorEnabled: true,
        showServerlistPanel: true,
        regionSimpleUi: false,
      },
    };
  }

  RSD.getDebugEnabled = getDebugEnabled;
  RSD.createLogger = createLogger;
  RSD.createCtx = createCtx;
})();
