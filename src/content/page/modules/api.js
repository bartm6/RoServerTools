/**
 * File: api.js
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

  function createApi(env) {
    const S = env.state;
    const C = env.constants;
    const F = env.fns;

    const log = (() => {
      try {
        return (globalThis.RSD?.utils?.createLogger || ((s) => console))("api");
      } catch {
        return console;
      }
    })();

    function dbg(...args) {
      try {
        if (typeof globalThis.RSD?.utils?.getDebugEnabled === "function") {
          if (!globalThis.RSD.utils.getDebugEnabled()) return;
        } else if (typeof globalThis.RSD?.getDebugEnabled === "function") {
          if (!globalThis.RSD.getDebugEnabled()) return;
        }
      } catch {
        return;
      }
      try {
        (log.debug || console.debug).call(log, "[RSD]", ...args);
      } catch {}
    }

    function fetchJoinInfoViaBackground(placeId, serverId) {
      return new Promise((resolve, reject) => {
        try {
          (async () => {
            try {
          if (!chrome?.runtime?.sendMessage)
            return reject(new Error("Background messaging unavailable"));
          chrome.runtime.sendMessage(
            { action: "fetchJoinInfo", placeId: String(placeId), serverId: String(serverId) },
            (resp) => {
              const err = chrome.runtime.lastError;
              if (err) return reject(new Error(err.message));
              if (!resp || typeof resp !== "object")
                return reject(new Error("Invalid join-info response"));
              if (resp.success) return resolve(resp.data);
              const e = new Error(resp.error || "join-info failed");
              e.status = resp.status;
              return reject(e);
            },
          );
            } catch (e) {
              reject(e);
            }
          })();
        } catch (e) {
          reject(e);
        }
      });
    }

    function rsdParseLatLonFromSessionId(sessionId) {
      if (!sessionId || typeof sessionId !== "string") return null;
      try {
        const sessionData = JSON.parse(sessionId);
        const latitude = sessionData?.Latitude;
        const longitude = sessionData?.Longitude;
        if (typeof latitude === "number" && typeof longitude === "number") {
          return { latitude, longitude };
        }
      } catch {
      }
      return null;
    }

    function rsdGetIpSubnetFromJoinInfo(serverInfo) {
      const addr = serverInfo?.joinScript?.UdmuxEndpoints?.[0]?.Address;
      if (!addr || typeof addr !== "string") return null;
      return addr.split(".").slice(0, 3).join(".") + ".0";
    }

    function rsdNormalizeRegionCodeSafe(code) {
      return typeof normalizeRegionCode === "function"
        ? normalizeRegionCode(code)
        : code;
    }

    function rsdComputeRegionFromLocation(serverLocationData) {
      if (!serverLocationData) return { regionCode: "??", lat: null, lon: null };

      const countryCode = rsdNormalizeRegionCodeSafe(serverLocationData?.country?.code);
      const lat = serverLocationData?.latitude;
      const lon = serverLocationData?.longitude;

      if (countryCode === "US" && serverLocationData.region?.code) {
        const stateCode = String(serverLocationData.region.code).replace(/-\d+$/, "");
        return { regionCode: `US-${stateCode}`, lat, lon };
      }
      if (countryCode) return { regionCode: countryCode, lat, lon };
      return { regionCode: "??", lat, lon };
    }

    async function handleServer(server, placeId, targetRegions, specificRegion = null) {
      if (!server || !server.id) return null;
      const serverId = server.id;
      function maybeAddToRegionList(regionCode) {
        try {
          if (!regionCode || regionCode === "??") return;
          S.regionSpecificServers = S.regionSpecificServers || {};
          S.regionServerCounting = S.regionServerCounting || {};
          if (!S.regionSpecificServers[regionCode]) S.regionSpecificServers[regionCode] = [];
          if (!S.regionSpecificServers[regionCode].some((s) => s.id === serverId)) {
            S.regionSpecificServers[regionCode].push(server);
          }
          S.regionServerCounting[regionCode] = S.regionSpecificServers[regionCode].length;
          // Update any open region server list immediately, so newly found servers
          // appear one-by-one instead of all at once after the batch completes.
          try {
            if (typeof F?.notifyRegionServerFound === "function") {
              F.notifyRegionServerFound(regionCode, server);
            }
          } catch (_) {}
          F.scheduleUiUpdate();
        } catch (e) {
          dbg("maybeAddToRegionList failed", e);
        }
      }
      if (S.robloxServerPlaces[serverId]) {
              const cachedData = S.robloxServerPlaces[serverId];
              const cachedRegionCode = cachedData.c;
              if (cachedRegionCode) {
                if (cachedRegionCode !== "??") {
                  maybeAddToRegionList(cachedRegionCode);

                  if (specificRegion && cachedRegionCode === specificRegion) {
                    maybeAddToRegionList(specificRegion);
                  }
                }
                return cachedRegionCode;
              }
            }

      S.activeRequests++;
      let regionCode = null;
      let serverLat = null;
      let serverLon = null;

      try {
        let serverInfo;
        try {
          serverInfo = await fetchJoinInfoViaBackground(placeId, serverId);
        } catch (e) {
          if (e?.status === 429) {
            S.rateLimited = true;
            try {
              if (typeof F.handleRateLimitedState === "function") {
                F.handleRateLimitedState(true);
              }
            } catch (err) {
              dbg("handleRateLimitedState(true) failed", err);
            }
            S.nextPageAllowedAt = Date.now() + 800 + Math.random() * 700;
          }
          throw e;
        }

        try {
          const loc = rsdParseLatLonFromSessionId(
            serverInfo?.joinScript?.SessionId,
          );
          if (
            loc &&
            (!S.robloxProfileUserLocation ||
              S.robloxProfileUserLocation.latitude !== loc.latitude ||
              S.robloxProfileUserLocation.longitude !== loc.longitude)
          ) {
            S.robloxProfileUserLocation = loc;
          }
        } catch (err) {
          dbg("rsdParseLatLonFromSessionId failed", err);
        }

        const ip = rsdGetIpSubnetFromJoinInfo(serverInfo);
        if (!ip) {
          S.robloxServerPlaces[serverId] = { c: "??", l: null };
          return null;
        }

        const serverLocationData = S.serverIpMap ? S.serverIpMap[ip] : null;
        const computed = rsdComputeRegionFromLocation(serverLocationData);
        regionCode = computed.regionCode;
        serverLat = computed.lat;
        serverLon = computed.lon;

        S.robloxServerPlaces[serverId] = {
          c: regionCode,
          l:
            typeof serverLat === "number" && typeof serverLon === "number"
              ? { latitude: serverLat, longitude: serverLon }
              : null,
        };
        if (regionCode && regionCode !== "??") {
          if (!S.regionReplacedMap[regionCode]) S.regionReplacedMap[regionCode] = server;
          maybeAddToRegionList(regionCode);
        }

        return regionCode;
      } catch (err) {
        dbg("handleServer failed", err);
        S.robloxServerPlaces[serverId] = { c: "??", l: null };
        return null;
      } finally {
        S.activeRequests--;
      }
    }

    async function getServerInfo(placeId, regions, initialCall = true, cursor = null, specificRegion = null) {
      const MAX_RETRIES = 5;
      const INITIAL_BACKOFF_MS = 2000;
      const BACKOFF_FACTOR = 2;
      const startedAsInitialCall = !!initialCall;

      if (!env.flags.getRegionSelectorEnabled()) return;
      if (S.checkForRefreshingCount && initialCall) return;

      let success = false;

      if (startedAsInitialCall) {
        S.checkForRefreshingCount = true;
        S.rateLimited = false;
        F.handleRateLimitedState(false);
      }

      try {
        if (startedAsInitialCall) {
          if (!specificRegion) {
            S.allRobloxServers = [];
            S.regionServerCounting = {};
            S.robloxServerPlaces = {};
            S.regionSpecificServers = {};
            S.nextPageCursor = null;
          } else {
            S.regionSpecificServers[specificRegion] = [];
            S.regionServerCounting[specificRegion] = 0;
          }
        }
        F.updateDetailsServers().catch(() => {});
        let nextCursor = cursor;
        while (true) {
          let attempt = 0;
          let currentBackoff = INITIAL_BACKOFF_MS;
          let pageOk = false;
          let servers = null;

          while (attempt <= MAX_RETRIES) {
            attempt++;
            let response = null;
            try {
              let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?excludeFullGames=true&limit=100&sortOrder=Asc`;
              if (nextCursor) url += `&cursor=${nextCursor}`;
              response = await fetch(url, {
                headers: { Accept: "application/json" },
                credentials: "include",
              });

              if (response.ok) {
                S.rateLimited = false;
                F.handleRateLimitedState(false);
                servers = await response.json();
                pageOk = true;
                break;
              }

              if (response.status === 429) {
                S.rateLimited = true;
                F.handleRateLimitedState(true);
                S.nextPageAllowedAt = Date.now() + 500 + Math.random() * 500;
                if (attempt > MAX_RETRIES) break;
                await new Promise((resolve) => setTimeout(resolve, currentBackoff));
                currentBackoff *= BACKOFF_FACTOR;
                continue;
              }

              if (response.status === 401 || response.status === 403) {
                pageOk = false;
                break;
              }

              pageOk = false;
              break;
            } catch (e) {
              dbg("getServerInfo page fetch failed", e);
              pageOk = false;
              break;
            }
          }

          if (!pageOk || !servers) {
            success = false;
            break;
          }

          const currentPageCursor = servers.nextPageCursor;

          if (!servers.data || servers.data.length === 0) {
            if (initialCall && !specificRegion) S.allRobloxServers = [];
          } else {
            const currentBatchServers = servers.data;
            currentBatchServers.forEach((server) => {
              server._uniqueId =
                Date.now() + "_" + Math.random().toString(36).slice(2, 11);
            });

            if (initialCall && !specificRegion && !nextCursor) {
              S.allRobloxServers = currentBatchServers;
            } else {
              const existingIds = new Set(S.allRobloxServers.map((s) => s.id));
              const newServers = currentBatchServers.filter((s) => !existingIds.has(s.id));
              S.allRobloxServers = [...S.allRobloxServers, ...newServers];
            }

            await F.mapLimit(
              currentBatchServers,
              C.MAX_CONCURRENT_JOININFO,
              (server) => handleServer(server, placeId, regions, specificRegion).catch(() => null),
            );
          }

          success = true;

          if (!currentPageCursor) break;
          const now = Date.now();
          const until = S.nextPageAllowedAt || 0;
          const waitMs = Math.max(0, until - now);
          if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
          nextCursor = currentPageCursor;
          initialCall = false;
        }

        if (specificRegion) {
          F.updateRegionSpecificCache(specificRegion);
        } else {
          Object.keys(S.regionServerCounting).forEach((region) =>
            F.updateRegionSpecificCache(region),
          );
        }
      } catch (e) {
        dbg("getServerInfo failed", e);
        success = false;
      } finally {
        if (startedAsInitialCall) {
          S.checkForRefreshingCount = false;
          F.handleRateLimitedState(S.rateLimited);
          await F.updateDetailsServers();
          try {
            if (!specificRegion && typeof F.rsdCheckFriendsInServers === "function") {
              await F.rsdCheckFriendsInServers(true);
            }
          } catch (err) {
            dbg("rsdCheckFriendsInServers failed", err);
          }
        } else if (!success) {
          F.handleRateLimitedState(S.rateLimited);
        }
      }
    }

    return { handleServer, getServerInfo };
  }

  function initApi(ctx) {
    ctx.api = ctx.api || {};
  }

  globalThis.RSD.createApi = createApi;
  globalThis.RSD.initApi = initApi;
})();
