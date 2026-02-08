/**
 * File: ui.js
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
  async function initRegionPanel(ctx) {
  let rsdHoveredRegionCode = null;
  let rsdHoveredRegionEl = null;

const rsdNormalizeRegionCode =
  typeof globalThis.normalizeRegionCode === "function"
    ? globalThis.normalizeRegionCode
    : (x) => x;

  function rsdSetHoverBg(el, on, isDarkMode) {
    if (!el) return;
    if (on) {
      el.style.setProperty(
        "background-color",
        isDarkMode ? "rgba(255, 255, 255, 0.10)" : "rgba(0, 0, 0, 0.06)",
        "important",
      );
    } else {
      el.style.removeProperty("background-color");
      el.style.setProperty("background-color", "transparent", "important");
    }
  }
  const __u =
    globalThis.RSD && globalThis.RSD.utils ? globalThis.RSD.utils : {};
  const delay = __u.delay || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const mapLimit =
    __u.mapLimit || (async (items, limit, it) => Promise.all(items.map(it)));
  const escapeHtml = __u.escapeHtml || ((s) => String(s));

  function rsdStartSpinner(btn) {
    if (!btn) return;
    btn.classList.add("rsd-spinning");
  }
  function rsdStopSpinner(btn) {
    if (!btn) return;
    btn.classList.remove("rsd-spinning");
  }
  function rsdDisableTooltips(root) {
    try {
      if (!root) return;

      const strip = (node) => {
        try {
          if (!node) return;
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute("title")) {
              node.removeAttribute("title");
            }
            if (node.querySelectorAll) {
              node
                .querySelectorAll("[title]")
                .forEach((el) => el.removeAttribute("title"));
            }
          }
        } catch {}
      };

      strip(root);

      if (root.__rsdNoTooltipObserver) return;
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "title") {
            strip(m.target);
          }
          if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach(strip);
          }
        }
      });

      obs.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["title"],
      });
      root.__rsdNoTooltipObserver = obs;
    } catch {}
  }

  const settings = {
    regionSelectorEnabled: true,
    showServerlistPanel: true,
    regionSimpleUi: false,
  };
  const UNKNOWN_REGION = "??";
  const MAX_CONCURRENT_JOININFO = 12;
  (function (settings) {
      if (settings.regionSelectorEnabled && !settings.regionSimpleUi) {
      if (window.location.pathname.includes("/games/")) {
        const url = window.location.href;
        let placeId = (ctx && ctx.placeId) ? String(ctx.placeId) : null;
        const regex = /https:\/\/www\.roblox\.com\/(?:[a-z]{2}\/)?games\/(\d+)/;
        const match = url.match(regex);
        if (!placeId && match && match[1]) {
          placeId = match[1];
        }

        let regionReplacedMap = {};
        let regionServerCounting = {};
        let allRobloxServers = [];
        let robloxServerPlaces = {};
        let robloxProfileUserLocation = null;
        let checkForRefreshingCount = false;
        let rateLimited = false;
        let nextPageCursor = null;
        let regionSpecificServers = {};
        let isFetchingServersForRegion = {};
        let regionSelectorShowServerlistPanel = true;
        let regionSelectorEnabled = true;
        let regionButtonAdded = false;
        let serverListState = {
          visibleServerCount: 0,
          fetchedServerIds: new Set(),
          renderedServerIds: new Set(),
          servers: [],
          renderedServersData: new Map(),
          loading: false,
          currentSort: "ping_lowest",
        };
        let serverIpMap = null;
        let activeRequests = 0;
        let currentTheme = null;
        let thumbnailCache = new Map();
        let serverEntryCache = new Map();
        const BATCH_SIZE = 8;
        const THUMBNAIL_BATCH_SIZE = 50;

        let uiUpdateScheduled = false;
        function scheduleUiUpdate() {
          if (uiUpdateScheduled) return;
          uiUpdateScheduled = true;
          setTimeout(async () => {
            uiUpdateScheduled = false;
            try {
              await updateDetailsServers();
            } catch (e) {}
          }, 150);
        }

        const __state = {
          get placeId() {
            return placeId;
          },

          get rateLimited() {
            return rateLimited;
          },
          set rateLimited(v) {
            rateLimited = v;
          },
          get checkForRefreshingCount() {
            return checkForRefreshingCount;
          },
          set checkForRefreshingCount(v) {
            checkForRefreshingCount = v;
          },
          get allRobloxServers() {
            return allRobloxServers;
          },
          set allRobloxServers(v) {
            allRobloxServers = v;
          },
          get regionServerCounting() {
            return regionServerCounting;
          },
          set regionServerCounting(v) {
            regionServerCounting = v;
          },
          get robloxServerPlaces() {
            return robloxServerPlaces;
          },
          set robloxServerPlaces(v) {
            robloxServerPlaces = v;
          },
          get regionSpecificServers() {
            return regionSpecificServers;
          },
          set regionSpecificServers(v) {
            regionSpecificServers = v;
          },
          get nextPageCursor() {
            return nextPageCursor;
          },
          set nextPageCursor(v) {
            nextPageCursor = v;
          },
          get activeRequests() {
            return activeRequests;
          },
          set activeRequests(v) {
            activeRequests = v;
          },
          get regionReplacedMap() {
            return regionReplacedMap;
          },
          set regionReplacedMap(v) {
            regionReplacedMap = v;
          },
          get serverIpMap() {
            return serverIpMap;
          },
          set serverIpMap(v) {
            serverIpMap = v;
          },
          get robloxProfileUserLocation() {
            return robloxProfileUserLocation;
          },
          set robloxProfileUserLocation(v) {
            robloxProfileUserLocation = v;
          },
        };

        try {
          Object.defineProperty(__state, "defaultRegions", {
            get: () => defaultRegions,
          });
          Object.defineProperty(__state, "currentTheme", {
            get: () => currentTheme,
          });
          Object.defineProperty(__state, "serverListState", {
            get: () => serverListState,
          });
          Object.defineProperty(__state, "thumbnailCache", {
            get: () => thumbnailCache,
          });
        } catch {}
        const __theme =
          globalThis.RSD && typeof globalThis.RSD.createTheme === "function"
            ? globalThis.RSD.createTheme({
                getCurrentTheme: () => currentTheme,
                setCurrentTheme: (t) => {
                  currentTheme = t;
                },
              })
            : null;
        // NOTE: __api (server discovery) can fire UI updates while server cards are
        // still streaming in. We keep a handle to the serverlist overlay so the API
        // layer can append cards immediately when a server is found.
        let __overlay = null;

        const __api =
          globalThis.RSD && typeof globalThis.RSD.createApi === "function"
            ? globalThis.RSD.createApi({
                state: __state,
                constants: { MAX_CONCURRENT_JOININFO },
                flags: {
                  getRegionSelectorEnabled: () => regionSelectorEnabled,
                },
                fns: {
                  delay,
                  mapLimit,
                  handleRateLimitedState,
                  updateDetailsServers: (...args) =>
                    updateDetailsServers(...args),
                  scheduleUiUpdate,
                  // Fast-path: append a card to the open region list immediately.
                  notifyRegionServerFound: (regionCode, server) => {
                    try {
                      return __overlay?.notifyServerFound?.(regionCode, server);
                    } catch {
                      return undefined;
                    }
                  },
                  updateRegionSpecificCache: (...args) =>
                    updateRegionSpecificCache(...args),
                  rsdCheckFriendsInServers: (...args) =>
                    typeof rsdCheckFriendsInServers === "function"
                      ? rsdCheckFriendsInServers(...args)
                      : undefined,
                },
              })
            : null;
        const __join =
          globalThis.RSD && typeof globalThis.RSD.createJoin === "function"
            ? globalThis.RSD.createJoin({
                state: __state,
                constants: { UNKNOWN_REGION },
                fns: {
                  delay,
                  getServerInfo: (...args) => getServerInfo(...args),
                  openSidePanelIfEnabled: (region) => {
                    try {
                      if (
                        regionSelectorShowServerlistPanel &&
                        typeof rsdOpenRegionSidePanel === "function"
                      ) {
                        rsdOpenRegionSidePanel(region);
                        return true;
                      }
                    } catch {}
                    return false;
                  },
                },
              })
            : null;

        __overlay =
          globalThis.RSD &&
          typeof globalThis.RSD.createServerlistPanel === "function"
            ? globalThis.RSD.createServerlistPanel({
                state: __state,
                fns: {
                  delay,
                  getServerInfo: (...a) => getServerInfo(...a),
                  fetchThumbnailAssets: (...a) => fetchThumbnailAssets(...a),
                  createServerFetch: (...a) => createServerFetch(...a),
                  joinSpecificServer: (sid) => joinSpecificServer(sid),
                  getFullLocationName: (code) => getFullLocationName(code),
                  i18n: { serversIn_Translated },
                },
                theme: { getCurrentTheme: () => currentTheme },
              })
            : null;
        const __friends =
          globalThis.RSD &&
          typeof globalThis.RSD.createFriendsServerlistPanel === "function"
            ? globalThis.RSD.createFriendsServerlistPanel({
                state: __state,
                fns: {
                  delay,
                  escapeHtml: (s) => (escapeHtml ? escapeHtml(s) : String(s)),
                  getServerInfo: (...a) => getServerInfo(...a),
                  joinSpecificServer: (sid) => joinSpecificServer(sid),

                  createServerFetch: (...a) => createServerFetch(...a),
                },
                overlay: __overlay,
              })
            : null;
        async function detectThemeAPI() {
          if (__theme && __theme.detectThemeAPI)
            return __theme.detectThemeAPI();
          return (
            currentTheme ||
            (document.body.classList.contains("dark-theme") ? "dark" : "light")
          );
        }
        async function applyTheme() {
          if (__theme && __theme.applyTheme) return __theme.applyTheme();
          await detectThemeAPI();
        }
        function handleRateLimitedState(limited) {
          rateLimited = limited;
          const refreshButton = document.getElementById("rsd-refresh-btn");
          if (refreshButton) {
            const isDisabled = !!(limited || checkForRefreshingCount);
            refreshButton.disabled = isDisabled;

            refreshButton.style.pointerEvents = isDisabled ? "none" : "auto";
            refreshButton.style.cursor = isDisabled
              ? checkForRefreshingCount
                ? "wait"
                : "not-allowed"
              : "pointer";
            const isDarkMode = currentTheme === "dark";
            const mutedColor = isDarkMode ? "#888" : "#999";
            const readyColor = isDarkMode ? "#ccc" : "#555";
            const desiredColor = isDisabled ? mutedColor : readyColor;

            if (checkForRefreshingCount) {
              rsdStartSpinner(refreshButton);

              refreshButton.style.color = mutedColor;
            } else {
              rsdStopSpinner(refreshButton);
              refreshButton.style.color = desiredColor;
            }
          }
        }
        async function getServerInfo(
          placeId,
          regions,
          initialCall = true,
          cursor = null,
          specificRegion = null,
        ) {
          if (__api && __api.getServerInfo) {
            return __api.getServerInfo(
              placeId,
              regions,
              initialCall,
              cursor,
              specificRegion,
            );
          }
        }
        function rsdRefreshOpenSidePanel(changedRegion) {
          try {
            const panel = document.getElementById("rsd-region-sidepanel");
            const spBridge = document.getElementById("rsd-sidepanel-bridge");
            if (spBridge) spBridge.style.pointerEvents = "none";
            if (!panel || !panel.classList.contains("rsd-open")) return;
            const openRegion = panel.dataset.rsdRegion;
            if (
              changedRegion &&
              openRegion &&
              rsdNormalizeRegionCode(changedRegion) !==
                rsdNormalizeRegionCode(openRegion)
            )
              return;

            if (typeof rsdOpenRegionSidePanel === "function")
              rsdOpenRegionSidePanel(openRegion, true);
          } catch {}
        }

        function updateRegionSpecificCache(region) {
          if (!region) return;
          regionSpecificServers[region] = allRobloxServers.filter(
            (server) => robloxServerPlaces[server.id]?.c === region,
          );
          rsdRefreshOpenSidePanel(region);
        }
        (async () => {
          try {
            let serverListJsonText;
            if (typeof GM_getResourceText === "function") {
              serverListJsonText = GM_getResourceText("serverListJSON");
            } else if (chrome && chrome.runtime && chrome.runtime.getURL) {
              const url = chrome.runtime.getURL("assets/data/regionList.json");
              const response = await fetch(url);
              if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);
              serverListJsonText = await response.text();
            } else {
              throw new Error(
                "Cannot determine environment (Tampermonkey or Chrome Extension) to load resource.",
              );
            }
            if (!serverListJsonText) {
              throw new Error("Failed to load serverListJSON resource text.");
            }
            serverIpMap = JSON.parse(serverListJsonText);
          } catch (error) {
            serverIpMap = {};
          }
        })();
        async function handleServer(
          server,
          placeId,
          targetRegions,
          specificRegion = null,
        ) {
          if (__api && __api.handleServer)
            return __api.handleServer(
              server,
              placeId,
              targetRegions,
              specificRegion,
            );
          return null;
        }
        function calculateDistance(lat1, lon1, lat2, lon2) {
          if (
            lat1 === null ||
            lon1 === null ||
            lat2 === null ||
            lon2 === null ||
            typeof lat1 !== "number" ||
            typeof lon1 !== "number" ||
            typeof lat2 !== "number" ||
            typeof lon2 !== "number" ||
            isNaN(lat1) ||
            isNaN(lon1) ||
            isNaN(lat2) ||
            isNaN(lon2)
          ) {
            return NaN;
          }
          const R = 6371;
          const toRadians = (degrees) => (degrees * Math.PI) / 180;
          const lat1Rad = toRadians(lat1);
          const lon1Rad = toRadians(lon1);
          const lat2Rad = toRadians(lat2);
          const lon2Rad = toRadians(lon2);
          const latDiff = lat2Rad - lat1Rad;
          const lonDiff = lon2Rad - lon1Rad;
          const a =
            Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
            Math.cos(lat1Rad) *
              Math.cos(lat2Rad) *
              Math.sin(lonDiff / 2) *
              Math.sin(lonDiff / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          return distance;
        }
        async function joinSpecificRegion(region) {
          if (__join && __join.joinSpecificRegion)
            return __join.joinSpecificRegion(region);

          let bestServer = null;
          const regionServers = allRobloxServers.filter(
            (server) => robloxServerPlaces[server.id]?.c === region,
          );
          if (regionServers.length === 0) {
            alert(
              `No servers currently listed for region ${getFullLocationName(region)}.`,
            );
            return;
          }
          if (robloxProfileUserLocation) {
            let bestRegionScore = -Infinity;
            const regionServerScores = regionServers.map((server) => {
              const serverId = server.id;
              if (
                server.calculatedPing === undefined ||
                isNaN(server.calculatedPing) ||
                server.calculatedPing === Infinity
              ) {
                const serverLoc = robloxServerPlaces[server.id]?.l;
                if (serverLoc && typeof serverLoc.latitude === "number") {
                  const dist = calculateDistance(
                    robloxProfileUserLocation.latitude,
                    robloxProfileUserLocation.longitude,
                    serverLoc.latitude,
                    serverLoc.longitude,
                  );
                  if (!isNaN(dist)) {
                    server.calculatedPing = Math.round(dist * 0.05);
                  } else {
                    server.calculatedPing = Infinity;
                  }
                } else {
                  server.calculatedPing = Infinity;
                }
              }
              let ping = server.calculatedPing ?? Infinity;
              let fps = server.fps || 0;
              if (ping === Infinity) {
                return {
                  server,
                  score: -Infinity,
                };
              }
              const normalizedFPS = fps / 60;
              const pingFactor = Math.max(0, 1 - ping / 1000);
              const clampedFPS = Math.max(0, Math.min(1, normalizedFPS));
              const fpsWeight = 0.4;
              const pingWeight = 0.6;
              const score = pingWeight * pingFactor + fpsWeight * clampedFPS;
              return {
                server,
                score,
              };
            });
            const validRegionServers = regionServerScores.filter(
              (result) => result && result.score > -Infinity,
            );
            if (validRegionServers.length > 0) {
              validRegionServers.sort((a, b) => b.score - a.score);
              bestServer = validRegionServers[0].server;
              bestRegionScore = validRegionServers[0].score;
            } else {
              regionServers.sort((a, b) => (b.playing ?? 0) - (a.playing ?? 0));
              bestServer = regionServers.length > 0 ? regionServers[0] : null;
              if (bestServer) {
              }
            }
          } else {
            regionServers.sort((a, b) => (b.playing ?? 0) - (a.playing ?? 0));
            bestServer = regionServers.length > 0 ? regionServers[0] : null;
            if (bestServer) {
            }
          }
          if (bestServer && bestServer.id) {
            joinSpecificServer(bestServer.id);
          } else {
          }
        }

        function joinSpecificServer(serverId) {
          try { globalThis.RSD?.history_panel?.recordRecentJoin?.(String(placeId || ""), String(serverId || "")); } catch {}
          if (__join && __join.joinSpecificServer)
            return __join.joinSpecificServer(serverId);
          chrome.runtime.sendMessage(
            {
              action: "joinGameInstance",
              placeId: String(placeId || ""),
              serverId: String(serverId || ""),
            },
            () => {},
          );
}
        function getFullLocationName(region) {
          region = rsdNormalizeRegionCode(region);
          const regionData = regionCoordinates[region];
          if (!regionData) {
            if (region === "??") return "Unknown Region";
            if (region.startsWith("US-")) return `${region.split("-")[1]}, USA`;
            return region;
          }
          let parts = [];
          if (regionData.city && regionData.city !== regionData.country)
            parts.push(regionData.city);

          if (regionData.includeState && regionData.state)
            parts.push(regionData.state);
          if (regionData.country) parts.push(regionData.country);
          parts = [...new Set(parts.filter((p) => p))];
          if (parts.length > 2 && parts[parts.length - 1] === "United States")
            parts[parts.length - 1] = "USA";
          return parts.join(", ") || region;
        }

        const RSD_FRIENDS_CACHE_MS =
          __friends && __friends.CACHE_MS ? __friends.CACHE_MS : 60 * 1000;
        let rsdFriendsCache =
          __friends && __friends.cache
            ? __friends.cache
            : { ts: 0, totalFriends: 0, servers: null };
        function rsdRenderFriendsButtonIcon(totalFriendsCount) {
          try {
            return (
              __friends?.renderFriendsButtonIcon?.(totalFriendsCount) || ""
            );
          } catch {
            return "";
          }
        }
        function rsdSetFriendsButtonState(
          totalFriendsCount,
          isChecking = false,
        ) {
          try {
            return __friends?.setFriendsButtonState?.(
              totalFriendsCount,
              isChecking,
            );
          } catch {}
        }
        async function rsdCheckFriendsInServers(force = false) {
          try {
            return await __friends?.checkFriendsInServers?.(force);
          } catch {
            return rsdFriendsCache;
          }
        }
        function rsdOpenFriendsServersPanel(opts = {}) {
          try {
            return __friends?.openFriendsServersPanel?.(opts);
          } catch {}
        }
        function rsdInitFriendsModuleObserver() {
          try {
            return __friends?.initFriendsModuleObserver?.();
          } catch {}
        }

        async function fetchThumbnailAssets(tokens) {
          if (!tokens || tokens.length === 0) return {};

          const baseUrl = "https://thumbnails.roblox.com/v1/batch";
          const batchSize = 100;
          const thumbnailMap = {};
          const allRequests = [];
          let warned = false;

          for (let i = 0; i < tokens.length; i += batchSize) {
            const tokenBatch = tokens.slice(i, i + batchSize);
            if (tokenBatch.length === 0) continue;

            const requests = tokenBatch.map((token) => ({
              requestId: `${token}::AvatarHeadshot:48x48:webp:regular`,
              type: "AvatarHeadShot",
              targetId: 0,
              token: token,
              format: "webp",
              size: "48x48",
            }));

            const doFetch = async () => {
              const response = await fetch(baseUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify(requests),
                credentials: "include",
                cache: "no-store",
              });
              if (!response.ok) return { data: [] };
              return await response.json();
            };

            const fetchPromise = (async () => {
              try {
                let data;
                try {
                  data = await doFetch();
                } catch {
                  await delay(150);
                  data = await doFetch();
                }

                data?.data?.forEach((d) => {
                  const token = d.requestId?.split("::")[0];
                  if (token) {
                    thumbnailMap[token] =
                      d.state === "Completed" && d.imageUrl ? d.imageUrl : null;
                  }
                });
              } catch (error) {
                if (!warned) {
                  warned = true;
                  try {
                    const dbg = globalThis.RSD?.utils?.getDebugEnabled?.() === true;
                    if (dbg) {
                      console.warn(
                        "roservertools: Thumbnail batch fetch failed (avatars may be missing).",
                        error,
                      );
                    }
                  } catch {}

                }
              }
            })();

            allRequests.push(fetchPromise);
            if (i + batchSize < tokens.length) await delay(150);
          }

          await Promise.all(allRequests);
          return thumbnailMap;
        }
        let isScrollingList = false;
        let scrollTimeout = null;
        const SCROLL_DEBOUNCE_MS = 100;
        function addScrollListenerToListContainer(listContainer) {
          if (!listContainer || listContainer.dataset.scrollListenerAttached) {
            return;
          }
          listContainer.addEventListener(
            "scroll",
            () => {
              isScrollingList = true;
              clearTimeout(scrollTimeout);
              scrollTimeout = setTimeout(() => {
                isScrollingList = false;
              }, SCROLL_DEBOUNCE_MS);
            },
            {
              passive: true,
            },
          );
          listContainer.dataset.scrollListenerAttached = "true";
        }
        async function updateDetailsServers(retries = 5) {
          let gameTitleContainer =
            document.querySelector(".game-title-container") ||
            document.getElementById("game-detail-meta-data") ||
            document.querySelector(
              'div[class^="game-calls-to-action"] > div:first-child',
            ) ||
            document.getElementById("game-details-play-button-container");
          if (!gameTitleContainer) {
            const header = document.querySelector(".container-header");
            if (header) gameTitleContainer = header.nextElementSibling;
          }
          if (!gameTitleContainer) {
            gameTitleContainer = document.querySelector(
              "#game-details .content",
            );
          }
          if (!gameTitleContainer) {
            if (retries > 0) {
              await delay(1000);
              await updateDetailsServers(retries - 1);
            } else {
            }
            return;
          }
          const isDarkMode = currentTheme === "dark";

          const existingDropdown = document.getElementById("regionDropdown");
          if (existingDropdown && regionButtonAdded) {
            const regionDropdown = existingDropdown;
            const regionListContainer = document.getElementById(
              "roservertools-region-list-container",
            );
            const refreshButton = document.getElementById("rsd-refresh-btn");
            if (
              regionListContainer &&
              !regionListContainer.dataset.scrollListenerAttached
            ) {
              addScrollListenerToListContainer(regionListContainer);
            }
            if (regionDropdown && regionListContainer) {
              await regionServersPopulate(regionListContainer);
              regionDropdown.style.backgroundColor = isDarkMode
                ? "rgb(39, 41, 48)"
                : "#ffffff";
              regionDropdown.style.border = isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.15)"
                : "1px solid #ccc";
              regionDropdown.style.color = isDarkMode ? "#ffffff" : "#392213";
              const headerContainer =
                regionDropdown.querySelector("div:first-child");
              if (headerContainer) {
                headerContainer.style.borderBottom = `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`;
                const titleText = headerContainer.querySelector("p");
                if (titleText)
                  titleText.style.color = isDarkMode
                    ? "white"
                    : "rgb(39, 41, 48)";
                if (refreshButton) {
                  const isDisabled = checkForRefreshingCount || rateLimited;
                  refreshButton.disabled = isDisabled;
                  refreshButton.style.cursor = isDisabled
                    ? "not-allowed"
                    : "pointer";
                  const mutedColor = isDarkMode ? "#888" : "#999";
                  const readyColor = isDarkMode ? "#ccc" : "#555";
                  const desiredColor = isDisabled ? mutedColor : readyColor;

                  if (checkForRefreshingCount) {
                    rsdStartSpinner(refreshButton);
                    refreshButton.style.color = mutedColor;
                  } else {
                    rsdStopSpinner(refreshButton);
                    refreshButton.style.color = desiredColor;
                  }
                }
                const icon = headerContainer.querySelector("img");
                if (icon && icon.alt === "roservertools Icon") {
                }
              }

              rsdEnsurePlayHook(regionDropdown, regionListContainer);
              handleRateLimitedState(rateLimited);

              try {
                const sp = document.getElementById("rsd-region-sidepanel");
                if (sp && sp.classList.contains("rsd-open")) {
                  try {
                    if (
                      document.querySelector(
                        "#rsd-region-sidepanel button:hover, #rsd-region-sidepanel [role=\"button\"]:hover, #rsd-region-sidepanel .rsd-clickable:hover",
                      )
                    ) {
                      return;
                    }
                  } catch {}
                  const rc = sp.dataset.rsdRegion;
                  if (rc) {
                    await rsdOpenRegionSidePanel(rc, true);
                  }
                }
              } catch {}
              return;
            } else {
              const existingDropdown =
                document.getElementById("regionDropdown");
              if (existingDropdown) existingDropdown.remove();
              regionButtonAdded = false;
            }
          }
          if (regionButtonAdded) return;

          const regionDropdown = document.createElement("div");
          regionDropdown.id = "regionDropdown";
          regionDropdown.className = `rsd-dropdown ${isDarkMode ? "rsd-dark" : "rsd-light"}`;
          const headerContainer = document.createElement("div");
          headerContainer.className = "rsd-dropdown-header";
          const titleText = document.createElement("p");
          titleText.textContent = regionSelector_Translated;
          titleText.className = "rsd-dropdown-title";
          const buttonContainer = document.createElement("div");
          buttonContainer.className = "rsd-dropdown-actions";
          const refreshButton = document.createElement("button");
          refreshButton.id = "rsd-refresh-btn";

          refreshButton.innerHTML = `
						<svg class="rsd-refresh-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
							<!-- Ring track -->
							<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.2" opacity="0.28" />
							<!-- Highlight segment -->
							<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"
									transform="rotate(-90 12 12)" stroke-dasharray="14 50" stroke-dashoffset="0" />
						</svg>
					`;

          refreshButton.className = "rsd-iconbtn";
          refreshButton.onclick = async (e) => {
            e.stopPropagation();
            if (!checkForRefreshingCount && !rateLimited) {
              refreshButton.disabled = true;
              refreshButton.style.cursor = "wait";
              refreshButton.style.color = isDarkMode ? "#888" : "#999";
              rsdStartSpinner(refreshButton);
              const listContainer = document.getElementById(
                "roservertools-region-list-container",
              );
              if (listContainer) {
                listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: ${isDarkMode ? "#aaa" : "#666"};">Refreshing...</div>`;
              }
              try {
                await getServerInfo(placeId, defaultRegions, true);
              } finally {
                rsdStopSpinner(refreshButton);
                try {
                  rsdCheckFriendsInServers(true);
                } catch {}
              }
            }
          };

          const friendsButton = document.createElement("button");
          friendsButton.id = "rsd-friends-btn";

          friendsButton.className = "rsd-iconbtn rsd-friends-btn";
          const recentButton = document.createElement("button");
          recentButton.id = "rsd-recent-btn";
          recentButton.className = "rsd-iconbtn rsd-recent-btn";
          recentButton.setAttribute("aria-label", "Join history");
          recentButton.innerHTML = `
            <svg class="rsd-recent-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.85"></circle>
              <path d="M12 7.5v5l3.2 1.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          `;
          try {
            globalThis.RSD?.history_panel?.bindButton?.(recentButton, {
              overlay: __overlay,
              getCurrentTheme: () => currentTheme,
            });
          } catch {}

          function rsdSetFriendsButtonIconLocal(btn, totalFriendsCount) {
            let wrap = null;
            try {
              wrap = btn.querySelector(":scope > .rsd-friends-iconwrap");
            } catch {
              wrap = btn.querySelector(".rsd-friends-iconwrap");
            }

            if (!wrap) {
              try {
                while (btn.firstChild) btn.removeChild(btn.firstChild);
              } catch {
                btn.textContent = "";
              }
              wrap = document.createElement("span");
              wrap.className = "rsd-friends-iconwrap";
              btn.appendChild(wrap);
            }

            let iconImg = wrap.querySelector("img.rsd-friends-icon");
            if (!iconImg) {
              let iconUrl = "";
              try {
                iconUrl = chrome?.runtime?.getURL
                  ? chrome.runtime.getURL("assets/icons/friends_wave.png")
                  : "";
              } catch {}
              if (iconUrl) {
                iconImg = document.createElement("img");
                iconImg.className = "rsd-friends-icon";
                iconImg.src = iconUrl;
                iconImg.alt = "Friends";
                wrap.insertBefore(iconImg, wrap.firstChild);
              }
            }

            const count = Number(totalFriendsCount || 0);
            const badge = count > 5 ? "5+" : count > 0 ? String(count) : "";
            let badgeEl = wrap.querySelector(".rsd-friends-badge");

            if (badge) {
              if (!badgeEl) {
                badgeEl = document.createElement("span");
                badgeEl.className = "rsd-friends-badge";
                wrap.appendChild(badgeEl);
              }
              badgeEl.textContent = badge;
            } else {
              try {
                badgeEl && badgeEl.remove();
              } catch {}
            }
          }

          rsdSetFriendsButtonIconLocal(friendsButton, 0);

          friendsButton.addEventListener(
            "click",
            (e) => {
              try {
                e.preventDefault();
                e.stopPropagation();

                rsdCancelCloseSidePanel();
              } catch {}
              if (friendsButton.classList.contains("rsd-disabled")) return;
              try {
                rsdOpenFriendsServersPanel({ forceRefresh: false });
              } catch {}
            },
            true,
          );
          friendsButton.onclick = null;

          try {
            rsdCheckFriendsInServers(false);
          } catch {}
          try {
            rsdInitFriendsModuleObserver();
          } catch {}

          try {
            if (!window.__rsdFriendsPreloadTimer) {
              window.__rsdFriendsPreloadTimer = setInterval(() => {
                if (!document.getElementById("regionDropdown")) {
                  clearInterval(window.__rsdFriendsPreloadTimer);
                  window.__rsdFriendsPreloadTimer = null;
                  return;
                }
                try {
                  rsdCheckFriendsInServers(false);
                } catch {}
              }, 25000);
            }
          } catch {}
          const __rsdDiv1 = document.createElement('span');
          __rsdDiv1.className = 'rsd-icon-divider';
          const __rsdDiv2 = document.createElement('span');
          __rsdDiv2.className = 'rsd-icon-divider';
          buttonContainer.append(refreshButton, __rsdDiv1, recentButton, __rsdDiv2, friendsButton);

          try {
            rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, true);
          } catch {}
          headerContainer.append(titleText, buttonContainer);
          regionDropdown.appendChild(headerContainer);
          const regionListContainer = document.createElement("div");
          regionListContainer.id = "roservertools-region-list-container";
          regionListContainer.className = "rsd-region-list";

          regionListContainer.addEventListener("mouseover", (e) => {
            const item =
              e.target && e.target.closest
                ? e.target.closest(".rsd-region-item")
                : null;
            if (!item || !regionListContainer.contains(item)) return;
            const code = item.dataset ? item.dataset.rsdRegionCode : null;
            if (!code) return;
            if (rsdHoveredRegionEl && rsdHoveredRegionEl !== item) {
              rsdSetHoverBg(rsdHoveredRegionEl, false, isDarkMode);
            }
            rsdHoveredRegionCode = code;
            rsdHoveredRegionEl = item;
            rsdSetHoverBg(item, true, isDarkMode);
          });
          regionListContainer.addEventListener("mouseout", (e) => {
            const fromItem =
              e.target && e.target.closest
                ? e.target.closest(".rsd-region-item")
                : null;
            if (!fromItem || !regionListContainer.contains(fromItem)) return;

            const toItem =
              e.relatedTarget && e.relatedTarget.closest
                ? e.relatedTarget.closest(".rsd-region-item")
                : null;
            if (toItem === fromItem) return;
            if (rsdHoveredRegionEl === fromItem) {
              rsdSetHoverBg(fromItem, false, isDarkMode);
              rsdHoveredRegionEl = null;
              rsdHoveredRegionCode = null;
            }
          });
          addScrollListenerToListContainer(regionListContainer);

          regionServersPopulate(regionListContainer);
          regionDropdown.appendChild(regionListContainer);
          if (
            window.getComputedStyle(gameTitleContainer).position === "static"
          ) {
            gameTitleContainer.style.position = "relative";
          }
          gameTitleContainer.appendChild(regionDropdown);
          try { rsdDisableTooltips(regionDropdown); } catch {}
          regionButtonAdded = true;
          regionDropdown.style.left = "0px";

          regionDropdown.style.display = "block";

          rsdEnsurePlayHook(regionDropdown, regionListContainer);
          handleRateLimitedState(rateLimited);
        }

        let rsdGlobalPlayButton = null;
        let rsdPlayObserverAttached = false;

        let rsdPlayReadyPromise = null;
        let rsdPlayReadyForEl = null;
        function rsdIsElementVisible(el) {
          if (!el || !el.getBoundingClientRect) return false;
          if (!el.isConnected) return false;

          try {
            if (
              el.offsetParent === null &&
              window.getComputedStyle(el).position !== "fixed"
            )
              return false;
          } catch {}
          const style = window.getComputedStyle(el);

          if (style.display === "none" || style.visibility === "hidden")
            return false;
          if (style.pointerEvents === "none") return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const vh =
            window.innerHeight || document.documentElement.clientHeight;
          const vw = window.innerWidth || document.documentElement.clientWidth;
          if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw)
            return false;
          return true;
        }

        function rsdIsPlayButtonReady(el) {
          if (!rsdIsElementVisible(el)) return false;
          try {
            if (el.tagName === "BUTTON" && el.disabled) return false;
            const ariaDisabled =
              el.getAttribute && el.getAttribute("aria-disabled");
            if (ariaDisabled && ariaDisabled.toLowerCase() === "true")
              return false;

            const hasIcon = !!(
              el.querySelector &&
              el.querySelector('svg, span[class*="icon"], i, .icon-play')
            );
            if (!hasIcon) return false;

            const style = window.getComputedStyle(el);
            if (style.cursor === "wait") return false;

            const label = (
              (el.getAttribute &&
                (el.getAttribute("aria-label") ||
                  el.getAttribute("data-testid"))) ||
              ""
            ).toLowerCase();
            const t = (el.innerText || el.textContent || "")
              .trim()
              .toLowerCase();
            const looksLikePlay =
              t === "play" ||
              t === "join" ||
              label.includes("play") ||
              label.includes("join");
            if (!looksLikePlay) return false;

            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
          } catch {}
          return true;
        }

        async function rsdWaitForRobloxPlayReady(el) {
          if (!el) return false;

          if (rsdPlayReadyPromise && rsdPlayReadyForEl === el)
            return rsdPlayReadyPromise;
          rsdPlayReadyForEl = el;
          rsdPlayReadyPromise = (async () => {
            while (el && el.isConnected && !rsdIsElementVisible(el)) {
              await new Promise((r) => requestAnimationFrame(r));
            }
            if (!el || !el.isConnected) return false;

            try {
              if (el.getAnimations) {
                while (el && el.isConnected) {
                  const anims = el.getAnimations({ subtree: true }) || [];
                  const running = anims.filter(
                    (a) => a && a.playState === "running",
                  );
                  if (!running.length) break;

                  await Promise.race(
                    running.map((a) =>
                      a.finished
                        ? a.finished.catch(() => null)
                        : Promise.resolve(null),
                    ),
                  );
                }
              }
            } catch {}

            await new Promise((r) => requestAnimationFrame(r));
            if (!el || !el.isConnected) return false;
            return rsdIsPlayButtonReady(el);
          })();
          return rsdPlayReadyPromise;
        }

        function rsdFindPlayButtonCandidate() {
          const selectors = [
            'button[data-testid="play-button"]',
            'button[data-test="play-button"]',
            'button[data-testid="play-game-button"]',
            "button#game-details-play-button",
            '[id^="game-details-play-button"]',
            ".btn-common-play-game-lg",
            ".play-button-container > button",
            'button[aria-label="Play"]',
            'button[aria-label="Join"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && rsdIsElementVisible(el)) return el;
          }

          const nodes = Array.from(
            document.querySelectorAll(
              'button, a[role="button"], div[role="button"]',
            ),
          );
          for (const el of nodes) {
            if (!rsdIsElementVisible(el)) continue;
            const t = (el.innerText || el.textContent || "")
              .trim()
              .toLowerCase();
            if (t == "play" || t == "join") return el;
          }
          return null;
        }

        function rsdEnsurePlayHook(regionDropdown, regionListContainer) {
          if (!window.__rsdPointerTrackerInstalled) {
            window.__rsdPointerTrackerInstalled = true;
            window.__rsdLastPointer = { x: null, y: null };
            const upd = (e) => {
              try {
                window.__rsdLastPointer.x = e.clientX;
                window.__rsdLastPointer.y = e.clientY;
              } catch {}
            };
            document.addEventListener("pointermove", upd, {
              passive: true,
              capture: true,
            });
            document.addEventListener("mousemove", upd, {
              passive: true,
              capture: true,
            });
          }

          const btn = rsdFindPlayButtonCandidate();
          if (btn) {
            rsdGlobalPlayButton = btn;

            if (
              !btn.dataset.rsdHoverAttached &&
              !btn.dataset.rsdHoverAttaching
            ) {
              btn.dataset.rsdHoverAttaching = "true";
              rsdWaitForRobloxPlayReady(btn)
                .then((ok) => {
                  try {
                    delete btn.dataset.rsdHoverAttaching;
                  } catch {}
                  if (!ok) return;
                  if (!btn.isConnected) return;

                  if (rsdGlobalPlayButton !== btn) return;
                  if (!btn.dataset.rsdHoverAttached) {
                    rsdAttachPlayHoverAndIntercept(
                      btn,
                      regionDropdown,
                      regionListContainer,
                    );
                  }
                })
                .catch(() => {
                  try {
                    delete btn.dataset.rsdHoverAttaching;
                  } catch {}
                });
            }
          }
          if (rsdPlayObserverAttached) return;
          rsdPlayObserverAttached = true;
          let scheduled = false;
          const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            setTimeout(() => {
              scheduled = false;
              try {
                rsdEnsurePlayHook(regionDropdown, regionListContainer);
              } catch {}
            }, 120);
          };
          try {
            const obs = new MutationObserver(schedule);
            obs.observe(document.documentElement, {
              childList: true,
              subtree: true,
            });
          } catch {}
        }

        function rsdPreparePlayIcon(playButton) {
          try {
            if (!playButton || !playButton.isConnected) return;
            playButton.classList.add("rsd-play-btn");

            let icon = playButton.querySelector("svg");
            if (!icon)
              icon = playButton.querySelector(
                'span[class*="icon"], i, .icon-play',
              );
            if (!icon) return;
            icon.classList.add("rsd-play-icon");
          } catch {}
        }

        function rsdAttachPlayHoverAndIntercept(
          playButton,
          regionDropdown,
          regionListContainer,
        ) {
          if (!playButton || !regionDropdown) return;
          playButton.dataset.rsdHoverAttached = "true";
          rsdPreparePlayIcon(playButton);

          const RSD_UI_GAP_PX = 6;

          const RSD_UI_SAFE_OVERLAP_PX = 6;

          try {
            window.__rsdUiGapPx = RSD_UI_GAP_PX;
          } catch {}
          let closeTimer = null;
          let openReadyTimer = null;
          let cleanupTimer = null;
          let staggerCloseTimer = null;
          let desiredOpen = false;
          let state = "closed";
          let transitionId = 0;

          function rsdSetPlayReady(on) {
            try {
              if (on) {
                playButton.dataset.rsdReady = "true";
                playButton.classList.add("rsd-ready");
                regionDropdown.classList.add("rsd-ready");
              } else {
                delete playButton.dataset.rsdReady;
                playButton.classList.remove("rsd-ready");
                regionDropdown.classList.remove("rsd-ready");
              }
            } catch {}
          }

          const bridgeId = "rsd-hover-bridge";
          let hoverBridge = document.getElementById(bridgeId);
          if (!hoverBridge) {
            hoverBridge = document.createElement("div");
            hoverBridge.id = bridgeId;
            hoverBridge.style.position = "absolute";
            hoverBridge.style.background = "transparent";
            hoverBridge.style.pointerEvents = "none";

            hoverBridge.style.zIndex = "9999";

            (regionDropdown.parentElement || document.body).appendChild(
              hoverBridge,
            );
          }

          function positionDropdown() {
            try {
              const parent =
                regionDropdown.offsetParent || regionDropdown.parentElement;
              if (!parent) return;
              const parentRect = parent.getBoundingClientRect();
              const btnRect = playButton.getBoundingClientRect();

              const btnWidth = Math.max(120, Math.round(btnRect.width));
              regionDropdown.style.width = btnWidth + "px";
              regionDropdown.style.minWidth = btnWidth + "px";
              const left = Math.max(
                0,
                Math.round(btnRect.left - parentRect.left),
              );
              const top = Math.max(
                0,
                Math.round(btnRect.bottom - parentRect.top + RSD_UI_GAP_PX),
              );

              regionDropdown.style.left = left + "px";
              regionDropdown.style.top = top + "px";
              regionDropdown.style.transform = "";

              try {
                regionDropdown.style.setProperty(
                  "--rsd-ui-gap",
                  RSD_UI_GAP_PX + "px",
                );
              } catch {}

              const bridgeHeight = Math.max(
                12,
                RSD_UI_GAP_PX + RSD_UI_SAFE_OVERLAP_PX * 2,
              );
              hoverBridge.style.left = left + "px";

              hoverBridge.style.top =
                Math.max(
                  0,
                  Math.round(
                    btnRect.bottom - parentRect.top - RSD_UI_SAFE_OVERLAP_PX,
                  ),
                ) + "px";
              hoverBridge.style.width = btnWidth + "px";
              hoverBridge.style.height = bridgeHeight + "px";
            } catch {}
          }

          function clearTimers() {
            if (closeTimer) {
              clearTimeout(closeTimer);
              closeTimer = null;
            }
            if (openReadyTimer) {
              clearTimeout(openReadyTimer);
              openReadyTimer = null;
            }
            if (cleanupTimer) {
              clearTimeout(cleanupTimer);
              cleanupTimer = null;
            }
            if (staggerCloseTimer) {
              clearTimeout(staggerCloseTimer);
              staggerCloseTimer = null;
            }
          }

          async function doOpen() {
            if (!rsdIsPlayButtonReady(playButton)) return;
            clearTimers();
            transitionId++;
            const id = transitionId;
            state = "opening";
            rsdSetPlayReady(false);
            positionDropdown();

            try {
              regionDropdown.classList.remove("rsd-closing");
            } catch {}
            regionDropdown.classList.add("rsd-open");

            playButton.classList.add("rsd-play-open");
            hoverBridge.style.pointerEvents = "auto";

            setTimeout(() => {
              if (id !== transitionId || !desiredOpen) return;
              state = "open";
              rsdSetPlayReady(true);
            }, 0);

            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
            if (id != transitionId) return;
            try {
              await regionServersPopulate(regionListContainer);
            } catch {}
          }

          function rsdCloseSidePanelNow() {
            try {
              const regionSp = document.getElementById("rsd-region-sidepanel");
              const friendsSp = document.getElementById(
                "rsd-friends-sidepanel",
              );
              const recentSp = document.getElementById("rsd-recent-sidepanel");
              const bridge = document.getElementById("rsd-sidepanel-bridge");

              rsdAnimateSidePanelOut(regionSp);
              rsdAnimateSidePanelOut(friendsSp);
              rsdAnimateSidePanelOut(recentSp);
              try {
                if (recentSp) recentSp.remove();
              } catch {}
              try {
                const btn = document.getElementById("rsd-recent-btn");
                if (btn) btn.classList.remove("rsd-panel-open");
              } catch {}

              if (bridge) bridge.style.pointerEvents = "none";
              try {
                if (bridge) bridge.remove();
              } catch {}
            } catch {}
          }

          function doCloseMain() {
            clearTimers();
            transitionId++;
            const id = transitionId;
            state = "closing";
            rsdSetPlayReady(false);

            rsdCloseSidePanelNow();

            try {
              playButton.classList.remove("rsd-play-open");
            } catch {}

            try {
              regionDropdown.classList.add("rsd-closing");
            } catch {}
            try {
              regionDropdown.classList.remove("rsd-open");
            } catch {}
            hoverBridge.style.pointerEvents = "none";

            try {
              if (id != transitionId) return;
            } catch {}
            state = "closed";
            try {
              regionDropdown.classList.remove("rsd-closing");
            } catch {}
          }

          function doCloseStaggered() {
            rsdCloseSidePanelNow();
            if (desiredOpen) return;
            if (state === "closed" || state === "closing") return;
            doCloseMain();
          }

          function requestOpen() {
            desiredOpen = true;
            if (closeTimer) {
              clearTimeout(closeTimer);
              closeTimer = null;
            }
            if (staggerCloseTimer) {
              clearTimeout(staggerCloseTimer);
              staggerCloseTimer = null;
            }
            if (state === "open" || state === "opening") {
              positionDropdown();
              return;
            }
            doOpen();
          }

          function requestCloseNow() {
            desiredOpen = false;

            if (closeTimer) {
              clearTimeout(closeTimer);
              closeTimer = null;
            }
            if (staggerCloseTimer) {
              clearTimeout(staggerCloseTimer);
              staggerCloseTimer = null;
            }
            if (desiredOpen) return;
            if (state === "closed" || state === "closing") return;
            doCloseMain();
          }

          function isRsdUiTarget(node) {
            try {
              if (!node) return false;
              if (node === playButton || playButton.contains(node)) return true;
              if (node === regionDropdown || regionDropdown.contains(node))
                return true;
              if (node === hoverBridge || hoverBridge.contains(node))
                return true;
              const sp = document.getElementById("rsd-region-sidepanel");
              if (sp && (node === sp || sp.contains(node))) return true;
              const spb = document.getElementById("rsd-sidepanel-bridge");
              if (spb && (node === spb || spb.contains(node))) return true;
            } catch {}
            return false;
          }
          if (!window.__rsdOutsideClickHooked) {
            window.__rsdOutsideClickHooked = true;
            document.addEventListener(
              "pointerdown",
              (e) => {
                try {
                  const dd = document.getElementById("regionDropdown");
                  if (!dd || !dd.classList.contains("rsd-open")) return;
                  if (isRsdUiTarget(e.target)) return;
                  if (typeof window.__rsdCloseRegionDropdown === "function")
                    window.__rsdCloseRegionDropdown();
                } catch {}
              },
              true,
            );
          }

          window.__rsdCloseRegionDropdown = () => {
            try {
              desiredOpen = false;
            } catch {}
            try {
              playButton.blur();
            } catch {}
            try {
              if (state != "closed" && state != "closing") doCloseStaggered();
            } catch {}
          };

          playButton.addEventListener("mouseenter", requestOpen);
          playButton.addEventListener("mouseleave", (e) => {
            if (
              e &&
              e.relatedTarget &&
              (regionDropdown.contains(e.relatedTarget) ||
                hoverBridge.contains(e.relatedTarget))
            )
              return;
            requestCloseNow();
          });
          regionDropdown.addEventListener("mouseenter", requestOpen);
          regionDropdown.addEventListener("mouseleave", (e) => {
            if (
              e &&
              e.relatedTarget &&
              (playButton.contains(e.relatedTarget) ||
                hoverBridge.contains(e.relatedTarget))
            )
              return;
            requestCloseNow();
          });
          hoverBridge.addEventListener("mouseenter", requestOpen);
          hoverBridge.addEventListener("mouseleave", (e) => {
            if (
              e &&
              e.relatedTarget &&
              (playButton.contains(e.relatedTarget) ||
                regionDropdown.contains(e.relatedTarget))
            )
              return;
            requestCloseNow();
          });

          try {
            const lp = window.__rsdLastPointer;
            if (lp && typeof lp.x === "number" && typeof lp.y === "number") {
              const elAt = document.elementFromPoint(lp.x, lp.y);
              if (elAt && (elAt === playButton || playButton.contains(elAt))) {
                requestOpen();
              }
            }
          } catch {}

          window.addEventListener("resize", positionDropdown);
          window.addEventListener("scroll", positionDropdown, true);

          function rsdBlockPlayIfNotReady(e) {
            try {
              if (playButton.dataset.rsdReady === "true") return;
              e.preventDefault();
              e.stopImmediatePropagation();
              e.stopPropagation();
            } catch {}
          }

          playButton.addEventListener(
            "pointerdown",
            rsdBlockPlayIfNotReady,
            true,
          );
          playButton.addEventListener(
            "mousedown",
            rsdBlockPlayIfNotReady,
            true,
          );
          playButton.addEventListener("click", rsdBlockPlayIfNotReady, true);
        }
        function getRegionContinentInfo(regionCode, coordinatesMap) {
          regionCode = rsdNormalizeRegionCode(regionCode);
          if (!regionCode) return unknown_Translated;

          if (regionCode === "??" || regionCode === "???")
            return unknown_Translated;
          if (regionCode.startsWith("US-")) return "North America";

          switch (regionCode) {
            case "DE":
            case "FR":
            case "NL":
            case "GB":
            case "PL":
              return "Europe";
            case "SG":
            case "JP":
            case "IN":
            case "HK":
              return "Asia";
            case "AU":
              return "Oceania";
            case "BR":
              return "South America";
            default:
              break;
          }

          const regionInfo = coordinatesMap && coordinatesMap[regionCode];
          const country = regionInfo && regionInfo.country;
          if (country === "United States") return "North America";
          return unknown_Translated;
        }
        async function regionServersPopulate(listContainer) {
          if (!listContainer) return;
          const isDarkMode = currentTheme === "dark";

          if (!listContainer.dataset.rsdPointerHandlerAttached) {
            listContainer.addEventListener(
              "pointerdown",
              (e) => {
                const item =
                  e.target && e.target.closest
                    ? e.target.closest("[data-rsd-region-code]")
                    : null;
                if (!item || !listContainer.contains(item)) return;
                const regionCode = item.dataset.rsdRegionCode;
                if (!regionCode) return;
                if (item.dataset.rsdEnabled !== "1") return;

                if (regionSelectorShowServerlistPanel) {
                  e.preventDefault();
                  e.stopPropagation();

                  try {
                    const existing = document.getElementById(
                      "rsd-region-sidepanel",
                    );
                    if (
                      existing &&
                      existing.classList &&
                      existing.classList.contains("rsd-open") &&
                      existing.dataset &&
                      existing.dataset.rsdRegion === regionCode
                    ) {
                      return;
                    }
                  } catch {}
                  rsdOpenRegionSidePanel(regionCode);
                  return;
                }

                e.preventDefault();
                e.stopPropagation();
                joinSpecificRegion(regionCode);
                const dropdown = document.getElementById("regionDropdown");
                if (dropdown) {
                  dropdown.classList.remove("rsd-open");
                  dropdown.style.display = "block";
                }
              },
              true,
            );
            listContainer.dataset.rsdPointerHandlerAttached = "true";
          }

          const foundRegionCodes = Object.keys(regionServerCounting).filter(
            (rc) => rc !== "??",
          );
          const allKnownRegionCodes = new Set([
            ...defaultRegions,
            ...foundRegionCodes,
          ]);
          const unknownServerCount =
            (regionServerCounting[UNKNOWN_REGION] || 0) +
            (regionServerCounting["???"] || 0);
          const regionsData = Array.from(allKnownRegionCodes).map((code) => ({
            code,
            name: getFullLocationName(code, regionCoordinates),
            count: regionServerCounting[code] || 0,
            continent: getRegionContinentInfo(code, regionCoordinates),
          }));
          const groupedRegions = regionsData.reduce((acc, region) => {
            const continent = region.continent;
            if (!acc[continent]) acc[continent] = [];
            acc[continent].push(region);
            return acc;
          }, {});
          for (const continent in groupedRegions) {
            groupedRegions[continent].sort((a, b) => {
              if (a.code === "BR") return 1;
              if (b.code === "BR") return -1;
              if (a.count > 0 && b.count === 0) return -1;
              if (a.count === 0 && b.count > 0) return 1;
              if (
                robloxProfileUserLocation &&
                typeof robloxProfileUserLocation.latitude === "number" &&
                typeof robloxProfileUserLocation.longitude === "number"
              ) {
                const coordsA = regionCoordinates[a.code];
                const coordsB = regionCoordinates[b.code];
                if (coordsA && coordsB) {
                  const distanceA = calculateDistance(
                    robloxProfileUserLocation.latitude,
                    robloxProfileUserLocation.longitude,
                    coordsA.latitude,
                    coordsA.longitude,
                  );
                  const distanceB = calculateDistance(
                    robloxProfileUserLocation.latitude,
                    robloxProfileUserLocation.longitude,
                    coordsB.latitude,
                    coordsB.longitude,
                  );
                  if (!isNaN(distanceA) && !isNaN(distanceB))
                    return distanceA - distanceB;
                }
              }
              return a.name.localeCompare(b.name);
            });
          }
          function calculateAverageDistanceForContinent(regions, userLoc) {
            if (!regions || !regions.length || !userLoc) return NaN;
            let totalDistance = 0;
            let countWithCoords = 0;
            for (const region of regions) {
              const coords = regionCoordinates[region.code];
              if (
                coords &&
                typeof coords.latitude === "number" &&
                typeof coords.longitude === "number"
              ) {
                const distance = calculateDistance(
                  userLoc.latitude,
                  userLoc.longitude,
                  coords.latitude,
                  coords.longitude,
                );
                if (!isNaN(distance)) {
                  totalDistance += distance;
                  countWithCoords++;
                }
              }
            }
            return countWithCoords > 0 ? totalDistance / countWithCoords : NaN;
          }
          const sortedContinents = Object.keys(groupedRegions).sort((a, b) => {
            const hasRegionBR_A = groupedRegions[a].some(
              (r) => r.code === "BR",
            );
            const hasRegionBR_B = groupedRegions[b].some(
              (r) => r.code === "BR",
            );
            if (hasRegionBR_A && !hasRegionBR_B) return 1;
            if (!hasRegionBR_A && hasRegionBR_B) return -1;
            if (a === unknown_Translated && b !== unknown_Translated) return 1;
            if (a !== unknown_Translated && b === unknown_Translated) return -1;
            if (a === unknown_Translated && b === unknown_Translated) return 0;
            if (
              robloxProfileUserLocation &&
              typeof robloxProfileUserLocation.latitude === "number" &&
              typeof robloxProfileUserLocation.longitude === "number"
            ) {
              const avgA = calculateAverageDistanceForContinent(
                groupedRegions[a],
                robloxProfileUserLocation,
              );
              const avgB = calculateAverageDistanceForContinent(
                groupedRegions[b],
                robloxProfileUserLocation,
              );
              if (!isNaN(avgA) && !isNaN(avgB)) return avgA - avgB;
            }
            const totalServersA = groupedRegions[a].reduce(
              (sum, r) => sum + r.count,
              0,
            );
            const totalServersB = groupedRegions[b].reduce(
              (sum, r) => sum + r.count,
              0,
            );
            if (totalServersB !== totalServersA)
              return totalServersB - totalServersA;
            return a.localeCompare(b);
          });
          const signature = sortedContinents
            .map(
              (c) => c + ":" + groupedRegions[c].map((r) => r.code).join(","),
            )
            .join("|");
          let cache = listContainer._rsdCache;
          if (!cache || cache.signature !== signature) {
            listContainer.innerHTML = "";
            cache = {
              signature,
              items: new Map(),
              unknownHeader: null,
              unknownRow: null,
              unknownCountSpan: null,
            };
            let isFirstHeader = true;

            let rsdAnimIndex = 0;
            for (const continent of sortedContinents) {
              const regionsInGroup = groupedRegions[continent];
              if (!regionsInGroup || regionsInGroup.length === 0) continue;
              const header = document.createElement("div");
              header.textContent = continent;
              header.style.cssText = `
								padding: 8px 12px 4px 12px; font-size: 12px;
								font-weight: 600; color: ${isDarkMode ? "#eeeeee" : "#555555"};
								text-transform: uppercase; letter-spacing: 0.5px;
								border-top: ${isFirstHeader ? "none" : `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`};
								margin-top: ${isFirstHeader ? "0px" : "8px"};
								background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"};
								position: relative; z-index: 1;
							`;
              listContainer.appendChild(header);
              isFirstHeader = false;
              regionsInGroup.forEach((region, index) => {
                const listItem = document.createElement("div");
                listItem.dataset.rsdRegionCode = region.code;
                listItem.style.setProperty(
                  "--rsd-item-i",
                  String(rsdAnimIndex++),
                );
                listItem.style.cssText = `
									display: flex; justify-content: space-between; align-items: center;
									padding: 8px 12px;
									border-top: ${index === 0 ? "none" : `1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"}`};
									transition: background-color 0.15s ease;
									background-color: transparent;
								`;
                listItem.classList.add("rsd-region-item");
                const nameSpan = document.createElement("span");
                nameSpan.textContent = region.name;
                nameSpan.style.cssText = `font-size: 14px; font-weight: 500; color: ${isDarkMode ? "#a0a0a0" : "#777777"};`;
                const countSpan = document.createElement("span");
                countSpan.style.cssText = `
									font-size: 13px; font-weight: 400;
									background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"};
									padding: 2px 8px; border-radius: 4px;
									min-width: 34px;
									text-align: center;
								`;
                listItem.append(nameSpan, countSpan);
                listContainer.appendChild(listItem);
                cache.items.set(region.code, {
                  el: listItem,
                  nameSpan,
                  countSpan,
                  name: region.name,
                });
                if (rsdHoveredRegionCode === region.code) {
                  rsdHoveredRegionEl = listItem;
                  rsdSetHoverBg(listItem, true, isDarkMode);
                }
              });
            }

            const unknownHeader = document.createElement("div");
            unknownHeader.textContent = unknown_Translated;
            unknownHeader.style.cssText = `
							padding: 8px 12px 4px 12px; font-size: 12px;
							font-weight: 600; color: ${isDarkMode ? "#eeeeee" : "#555555"};
							text-transform: uppercase; letter-spacing: 0.5px;
							border-top: 1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"};
							margin-top: 8px;
							background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"};
							position: relative; z-index: 1;
						`;
            const unknownRow = document.createElement("div");
            unknownRow.style.cssText = `
							display: flex; justify-content: space-between; align-items: center;
							padding: 8px 12px; cursor: default;
							background-color: transparent;
						`;
            const uName = document.createElement("span");
            uName.textContent = unknownLocation_Translated;
            uName.style.cssText = `font-size: 14px; font-weight: 500; color: ${isDarkMode ? "#e0e0e0" : "#333333"};`;
            const uCount = document.createElement("span");
            uCount.style.cssText = `
							font-size: 13px; font-weight: 400;
							color: ${isDarkMode ? "#a0a0a0" : "#666666"};
							background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"};
							padding: 2px 6px; border-radius: 4px;
						`;
            unknownRow.append(uName, uCount);
            listContainer.append(unknownHeader, unknownRow);
            cache.unknownHeader = unknownHeader;
            cache.unknownRow = unknownRow;
            cache.unknownCountSpan = uCount;
            listContainer._rsdCache = cache;
          }

          for (const region of regionsData) {
            const entry = cache.items.get(region.code);
            if (!entry) {
              listContainer._rsdCache = null;
              return await regionServersPopulate(listContainer);
            }
            const count = region.count || 0;
            const displayCount = count > 99 ? "99+" : String(count);

            const enabled = count > 0;
            const translation =
              count === 1
                ? serversText_Translated
                : serversText_Plural_Translated;
            entry.countSpan.textContent = translation.replace(
              "SERVER_COUNT",
              displayCount,
            );
            entry.el.dataset.rsdEnabled = enabled ? "1" : "0";
            entry.el.style.opacity = enabled ? "1" : "0.6";
            entry.el.style.cursor = enabled ? "pointer" : "default";
            entry.nameSpan.style.color = enabled
              ? isDarkMode
                ? "#e0e0e0"
                : "#333333"
              : isDarkMode
                ? "#a0a0a0"
                : "#777777";
            entry.countSpan.style.color = enabled
              ? isDarkMode
                ? "#a0a0a0"
                : "#666666"
              : isDarkMode
                ? "#777"
                : "#999";
            try {
              entry.el.removeAttribute("title");
            } catch {}
          }
          if (
            cache.unknownHeader &&
            cache.unknownRow &&
            cache.unknownCountSpan
          ) {
            const show = unknownServerCount > 0;
            cache.unknownHeader.style.display = show ? "block" : "none";
            cache.unknownRow.style.display = show ? "flex" : "none";
            cache.unknownCountSpan.textContent = `${unknownServerCount} server${unknownServerCount !== 1 ? "s" : ""}`;
            try {
              cache.unknownRow.removeAttribute("title");
            } catch {}
          }
        }

        function rsdCancelCloseSidePanel() {
          try {
            return __overlay?.cancelCloseSidePanel?.();
          } catch {}
        }
        function rsdScheduleCloseSidePanel() {
          try {
            return __overlay?.scheduleCloseSidePanel?.();
          } catch {}
        }
        function rsdAnimateSidePanelIn(el) {
          try {
            return __overlay?.animateSidePanelIn?.(el);
          } catch {}
        }
        function rsdAnimateSidePanelOut(el) {
          try {
            return __overlay?.animateSidePanelOut?.(el);
          } catch {
            return Promise.resolve();
          }
        }
        async function rsdOpenRegionSidePanel(regionCode, refreshOnly = false) {
          try {
            return await __overlay?.openRegionSidePanel?.(
              regionCode,
              refreshOnly,
            );
          } catch {}
        }

        const style = document.createElement("style");
        style.textContent = `
                .server-entry {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 15px 20px;
                    margin-bottom: 15px;
                    border-radius: 8px;
                }
                .server-entry.rsd-compact {
                    gap: 6px;
                    padding: 7px 10px;
                    margin-bottom: 6px;
                }
                .server-entry.rsd-compact .profile-pictures-row {
                    flex-wrap: nowrap;
                    overflow: hidden;
                    gap: 3px;
                    min-height: 24px;
                }
                .server-entry.rsd-compact .profile-thumbnail {
                    width: 24px;
                    height: 24px;
                }
                .server-entry.rsd-compact .plus-count {
                    width: 24px;
                    height: 24px;
                    font-size: 11px;
                }
                .server-entry.rsd-compact .player-count-text {
                    font-size: 13px;
                    font-weight: 600;
                    margin-top: 2px;
                }
                .server-entry.rsd-compact .server-button {
                    padding: 6px 12px;
                    font-size: 13px;
                }
                .rsd-compact-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                }

                .server-entry.dark {
                    background-color: rgb(45, 48, 53);
                    color: #e0e0e0;
                }
                .server-entry.light {
                    background-color: #ffffff;
                    color: #333333;
                }
                .profile-pictures-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 34px;
                    align-items: center;
                }
                .profile-thumbnail {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    object-fit: cover;
                    vertical-align: middle;
                    background-color: #555;
                }
                .plus-count {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-size: 14px;
                    font-weight: 600;
                }
                .plus-count.dark {
                    background-color: rgba(255, 255, 255, 0.15);
                    color: #b0b0b0;
                }
                .plus-count.light {
                    background-color: rgba(0, 0, 0, 0.08);
                    color: #555;
                }
                .info-section {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .player-count-text {
                    font-size: 16px;
                    font-weight: 600;
                }
                .player-count-text.dark {
                    color: #d0d0d0;
                }
                .player-count-text.light {
                    color: #444;
                }
                .bottom-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 10px;
                    margin-top: 5px;
                }
                .buttons-container {
                    display: flex;
                    gap: 8px;
                }
                .server-button {
                    border-radius: 6px;
                    padding: 8px 18px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }
                .join-button {
                    background-color: #3975e0;
                    color: white;
                    border: none;
                    transition: background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
                }
.join-button:hover:not(:disabled) {
                    background-color: #5a95ff;
                    box-shadow: 0 0 0 2px rgba(90, 149, 255, 0.35), 0 6px 16px rgba(0,0,0,0.25);
                    transform: none;
                }
                .join-button:active:not(:disabled) {
                    transform: scale(0.99);
                    box-shadow: 0 0 0 2px rgba(90, 149, 255, 0.25), 0 3px 10px rgba(0,0,0,0.22);
                }
                .join-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .join-button:disabled.dark {
                    background-color: #555;
                }
                .join-button:disabled.light {
                    background-color: #ccc;
                }
                .share-button {
                    background-color: rgba(255, 255, 255, 0.1);
                    color: #c0c0c0;
                    border: none;
                }
                .share-button.light {
                    background-color: rgba(0, 0, 0, 0.06);
                    color: #444;
                }
                .server-id-display {
                    text-align: right;
                    font-size: 3px;
                    font-weight: 500;
                    font-family: monospace;
                    overflow: hidden;
                    white-space: nowrap;
                }
                .server-id-display.dark {
                    color: #888;
                }
                .server-id-display.light {
                    color: #777;
                }
.rsd-recent-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 2px;
                    list-style: none;
                }
                .rsd-recent-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                    flex: 1;
                }
                .rsd-recent-gameicon {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    object-fit: cover;
                    flex: 0 0 auto;
                    background-color: rgba(127,127,127,0.25);
                }
                .rsd-recent-gameicon--empty {
                    background-color: rgba(127,127,127,0.25);
                }
                .rsd-recent-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }
                .rsd-recent-gamename {
                    font-size: 13px;
                    font-weight: 600;
                    line-height: 1.1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 220px;
                }
                .rsd-recent-sid {
                    font-size: 12px;
                    opacity: 0.8;
                    word-break: break-all;
                    line-height: 1.1;
                }
                .rsd-recent-ago {
                    font-size: 11px;
                    opacity: 0.7;
                    line-height: 1.1;
                }
                .rsd-recent-join {
                    padding: 6px 10px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 12px;
                }
`;
        document.head.appendChild(style);
        function createServerFetch(
          server,
          thumbnailUrls,
          isDarkMode,
          opts = {},
        ) {
          const serverId = server.id;
          const compact = !!opts.compact;
          const serverEntry = document.createElement("div");
          serverEntry.className = `server-entry ${isDarkMode ? "dark" : "light"}`;
          serverEntry.dataset.serverId = serverId;
          if (compact) serverEntry.classList.add("rsd-compact");
          const profilePicturesRow = document.createElement("div");
          profilePicturesRow.className = "profile-pictures-row";
          const playerTokens = server.playerTokens || [];

          const maxThumbnails = compact ? 5 : 5;

          const playingNum = Number(server.playing);
          const desiredThumbCount =
            typeof opts.thumbCount === "number"
              ? opts.thumbCount
              : Number.isFinite(playingNum)
                ? playingNum
                : playerTokens.length;

          const thumbsToRender = Math.min(desiredThumbCount, maxThumbnails);
          for (let i = 0; i < thumbsToRender; i++) {
            const token = playerTokens[i];
            const profileImg = document.createElement("img");
            profileImg.className = "profile-thumbnail";
            if (token) profileImg.dataset.rsdToken = String(token);
            profileImg.src =
              token && thumbnailUrls[token]
                ? thumbnailUrls[token]
                : `https://tr.rbxcdn.com/53eb9b17fe1432a809c73a13889b5006/150/150/Image/Png`;
            profileImg.alt = `Player ${i + 1}`;
            try {
              profileImg.removeAttribute("title");
            } catch {}
            profilePicturesRow.appendChild(profileImg);
          }
          if (desiredThumbCount > maxThumbnails) {
            const plusCount = document.createElement("div");
            plusCount.className = `plus-count ${isDarkMode ? "dark" : "light"}`;
            plusCount.textContent = `+${desiredThumbCount - maxThumbnails}`;
            try {
              plusCount.removeAttribute("title");
            } catch {}
            profilePicturesRow.appendChild(plusCount);
          } else if (desiredThumbCount === 0 && playerTokens.length === 0) {
            const noPlayersText = document.createElement("div");
            noPlayersText.textContent = noPlayersOnline_Translated;
            noPlayersText.style.cssText = `
			font-size: 13px;
			color: ${isDarkMode ? "#888" : "#777"};
			font-style: italic;
			padding: 0;
			line-height: ${compact ? "24px" : "60px"};
		`;
            profilePicturesRow.appendChild(noPlayersText);
          }
          const joinButton = document.createElement("button");
          joinButton.textContent = joinButton_Translated;
          joinButton.className = `server-button join-button light`;

          const maxPlayersNum = Number(server.maxPlayers);
          joinButton.disabled =
            Number.isFinite(playingNum) && Number.isFinite(maxPlayersNum)
              ? playingNum >= maxPlayersNum
              : false;

          if (joinButton.disabled) {
            joinButton.textContent = "FULL";
            joinButton.style.backgroundColor = "#c62828";
            joinButton.style.color = "#fff";
            joinButton.style.cursor = "not-allowed";
          }
          if (!joinButton.disabled) {
            joinButton.onclick = () => {
              joinSpecificServer(serverId);

              try {
                if (typeof window.__rsdCloseRegionDropdown === "function")
                  window.__rsdCloseRegionDropdown();
              } catch {}
            };
          }
          const infoSection = document.createElement("div");
          infoSection.className = "info-section";
          const playerCountText = document.createElement("div");
          playerCountText.className = `player-count-text ${isDarkMode ? "dark" : "light"}`;
          playerCountText.textContent = (playerCount_Translated || "PLAYING_COUNT / MAX_PLAYERS players")
            .replace("PLAYING_COUNT", String(server.playing || 0))
            .replace("MAX_PLAYERS", String(server.maxPlayers || "?"));

          infoSection.appendChild(playerCountText);
          if (compact) {
            const topRow = document.createElement("div");
            topRow.className = "rsd-compact-top";
            topRow.appendChild(profilePicturesRow);
            const buttonsContainer = document.createElement("div");
            buttonsContainer.className = "buttons-container";
            buttonsContainer.append(joinButton);
            topRow.appendChild(buttonsContainer);
            serverEntry.appendChild(topRow);
            serverEntry.appendChild(infoSection);
          } else {
            serverEntry.appendChild(profilePicturesRow);
            serverEntry.appendChild(infoSection);
            const bottomRow = document.createElement("div");
            bottomRow.className = "bottom-row";
            const buttonsContainer = document.createElement("div");
            buttonsContainer.className = "buttons-container";
            buttonsContainer.append(joinButton);
            bottomRow.append(buttonsContainer);
            serverEntry.appendChild(bottomRow);
          }
          return serverEntry;
        }

        (async () => {
          await applyTheme();
          if (!regionSelectorEnabled) {
            return;
          }
          if (!placeId) {
            return;
          }
          let waitCount = 0;
          while (serverIpMap === null && waitCount < 25) {
            await delay(200);
            waitCount++;
          }
          if (serverIpMap === null) {
            serverIpMap = {};
          } else {
          }
          await updateDetailsServers();
          await getServerInfo(placeId, defaultRegions, true);
        })();
      }
    } else {
    }
  })(settings);
  }

  try {
    globalThis.RSD = globalThis.RSD || {};
    globalThis.RSD.region_panel = globalThis.RSD.region_panel || {};
    globalThis.RSD.region_panel.initRegionPanel = initRegionPanel;
    globalThis.RSD.initRegionPanel = initRegionPanel;
  } catch {}
})();
