/**
 * File: serverlist_panel.js
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
  RSD.serverlist_panel = RSD.serverlist_panel || {};

  RSD.serverlist_panel.createServerlistPanel = function createServerlistPanel({
    state,
    fns,
    theme,
  }) {
    const delay = fns?.delay || ((ms) => new Promise((r) => setTimeout(r, ms)));

    const placeId = state?.placeId;
    const defaultRegions =
      state?.defaultRegions || globalThis.defaultRegions || [];
    function getServerInfo(...args) {
      if (fns?.getServerInfo) return fns.getServerInfo(...args);
      if (state?.getServerInfo) return state.getServerInfo(...args);
      return undefined;
    }

    function getCurrentTheme() {
      try {
        return theme?.getCurrentTheme?.() ?? state?.currentTheme ?? "light";
      } catch {
        return "light";
      }
    }

    const getAllRobloxServers = () =>
      Array.isArray(state?.allRobloxServers)
        ? state.allRobloxServers
        : Array.isArray(globalThis.allRobloxServers)
          ? globalThis.allRobloxServers
          : [];
    const getRegionSpecificServers = () =>
      state?.regionSpecificServers || globalThis.regionSpecificServers || {};
    const getRobloxServerPlaces = () =>
      state?.robloxServerPlaces || globalThis.robloxServerPlaces || {};

    const getRegionServerCounting = () =>
      state?.regionServerCounting || globalThis.regionServerCounting || {};

    const getServerListState = () =>
      state?.serverListState || globalThis.serverListState || null;
    const getThumbnailCache = () =>
      state?.thumbnailCache || globalThis.thumbnailCache || null;
    const fetchThumbnailAssets = (...args) =>
      typeof fns?.fetchThumbnailAssets === "function"
        ? fns.fetchThumbnailAssets(...args)
        : typeof globalThis.fetchThumbnailAssets === "function"
          ? globalThis.fetchThumbnailAssets(...args)
          : {};
    const createServerFetch = (...args) =>
      typeof fns?.createServerFetch === "function"
        ? fns.createServerFetch(...args)
        : typeof globalThis.createServerFetch === "function"
          ? globalThis.createServerFetch(...args)
          : document.createElement("div");
    const joinSpecificServer = (sid) => {
      try {
        if (typeof fns?.joinSpecificServer === "function")
          return fns.joinSpecificServer(sid);
        if (typeof globalThis.joinSpecificServer === "function")
          return globalThis.joinSpecificServer(sid);
      } catch {}
    };
    const getFullLocationName = (code) => {
      try {
        if (typeof fns?.getFullLocationName === "function")
          return fns.getFullLocationName(code);
        if (typeof globalThis.getFullLocationName === "function")
          return globalThis.getFullLocationName(code);
      } catch {}
      return code;
    };
    const serversInText = () => {
      try {
        return (
          fns?.i18n?.serversIn_Translated ??
          globalThis.serversIn_Translated ??
          "Servers in"
        );
      } catch {
        return "Servers in";
      }
    };

    let rsdSidePanelCloseTimer = null;
    let rsdSuppressSidePanelCloseUntil = 0;
    let rsdDeferredRefreshTimer = null;

    function rsdIsPanelInteracting(panelEl) {
      try {
        if (!panelEl) return false;
        if (!panelEl.matches(":hover")) return false;
        return !!panelEl.querySelector(
          ":hover button, :hover a, :hover [role='button'], :hover input, :hover select, :hover textarea, :hover .server-entry",
        );
      } catch {
        return false;
      }
    }

    function rsdGetSidePanelAnimMs() {
      try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(
          "--rsd-panel-anim-ms",
        );
        const ms = Number(
          String(raw || "")
            .trim()
            .replace(/ms$/i, ""),
        );
        return Number.isFinite(ms) && ms >= 0 ? ms : 220;
      } catch {
        return 220;
      }
    }
    function rsdAnimateSidePanelIn(el) {
      try {
        if (!el) return;
        el.classList.remove("rsd-closing");

        requestAnimationFrame(() => {
          try {
            el.classList.add("rsd-open");
          } catch {}
        });
      } catch {}
    }
    function rsdAnimateSidePanelOut(el) {
      return new Promise((resolve) => {
        try {
          if (!el) return resolve();
          try {
            el.classList.add("rsd-closing");
            el.classList.remove("rsd-open");
          } catch {}
          const ms = rsdGetSidePanelAnimMs();
          setTimeout(
            () => {
              try {
                el.remove();
              } catch {}
              resolve();
            },
            Math.max(0, ms),
          );
        } catch {
          resolve();
        }
      });
    }
    function rsdCancelCloseSidePanel() {
      if (rsdSidePanelCloseTimer) {
        clearTimeout(rsdSidePanelCloseTimer);
        rsdSidePanelCloseTimer = null;
      }
    }
    function rsdScheduleCloseSidePanel() {
      rsdCancelCloseSidePanel();

      rsdSidePanelCloseTimer = setTimeout(() => {
        const region_panel = document.getElementById("rsd-region-sidepanel");
        const friendsPanel = document.getElementById("rsd-friends-sidepanel");
        if (!region_panel && !friendsPanel) return;

        try {
          const dropdown = document.getElementById("regionDropdown");
          const hoverBridge = document.getElementById("rsd-hover-bridge");
          const spBridge = document.getElementById("rsd-sidepanel-bridge");
          const playBtn = document.querySelector(".rsd-play-btn");
          const hovering = (el) => {
            try {
              return !!(el && el.matches && el.matches(":hover"));
            } catch {
              return false;
            }
          };
          if (
            hovering(region_panel) ||
            hovering(friendsPanel) ||
            hovering(dropdown) ||
            hovering(hoverBridge) ||
            hovering(spBridge) ||
            hovering(playBtn)
          )
            return;
        } catch {}

        rsdAnimateSidePanelOut(region_panel);
        rsdAnimateSidePanelOut(friendsPanel);
        try {
          const b2 = document.getElementById("rsd-sidepanel-bridge");
          if (b2) {
            b2.style.pointerEvents = "none";
            try {
              b2.remove();
            } catch {}
          }
        } catch {}
      }, 80);
    }

    async function rsdOpenRegionSidePanel(regionCode, refreshOnly = false) {
      rsdCancelCloseSidePanel();
      const dropdown = document.getElementById("regionDropdown");
      if (!dropdown) return;
      const isDarkMode = getCurrentTheme() === "dark";
      try {
        const recentPanel = document.getElementById("rsd-recent-sidepanel");
        if (recentPanel) {try {
            recentPanel.remove();
          } catch {}
          try {
            const btn = document.getElementById("rsd-recent-btn");
            if (btn) btn.classList.remove("rsd-panel-open");
          } catch {}
          try {
            const b2 = document.getElementById("rsd-sidepanel-bridge");
            if (b2) b2.remove();
          } catch {}
        }
      } catch {}

      try {
        const friendsPanel = document.getElementById("rsd-friends-sidepanel");
        if (friendsPanel) {
          try {
            friendsPanel.remove();
          } catch {}
          try {
            const b2 = document.getElementById("rsd-sidepanel-bridge");
            if (b2) b2.remove();
          } catch {}
        }
      } catch {}
      let panel = document.getElementById("rsd-region-sidepanel");

      try {
        if (
          !refreshOnly &&
          panel &&
          panel.classList &&
          panel.classList.contains("rsd-open") &&
          panel.dataset &&
          panel.dataset.rsdRegion === regionCode
        ) {
          return;
        }
      } catch {}

      if (
        !refreshOnly &&
        panel &&
        panel.classList &&
        panel.classList.contains("rsd-open") &&
        panel.dataset &&
        panel.dataset.rsdRegion === regionCode
      ) {
        return;
      }
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "rsd-region-sidepanel";
        panel.className = `rsd-sidepanel ${isDarkMode ? "rsd-dark" : "rsd-light"}`;
        panel.innerHTML = `
								<div class="rsd-sidepanel-header">
									<div class="rsd-sidepanel-title"></div>
								</div>
								<div class="rsd-sidepanel-body">
									<div class="rsd-sidepanel-list"></div>
								</div>`;

        panel.style.position = "absolute";
        panel.style.top = "0px";

        const rsdGapPx =
          typeof window !== "undefined" &&
          Number.isFinite(Number(window.__rsdUiGapPx))
            ? Number(window.__rsdUiGapPx)
            : 8;
        panel.style.right = `calc(100% + ${rsdGapPx}px)`;
        dropdown.appendChild(panel);

        rsdAnimateSidePanelIn(panel);

        const spBridgeId = "rsd-sidepanel-bridge";
        let spBridge = document.getElementById(spBridgeId);
        if (!spBridge) {
          spBridge = document.createElement("div");
          spBridge.id = spBridgeId;
          spBridge.style.position = "absolute";
          spBridge.style.background = "transparent";
          spBridge.style.pointerEvents = "none";

          spBridge.style.zIndex = "9999";

          spBridge.style.top = "0px";

          const OVERLAP = 6;
          spBridge.style.right = `calc(100% - ${OVERLAP}px)`;
          spBridge.style.width = Math.max(12, rsdGapPx + OVERLAP * 2) + "px";
          spBridge.style.height = "100%";
          dropdown.appendChild(spBridge);
          spBridge.addEventListener("mouseenter", rsdCancelCloseSidePanel);
          spBridge.addEventListener("mouseleave", rsdScheduleCloseSidePanel);
        } else {
          try {
            if (spBridge.parentElement !== dropdown)
              dropdown.appendChild(spBridge);
          } catch {}
        }
        spBridge.style.pointerEvents = "auto";

        panel.addEventListener("mouseenter", rsdCancelCloseSidePanel);
        panel.addEventListener("mouseleave", rsdScheduleCloseSidePanel);
      }

      panel.classList.toggle("rsd-dark", isDarkMode);
      panel.classList.toggle("rsd-light", !isDarkMode);

      if (!refreshOnly) {
        try {
          const currentRegion = panel.dataset ? panel.dataset.rsdRegion : null;
          if (
            panel.classList &&
            panel.classList.contains("rsd-open") &&
            currentRegion === regionCode
          ) {
            return;
          }
        } catch {}
      }
      panel.dataset.rsdRegion = regionCode;
      try {
        panel.classList.add("rsd-open");
      } catch {}
      const titleEl = panel.querySelector(".rsd-sidepanel-title");
      const listEl = panel.querySelector(".rsd-sidepanel-list");
      if (titleEl)
        titleEl.textContent = `${serversInText()} ${getFullLocationName(regionCode)}`;
      if (!refreshOnly && listEl)
        listEl.innerHTML = `<div class="rsd-sidepanel-spinner" aria-label="Loading"></div>`;

      const rss = getRegionSpecificServers();
      const ars = getAllRobloxServers();
      if (
        (!rss[regionCode] || rss[regionCode].length === 0) &&
        Array.isArray(ars) &&
        ars.length === 0
      ) {
        try {
          await getServerInfo(placeId, defaultRegions, true);
        } catch {}
      }
      const rsp = getRobloxServerPlaces();
      let serversInRegion =
        rss[regionCode] ||
        (Array.isArray(ars)
          ? ars.filter((s) => rsp[s.id]?.c === regionCode)
          : []);
      if (!serversInRegion || serversInRegion.length === 0) {
        try {
          await getServerInfo(placeId, null, true, null, regionCode);
        } catch {}
        serversInRegion =
          rss[regionCode] ||
          (Array.isArray(ars)
            ? ars.filter((s) => rsp[s.id]?.c === regionCode)
            : []);
      }
      if (!listEl) return;
      if (!serversInRegion || serversInRegion.length === 0) {
        listEl.innerHTML = `<div class="rsd-sidepanel-empty">No servers found in this region.</div>`;
        return;
      }
      if (refreshOnly && rsdIsPanelInteracting(panel)) {
        try {
          let visibleCountForCheck = Number(panel.dataset.rsdVisibleCount || "10");
          if (!Number.isFinite(visibleCountForCheck) || visibleCountForCheck <= 0)
            visibleCountForCheck = 10;

          const alreadyRendered = listEl.querySelectorAll(".server-entry").length;
          const shouldBeRendered = Math.min(
            visibleCountForCheck,
            serversInRegion.length,
          );

          if (alreadyRendered >= shouldBeRendered) {
            if (rsdDeferredRefreshTimer) clearTimeout(rsdDeferredRefreshTimer);
            rsdDeferredRefreshTimer = setTimeout(() => {
              try {
                const openPanel = document.getElementById("rsd-region-sidepanel");
                if (
                  openPanel &&
                  openPanel.classList?.contains("rsd-open") &&
                  openPanel.dataset?.rsdRegion === regionCode
                ) {
                  rsdOpenRegionSidePanel(regionCode, true);
                }
              } catch {}
            }, 140);
            return;
          }
        } catch {
        }
      }

      const serverListState = getServerListState();
      const sortMode = serverListState?.currentSort || "ping_lowest";
      const sorted = [...serversInRegion];
      if (sortMode === "players_highest")
        sorted.sort((a, b) => (b.playing || 0) - (a.playing || 0));
      else if (sortMode === "players_lowest")
        sorted.sort((a, b) => (a.playing || 0) - (b.playing || 0));
      else {
        const rsp2 = getRobloxServerPlaces();
        sorted.sort(
          (a, b) =>
            (Number(rsp2?.[a.id]?.p) || 999999) -
            (Number(rsp2?.[b.id]?.p) || 999999),
        );
      }

      const tokens = sorted.flatMap((s) => s.playerTokens || []);
      const uniqueTokens = [...new Set(tokens)].filter(Boolean);
      const thumbnailCache = getThumbnailCache();
      const uncached = uniqueTokens.filter(
        (t) =>
          !(
            thumbnailCache &&
            typeof thumbnailCache.has === "function" &&
            thumbnailCache.has(t)
          ),
      );
      // IMPORTANT: don't block the whole panel render on thumbnail fetching.
      // When servers are being discovered, this function can run many times;
      // awaiting large thumbnail batches made the list appear to "stall" and
      // then pop in all at once. Instead, render immediately using cached
      // thumbnails/placeholders and patch images in-place when fetches finish.
      let fetched = {};
      if (uncached.length) {
        try {
          fetchThumbnailAssets(uncached)
            .then((res) => {
              fetched = res || {};
              try {
                if (thumbnailCache && typeof thumbnailCache.set === "function") {
                  for (const [t, u] of Object.entries(fetched)) {
                    if (u) thumbnailCache.set(t, u);
                  }
                }
              } catch {}

              // If the same region panel is still open, update any matching
              // img[data-rsd-token] elements with the freshly fetched URLs.
              try {
                const openPanel = document.getElementById("rsd-region-sidepanel");
                if (
                  openPanel &&
                  openPanel.classList?.contains("rsd-open") &&
                  openPanel.dataset?.rsdRegion === regionCode
                ) {
                  const root = openPanel.querySelector(".rsd-sidepanel-list");
                  if (root) {
                    for (const [t, u] of Object.entries(fetched)) {
                      if (!u) continue;
                      const selTok = CSS?.escape ? CSS.escape(String(t)) : String(t);
                      root
                        .querySelectorAll(`img.profile-thumbnail[data-rsd-token="${selTok}"]`)
                        .forEach((img) => {
                          try {
                            img.src = u;
                          } catch {}
                        });
                    }
                  }
                }
              } catch {}
            })
            .catch(() => {});
        } catch {}
      }
      let thumbMapBase = {};
      try {
        if (
          thumbnailCache &&
          typeof thumbnailCache[Symbol.iterator] === "function"
        )
          thumbMapBase = Object.fromEntries(thumbnailCache);
      } catch {
        thumbMapBase = {};
      }
      const thumbMap = { ...thumbMapBase, ...fetched };

      listEl.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "rsd-sidepanel-cards";

      let visibleCount = Number(panel.dataset.rsdVisibleCount || "10");
      if (!Number.isFinite(visibleCount) || visibleCount <= 0)
        visibleCount = 10;

      if (
        !panel.dataset.rsdLastRegion ||
        panel.dataset.rsdLastRegion !== regionCode
      ) {
        visibleCount = 10;
      }
      panel.dataset.rsdLastRegion = regionCode;
      panel.dataset.rsdVisibleCount = String(visibleCount);
      for (const server of sorted.slice(0, visibleCount)) {
        const entry = createServerFetch(server, thumbMap, isDarkMode, {
          compact: true,
        });

        const joinBtn = entry.querySelector("button.join-button");
        if (joinBtn) {
          const sid = String(server.id);
          joinBtn.onclick = () => {
            joinSpecificServer(sid);
            try {
              if (typeof window.__rsdCloseRegionDropdown === "function")
                window.__rsdCloseRegionDropdown();
            } catch {}
          };
        }
        wrap.appendChild(entry);
      }

      const knownCount = Number(getRegionServerCounting()?.[regionCode] || 0) || 0;

      if (sorted.length > visibleCount || knownCount > visibleCount) {
        const more = document.createElement("button");
        more.className = "rsd-sidepanel-more";
        more.type = "button";
        more.textContent = "Show more";
        more.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const nextVisible = visibleCount + 10;
          panel.dataset.rsdVisibleCount = String(nextVisible);
          try {
            const currentLoaded = sorted.length;
            const wantMoreData = knownCount > currentLoaded && nextVisible > currentLoaded;
            if (wantMoreData) {
              await getServerInfo(placeId, null, true, null, regionCode);
            }
          } catch {}

          await rsdOpenRegionSidePanel(regionCode, true);
        };
        wrap.appendChild(more);
      }
      listEl.appendChild(wrap);
    }

    // Called by the discovery pipeline for every newly-found server.
    // If the region sidepanel is currently open for the server's region, we
    // append the card immediately (with placeholders if needed) instead of
    // waiting for the next full rerender.
    function rsdNotifyServerFound(regionCode, server) {
      try {
        if (!regionCode || !server || !server.id) return;
        const panel = document.getElementById("rsd-region-sidepanel");
        if (!panel || !panel.classList?.contains("rsd-open")) return;
        if (panel.dataset?.rsdRegion !== String(regionCode)) return;

        const listEl = panel.querySelector(".rsd-sidepanel-list");
        if (!listEl) return;

        const isDarkMode = getCurrentTheme() === "dark";

        // Ensure the "Show more" button appears as soon as the known server count
        // exceeds the visible limit (even if we opened the panel before reaching 10).
        const ensureMoreButton = () => {
          try {
            const visibleCountRaw = Number(panel.dataset.rsdVisibleCount || "10");
            const visibleCount = Number.isFinite(visibleCountRaw) && visibleCountRaw > 0 ? visibleCountRaw : 10;
            const knownCount = Number(getRegionServerCounting()?.[regionCode] || 0) || 0;

            // The wrapper may not exist yet (spinner state) – in that case, defer.
            const wrapNow = listEl.querySelector(".rsd-sidepanel-cards");
            if (!wrapNow) return;

            const currentLoaded = wrapNow.querySelectorAll(".server-entry").length;
            const shouldShow = (currentLoaded > visibleCount) || (knownCount > visibleCount);

            let moreBtn = wrapNow.querySelector("button.rsd-sidepanel-more");
            if (shouldShow && !moreBtn) {
              moreBtn = document.createElement("button");
              moreBtn.className = "rsd-sidepanel-more";
              moreBtn.type = "button";
              moreBtn.textContent = "Show more";
              moreBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const nextVisible = visibleCount + 10;
                panel.dataset.rsdVisibleCount = String(nextVisible);
                try {
                  const wantMoreData = knownCount > currentLoaded && nextVisible > currentLoaded;
                  if (wantMoreData) {
                    await getServerInfo(placeId, null, true, null, regionCode);
                  }
                } catch {}

                await rsdOpenRegionSidePanel(regionCode, true);
              };
              wrapNow.appendChild(moreBtn);
            } else if (!shouldShow && moreBtn) {
              moreBtn.remove();
            }
          } catch {}
        };

        // If we're still showing the loading spinner / empty state, swap it
        // for a cards wrapper.
        let wrap = listEl.querySelector(".rsd-sidepanel-cards");
        if (!wrap) {
          listEl.innerHTML = "";
          wrap = document.createElement("div");
          wrap.className = "rsd-sidepanel-cards";
          listEl.appendChild(wrap);
        }

        const sid = String(server.id);
        if (wrap.querySelector(`.server-entry[data-server-id="${CSS?.escape ? CSS.escape(sid) : sid}"]`)) {
          ensureMoreButton();
          return;
        }

        // Respect the visible count limit (same behavior as the full render).
        let visibleCount = Number(panel.dataset.rsdVisibleCount || "10");
        if (!Number.isFinite(visibleCount) || visibleCount <= 0) visibleCount = 10;
        const existingEntries = wrap.querySelectorAll(".server-entry").length;

        // If we've reached the visible limit, don't append the card, but do ensure
        // the "Show more" button appears if there are more servers known.
        if (existingEntries >= visibleCount) {
          ensureMoreButton();
          return;
        }

        const thumbnailCache = getThumbnailCache();
        let thumbMap = {};
        try {
          if (thumbnailCache && typeof thumbnailCache[Symbol.iterator] === "function") {
            thumbMap = Object.fromEntries(thumbnailCache);
          }
        } catch {
          thumbMap = {};
        }

        const entry = createServerFetch(server, thumbMap, isDarkMode, { compact: true });
        const joinBtn = entry.querySelector("button.join-button");
        if (joinBtn) {
          joinBtn.onclick = () => {
            try {
              joinSpecificServer(String(server.id));
            } finally {
              try {
                if (typeof window.__rsdCloseRegionDropdown === "function")
                  window.__rsdCloseRegionDropdown();
              } catch {}
            }
          };
        }

        wrap.appendChild(entry);

        // After adding a card, re-evaluate whether the "Show more" button should exist.
        ensureMoreButton();

        // Fetch missing thumbnails for this card in the background and patch the
        // <img> elements in-place when they arrive.
        try {
          const tokens = Array.isArray(server?.playerTokens) ? server.playerTokens.filter(Boolean) : [];
          const uncached = tokens.filter(
            (t) => !(thumbnailCache && typeof thumbnailCache.has === "function" && thumbnailCache.has(t)),
          );
          if (uncached.length) {
            fetchThumbnailAssets(uncached)
              .then((fetched) => {
                try {
                  if (thumbnailCache && typeof thumbnailCache.set === "function") {
                    for (const [t, u] of Object.entries(fetched || {})) thumbnailCache.set(t, u);
                  }
                } catch {}
                try {
                  for (const [t, u] of Object.entries(fetched || {})) {
                    if (!u) continue;
                    const img = entry.querySelector(
                      `img.profile-thumbnail[data-rsd-token="${CSS?.escape ? CSS.escape(String(t)) : String(t)}"]`,
                    );
                    if (img) img.src = u;
                  }
                } catch {}
              })
              .catch(() => {});
          }
        } catch {}
      } catch {}
    }

    const api = {
      cancelCloseSidePanel:
        typeof rsdCancelCloseSidePanel === "function"
          ? rsdCancelCloseSidePanel
          : () => {},
      scheduleCloseSidePanel:
        typeof rsdScheduleCloseSidePanel === "function"
          ? rsdScheduleCloseSidePanel
          : () => {},
      animateSidePanelIn:
        typeof rsdAnimateSidePanelIn === "function"
          ? rsdAnimateSidePanelIn
          : () => {},
      animateSidePanelOut:
        typeof rsdAnimateSidePanelOut === "function"
          ? rsdAnimateSidePanelOut
          : () => Promise.resolve(),
      openRegionSidePanel:
        typeof rsdOpenRegionSidePanel === "function"
          ? rsdOpenRegionSidePanel
          : () => {},
      notifyServerFound:
        typeof rsdNotifyServerFound === "function"
          ? rsdNotifyServerFound
          : () => {},
    };

    return api;
  };

  RSD.serverlist_panel.initServerlistPanel = function initServerlistPanel(ctx) {
    return ctx?.overlay || null;
  };
  RSD.createServerlistPanel = RSD.serverlist_panel.createServerlistPanel;
  RSD.initServerlistPanel = RSD.serverlist_panel.initServerlistPanel;
})();
