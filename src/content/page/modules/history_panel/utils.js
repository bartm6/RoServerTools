(() => {
  const rsdWarnOnce = globalThis.RSDDebug?.warnOnce || (() => {});


globalThis.RSD = globalThis.RSD || {};
  RSD.history_panel = RSD.history_panel || {};
  RSD.history_panel.utils = RSD.history_panel.utils || {};
  const RSD_RECENT_KEY = "RSD_RECENT_JOINS_v1";
  const RSD_RECENT_MAX = 5;

  function storageAvailable() {
    try {
      return !!(chrome && chrome.storage && chrome.storage.local);
    } catch {
      return false;
    }
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        if (storageAvailable()) {
          chrome.storage.local.get([key], (res) => {
            try {
              resolve(res ? res[key] : undefined);
            } catch {
              resolve(undefined);
            }
          });
          return;
        }
      } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:43", error); }
      try {
        resolve(localStorage.getItem(key));
      } catch {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try {
        if (storageAvailable()) {
          chrome.storage.local.set({ [key]: value }, () => resolve(true));
          return;
        }
      } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:59", error); }
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:62", error); }
      resolve(true);
    });
  }

  function getCurrentGameMeta() {
    try {
      let name = "";
      let icon = "";
      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.content || "";
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.content || "";
      if (ogTitle) name = String(ogTitle).replace(/\s*-\s*Roblox\s*$/i, "").trim();
      if (!name) {
        const t = document.title || "";
        name = String(t).replace(/\s*-\s*Roblox\s*$/i, "").trim();
      }
      if (ogImage) icon = String(ogImage).trim();
      if (!icon) {
        const imgEl =
          document.querySelector('img[alt*="Game"]') ||
          document.querySelector('img[alt*="game"]') ||
          document.querySelector('img[src*="rbxcdn.com"]');
        const src = imgEl?.getAttribute?.("src") || imgEl?.src || "";
        if (src) icon = String(src).trim();
      }

      return { gameName: name || "", gameIconUrl: icon || "" };
    } catch {
      return { gameName: "", gameIconUrl: "" };
    }
  }

  async function loadRecentJoins() {
    try {
      const raw = await storageGet(RSD_RECENT_KEY);
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async function saveRecentJoins(arr) {
    try {
      await storageSet(RSD_RECENT_KEY, Array.isArray(arr) ? arr : []);
    } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:113", error); }
  }

  function formatTimeAgo(ts) {
    try {
      const d = Math.max(0, Date.now() - Number(ts || 0));
      const s = Math.floor(d / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  }

  async function getRecentAll() {
    try {
      const all = await loadRecentJoins();
      return (all || [])
        .filter((x) => x && x.serverId && x.placeId)
        .slice(0, RSD_RECENT_MAX);
    } catch {
      return [];
    }
  }
  async function recordRecentJoin(placeId, serverId, metaOverride = null) {
    try {
      const sid = String(serverId || "").trim();
      const pid = String(placeId || "").trim();
      if (!sid || !pid) return;

      const now = Date.now();
      let arr = await loadRecentJoins();
      arr = (arr || []).filter(
        (x) => !(x && String(x.placeId) === pid && String(x.serverId) === sid),
      );

      const meta =
        metaOverride && typeof metaOverride === "object"
          ? metaOverride
          : getCurrentGameMeta();

      arr.unshift({
        placeId: pid,
        serverId: sid,
        ts: now,
        gameName: String(meta?.gameName || ""),
        gameIconUrl: String(meta?.gameIconUrl || ""),
      });

      if (arr.length > RSD_RECENT_MAX) arr = arr.slice(0, RSD_RECENT_MAX);
      await saveRecentJoins(arr);
      try {
        window.dispatchEvent(new CustomEvent("rsd:recentChanged"));
      } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:171", error); }
    } catch (error) { rsdWarnOnce("src/content/page/modules/history_panel/utils.js:172", error); }
  }

  RSD.history_panel.utils.RSD_RECENT_KEY = RSD_RECENT_KEY;
  RSD.history_panel.utils.RSD_RECENT_MAX = RSD_RECENT_MAX;
  RSD.history_panel.utils.storageAvailable = storageAvailable;
  RSD.history_panel.utils.storageGet = storageGet;
  RSD.history_panel.utils.storageSet = storageSet;
  RSD.history_panel.utils.getCurrentGameMeta = getCurrentGameMeta;
  RSD.history_panel.utils.loadRecentJoins = loadRecentJoins;
  RSD.history_panel.utils.saveRecentJoins = saveRecentJoins;
  RSD.history_panel.utils.getRecentAll = getRecentAll;
  RSD.history_panel.utils.formatTimeAgo = formatTimeAgo;
  RSD.history_panel.utils.recordRecentJoin = recordRecentJoin;
  RSD.history_panel.recordRecentJoin = recordRecentJoin;
})();
