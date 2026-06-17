(() => {
  const rsdWarnOnce = globalThis.RSDDebug?.warnOnce || (() => {});


globalThis.RSD = globalThis.RSD || {};
  function createJoin(env) {
    const S = env.state;
    const F = env.fns;
    const C = env.constants;
    const RSD_RECENT_KEY = "RSD_RECENT_JOINS_v1";
    const RSD_RECENT_MAX = 5;
    function storageAvailable() {
      try {
        return !!(chrome && chrome.storage && chrome.storage.local);
      } catch {
        return false;
      }
    }
    function getGameMeta() {
      try {
        let name = "";
        let icon = "";
        const ogTitle =
          document.querySelector('meta[property="og:title"]')?.content || "";
        const ogImage =
          document.querySelector('meta[property="og:image"]')?.content || "";
        if (ogTitle)
          name = String(ogTitle).replace(/\s*-\s*Roblox\s*$/i, "").trim();
        if (!name) {
          const t = document.title || "";
          name = String(t).replace(/\s*-\s*Roblox\s*$/i, "").trim();
        }
        if (ogImage) icon = String(ogImage).trim();
        return { gameName: name || "", gameIconUrl: icon || "" };
      } catch {
        return { gameName: "", gameIconUrl: "" };
      }
    }
    function recordRecentJoin(placeId, serverId) {
      try {
        const pid = String(placeId || "").trim();
        const sid = String(serverId || "").trim();
        if (!pid || !sid) return;
        const meta = getGameMeta();
        const now = Date.now();

        if (storageAvailable()) {
          chrome.storage.local.get([RSD_RECENT_KEY], (res) => {
            try {
              let arr = Array.isArray(res?.[RSD_RECENT_KEY])
                ? res[RSD_RECENT_KEY]
                : [];
              arr = arr.filter(
                (x) =>
                  !(
                    x &&
                    String(x.placeId) === pid &&
                    String(x.serverId) === sid
                  ),
              );
              arr.unshift({
                placeId: pid,
                serverId: sid,
                ts: now,
                gameName: meta.gameName || "",
                gameIconUrl: meta.gameIconUrl || "",
              });
              if (arr.length > RSD_RECENT_MAX) arr = arr.slice(0, RSD_RECENT_MAX);
              chrome.storage.local.set({ [RSD_RECENT_KEY]: arr }, () => {
                try {
                  window.dispatchEvent(new CustomEvent("rsd:recentChanged"));
                } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:83", error); }
              });
            } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:85", error); }
          });
          return;
        }
        try {
          const raw = localStorage.getItem(RSD_RECENT_KEY);
          let arr = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(arr)) arr = [];
          arr = arr.filter(
            (x) =>
              !(x && String(x.placeId) === pid && String(x.serverId) === sid),
          );
          arr.unshift({
            placeId: pid,
            serverId: sid,
            ts: now,
            gameName: meta.gameName || "",
            gameIconUrl: meta.gameIconUrl || "",
          });
          if (arr.length > RSD_RECENT_MAX) arr = arr.slice(0, RSD_RECENT_MAX);
          localStorage.setItem(RSD_RECENT_KEY, JSON.stringify(arr));
          try {
            window.dispatchEvent(new CustomEvent("rsd:recentChanged"));
          } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:108", error); }
        } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:109", error); }
      } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:110", error); }
    }

    async function joinSpecificRegion(region) {
      try {
        if (typeof F.openSidePanelIfEnabled === "function") {
          const didOpen = F.openSidePanelIfEnabled(region);
          if (didOpen) return;
        }

        const regionNorm =
          typeof normalizeRegionCode === "function"
            ? normalizeRegionCode(region)
            : region;
        const servers = Array.isArray(S.allRobloxServers)
          ? S.allRobloxServers
          : [];
        const target = servers.find((s) => {
          const rc = S.robloxServerPlaces?.[s.id]?.c;
          const rcn =
            typeof normalizeRegionCode === "function"
              ? normalizeRegionCode(rc)
              : rc;
          return rcn && rcn !== C.UNKNOWN_REGION && rcn === regionNorm;
        });
        if (target) {
          joinSpecificServer(target.id);
        }
      } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:138", error); }
    }

    function joinSpecificServer(serverId) {
      try {
        const placeId = S.placeId;
        if (!placeId || !serverId) return;
        try {
          recordRecentJoin(placeId, serverId);
        } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:147", error); }

        chrome.runtime.sendMessage(
          {
            action: "joinGameInstance",
            placeId: String(placeId),
            serverId: String(serverId),
          },
          () => {},
        );
      } catch (error) { rsdWarnOnce("src/content/page/modules/join.js:157", error); }
    }

    return { joinSpecificRegion, joinSpecificServer };
  }

  function initJoin(ctx) {
    ctx.join = ctx.join || {};
  }

  globalThis.RSD.createJoin = createJoin;
  globalThis.RSD.initJoin = initJoin;
})();
