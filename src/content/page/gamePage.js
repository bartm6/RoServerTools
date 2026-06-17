(() => {
  const rsdWarnOnce = globalThis.RSDDebug?.warnOnce || (() => {});

  function detectPlaceId() {
    const url = window.location.href;
    const regex = /https:\/\/www\.roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/(\d+)/;
    const match = url.match(regex);
    return match && match[1] ? match[1] : null;
  }

  function getRsd() {
    return globalThis.RSD && typeof globalThis.RSD === "object"
      ? globalThis.RSD
      : null;
  }

  function installRsdScrollLock() {
    if (window.__rsdScrollLockInstalled) return;
    window.__rsdScrollLockInstalled = true;

    function getScrollTarget(el) {
      if (!el) return null;

      const sc = el.closest(".rsd-sidepanel-body, .rsd-region-list");
      if (sc) return sc;

      const panel = el.closest(".rsd-sidepanel");
      if (panel) {
        const body = panel.querySelector(".rsd-sidepanel-body");
        return body || panel;
      }

      const dd = el.closest(
        ".rsd-dropdown, #regionDropdown, #roservertools-region-list-container",
      );
      if (dd) {
        const list = dd.querySelector(".rsd-region-list");
        return list || dd;
      }
      return null;
    }

    document.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return;

        const target = getScrollTarget(e.target);
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();

        if (typeof e.deltaY === "number" && e.deltaY)
          target.scrollTop += e.deltaY;
        if (typeof e.deltaX === "number" && e.deltaX)
          target.scrollLeft += e.deltaX;
      },
      { capture: true, passive: false },
    );
  }


  function start() {
    installRsdScrollLock();
    const placeId = detectPlaceId();
    const RSD = getRsd();

    if (!placeId) return;

    const ctx =
      RSD && typeof RSD.createCtx === "function"
        ? RSD.createCtx({ placeId })
        : { placeId, log: console, debug: false };

    const log = ctx.log || console;

    const initFns = [
      "initTheme",
      "initApi",
      "initServerlistPanel",
      "initJoin",
    ];

    try {
      if (RSD) {
        for (const fn of initFns) {
          if (typeof RSD[fn] === "function") {
            RSD[fn](ctx);
          } else if (ctx.debug) {
            log.debug?.(`Missing module function: ${fn}`);
          }
        }
      } else if (ctx.debug) {
        log.debug?.("RSD global missing; modules did not load");
      }
    } catch (e) {
      if (ctx.debug) log.error?.("Init failed", e);
    }

    if (RSD && typeof RSD.initRegionPanel === "function") {
      RSD.initRegionPanel(ctx);
    } else if (typeof regionSelectorInitiate === "function") {
      regionSelectorInitiate();
    } else if (ctx.debug) {
      log.warn?.(
        "Region panel not available (no initRegionPanel and no legacy regionSelectorInitiate)",
      );
    }
  }

  try {
    if (window.top === window.self) {
      if (!window.__rsdInitDone) {
        window.__rsdInitDone = true;
        const waitForEl = (selector, timeoutMs) =>
          new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) { resolve(el); return; }
            const ob = new MutationObserver(() => {
              const el2 = document.querySelector(selector);
              if (!el2) return;
              ob.disconnect();
              clearTimeout(tid);
              resolve(el2);
            });
            ob.observe(document.body || document.documentElement, { childList: true, subtree: true });
            const tid = setTimeout(() => { ob.disconnect(); resolve(null); }, timeoutMs || 5000);
          });
        waitForEl(".game-main-content, #game-instances-container, .game-title-container", 5000)
          .then(() => start())
          .catch((error) => {
            rsdWarnOnce("gamePage:wait", error);
            start();
          });
      }
    }
  } catch (error) {
    rsdWarnOnce("gamePage:start", error);
    if (!window.__rsdInitDone) {
      window.__rsdInitDone = true;
      start();
    }
  }
})();
