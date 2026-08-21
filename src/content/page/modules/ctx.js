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
