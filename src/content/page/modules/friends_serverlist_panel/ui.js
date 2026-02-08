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
  globalThis.RSD = globalThis.RSD || {};

  RSD.friends_serverlist_panel = RSD.friends_serverlist_panel || {};

  RSD.friends_serverlist_panel.createFriendsServerlistPanel = function createFriendsServerlistPanel({
    state,
    fns,
    overlay,
  }) {
    const delay = fns?.delay || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const escapeHtml =
      (fns && fns.escapeHtml) ||
      (globalThis.RSD &&
        globalThis.RSD.utils &&
        globalThis.RSD.utils.escapeHtml) ||
      ((s) => String(s));
let rsdCachedJoinButtonSize = null;
function rsdGetStandardJoinButtonSize(joinBtn) {
  try {
    if (rsdCachedJoinButtonSize) return rsdCachedJoinButtonSize;

    const className = joinBtn?.className || "server-button join-button light";
    const probeWrap = document.createElement("div");
    probeWrap.style.position = "fixed";
    probeWrap.style.left = "-10000px";
    probeWrap.style.top = "-10000px";
    probeWrap.style.visibility = "hidden";
    probeWrap.style.pointerEvents = "none";

    const probeBtn = document.createElement("button");
    probeBtn.className = className;
    probeBtn.textContent = "Join";
    probeBtn.style.flex = "0 0 auto";
    probeBtn.style.width = "auto";

    probeWrap.appendChild(probeBtn);
    document.body.appendChild(probeWrap);

    const rect = probeBtn.getBoundingClientRect();
    rsdCachedJoinButtonSize = { width: rect.width, height: rect.height };

    probeWrap.remove();
    return rsdCachedJoinButtonSize;
  } catch {
    return null;
  }
}

    function getCurrentTheme() {
      try {
        return state?.currentTheme ?? state?.getCurrentTheme?.() ?? "light";
      } catch {
        return "light";
      }
    }

    function rsdCancelCloseSidePanel() {
      try {
        overlay?.cancelCloseSidePanel?.();
      } catch {}
    }
    function rsdScheduleCloseSidePanel() {
      try {
        overlay?.scheduleCloseSidePanel?.();
      } catch {}
    }
    function rsdAnimateSidePanelOut(el) {
      try {
        return overlay?.animateSidePanelOut?.(el);
      } catch {
        return Promise.resolve();
      }
    }
    function rsdAnimateSidePanelIn(el) {
      try {
        overlay?.animateSidePanelIn?.(el);
      } catch {}
    }

    const placeId = state?.placeId;
    const defaultRegions =
      state?.defaultRegions || globalThis.defaultRegions || [];

    const getAllRobloxServers = () =>
      Array.isArray(state?.allRobloxServers)
        ? state.allRobloxServers
        : Array.isArray(globalThis.allRobloxServers)
          ? globalThis.allRobloxServers
          : [];
    const getRobloxServerPlaces = () =>
      state?.robloxServerPlaces || globalThis.robloxServerPlaces || {};
    function getServerInfo(...args) {
      if (fns?.getServerInfo) return fns.getServerInfo(...args);
      if (state?.getServerInfo) return state.getServerInfo(...args);
      return undefined;
    }
    function joinSpecificServer(serverId) {
      try {
        const sid = String(serverId || "");
        if (sid.startsWith("dom:")) {
          try {
            const m = rsdFriendsCache?.meta?.get?.(sid);
            const btn = m?.joinBtn;
            if (btn && typeof btn.click === "function") {
              btn.click();
              return;
            }
          } catch {}
        }
        if (fns?.joinSpecificServer) return fns.joinSpecificServer(serverId);
      } catch {}
    }

    const createServerFetch =
      typeof fns?.createServerFetch === "function"
        ? fns.createServerFetch
        : typeof state?.createServerFetch === "function"
          ? state.createServerFetch
          : null;
    async function fetchThumbnailAssets(tokens) {
      try {
        if (typeof fns?.fetchThumbnailAssets === "function") {
          return (await fns.fetchThumbnailAssets(tokens)) || {};
        }
        if (typeof globalThis.fetchThumbnailAssets === "function") {
          return (await globalThis.fetchThumbnailAssets(tokens)) || {};
        }
      } catch {
      }

      if (!Array.isArray(tokens) || tokens.length === 0) return {};

      const delay = fns?.delay || ((ms) => new Promise((r) => setTimeout(r, ms)));
      const baseUrl = "https://thumbnails.roblox.com/v1/batch";
      const batchSize = 100;
      const thumbnailMap = {};
      const all = [];
      let warned = false;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const tokenBatch = tokens.slice(i, i + batchSize).filter(Boolean);
        if (!tokenBatch.length) continue;

        const requests = tokenBatch.map((token) => ({
          requestId: `${token}::AvatarHeadshot:48x48:webp:friends`,
          type: "AvatarHeadShot",
          targetId: 0,
          token,
          format: "webp",
          size: "48x48",
        }));

        const doFetch = async () => {
          const res = await fetch(baseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(requests),
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) return { data: [] };
          return await res.json();
        };

        all.push(
          (async () => {
            try {
              let data;
              try {
                data = await doFetch();
              } catch {
                await delay(150);
                data = await doFetch();
              }
              for (const d of data?.data || []) {
                const token = d.requestId?.split("::")?.[0];
                if (!token) continue;
                thumbnailMap[token] =
                  d.state === "Completed" && d.imageUrl ? d.imageUrl : null;
              }
            } catch (e) {
              if (!warned) {
                warned = true;
                try {
                  const dbg = globalThis.RSD?.utils?.getDebugEnabled?.() === true;
                  if (dbg) {
                    console.warn(
                      "roservertools: friends panel thumbnail batch fetch failed.",
                      e,
                    );
                  }
                } catch {}

              }
            }
          })(),
        );

        if (i + batchSize < tokens.length) await delay(150);
      }

      await Promise.all(all);
      return thumbnailMap;
    }
    const RSD_SERVER_LOOKUP_CACHE_MS = 2 * 60 * 1000;
    const rsdServerLookupCache = new Map();

    async function rsdLookupPublicServerById(placeId, serverId) {
      try {
        placeId = String(placeId || "");
        serverId = String(serverId || "");
        if (!placeId || !serverId || serverId.startsWith("private:")) return null;

        const key = `${placeId}:${serverId}`;
        const cached = rsdServerLookupCache.get(key);
        const now = Date.now();
        if (cached && now - cached.ts < RSD_SERVER_LOOKUP_CACHE_MS) return cached.server;

        let cursor = "";
        let backoff = 500;
        const maxPages = 20;

        for (let page = 0; page < maxPages; page++) {
          const url =
            `https://games.roblox.com/v1/games/${encodeURIComponent(placeId)}/servers/Public` +
            `?excludeFullGames=false&limit=100&sortOrder=Asc&cursor=${encodeURIComponent(cursor)}`;

          const resp = await fetch(url, { credentials: "include" });

          if (resp.status === 429) {
            const ra = Number(resp.headers.get("retry-after"));
            const wait = Math.max(backoff, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0);
            await delay(wait + Math.random() * 250);
            backoff = Math.min(backoff * 2, 8000);
            continue;
          }

          if (!resp.ok) break;

          const json = await resp.json().catch(() => null);
          const data = Array.isArray(json?.data) ? json.data : [];
          const found = data.find((s) => String(s?.id) === serverId);
          if (found) {
            rsdServerLookupCache.set(key, { ts: now, server: found });
            return found;
          }

          cursor = json?.nextPageCursor || "";
          if (!cursor) break;
          await delay(120 + Math.random() * 120);
        }

        rsdServerLookupCache.set(key, { ts: now, server: null });
        return null;
      } catch {
        return null;
      }
    }

    const getThumbnailCache = () => {
      try {
        if (typeof fns?.getThumbnailCache === "function") return fns.getThumbnailCache();
        if (typeof globalThis.getThumbnailCache === "function") return globalThis.getThumbnailCache();
      } catch {}
      return (globalThis.__rsdThumbCache ||= new Map());
    };

    let rsdFriendsCache = { ts: 0, totalFriends: 0, servers: null, otherGames: null, source: null, meta: null };

    let rsdLastDomStateFast = null;
    let rsdPresenceAugmentInFlight = false;
		let rsdFriendsDeferredRerenderTimer = null;
		function rsdClearFriendsSpinner(listEl) {
			try {
				if (!listEl) return;
				const spinners = listEl.querySelectorAll?.(".rsd-sidepanel-spinner") || [];
				for (const s of spinners) {
					try { s.remove(); } catch { try { s.style.display = "none"; } catch {} }
				}
			} catch {}
		}
		function rsdIsFriendsPanelInteracting() {
			try {
				const panel = document.getElementById("rsd-friends-sidepanel");
				if (!panel) return false;
				if (!panel.matches(":hover")) return false;
				return !!panel.querySelector(
					":hover button, :hover a, :hover [role='button'], :hover input, :hover select, :hover textarea, :hover .server-entry",
				);
			} catch {
				return false;
			}
		}

    const RSD_FRIENDS_CACHE_MS = 60 * 1000;
    const RSD_MODEL_FRIENDS_BUTTON = "RSD_MODEL_FRIENDS_BUTTON";
    const FO_UTILS = (globalThis.RSD && globalThis.RSD.friends_serverlist_panel && globalThis.RSD.friends_serverlist_panel.utils) || {};
    const rsdFormatFriendsBadge = FO_UTILS.formatFriendsBadge || ((count)=> (count>5?"5+": String(count||"")));
    const rsdRenderFriendsButtonIcon = FO_UTILS.renderFriendsButtonIcon || (()=>" ");
    const rsdParsePlayersTextToCounts = FO_UTILS.parsePlayersTextToCounts || ((t)=>({playing:"?",maxPlayers:"?"}));

    const rsdGetFriendsIconUrl = FO_UTILS.getFriendsIconUrl || (() => "");

    function rsdSetFriendsButtonIcon(btn, totalFriendsCount) {
      let wrap = btn.querySelector(".rsd-friends-iconwrap");
      let img = btn.querySelector(".rsd-friends-icon");
      let badgeEl = btn.querySelector(".rsd-friends-badge");

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

      if (!img) {
        const iconUrl = rsdGetFriendsIconUrl();
        if (iconUrl) {
          img = document.createElement("img");
          img.className = "rsd-friends-icon";
          img.src = iconUrl;
          img.alt = "Friends";
          wrap.appendChild(img);
        }
      }

      const badge = rsdFormatFriendsBadge(totalFriendsCount);
      if (badge) {
        if (!badgeEl) {
          badgeEl = document.createElement("span");
          badgeEl.className = "rsd-friends-badge";
          wrap.appendChild(badgeEl);
        }
        badgeEl.textContent = badge;
      } else if (badgeEl) {
        badgeEl.remove();
      }
    }

    function rsdMergeDomStateIntoCache(domState) {
      try {
        const prev = rsdFriendsCache || {};
        const now = Date.now();
        const next = { ...prev };

        next.ts = now;
        next.servers = domState.servers;
        next.meta = domState.meta;
        next.thisGameFriends = domState.totalFriends;

        const prevHadPresence = !!(prev.otherGames || (typeof prev.source === "string" && prev.source.indexOf("presence") !== -1));
        if (!prevHadPresence) {
          next.totalFriends = domState.totalFriends;
          next.otherGames = null;
          next.source = "dom";
        } else {
          next.totalFriends =
            typeof prev.totalFriends === "number"
              ? prev.totalFriends
              : Math.max(domState.totalFriends || 0, 0);
          next.source = "dom+presence";
        }
        return next;
      } catch {
        return rsdFriendsCache;
      }
    }

function rsdReadFriendsFromRobloxModule() {
      try {
        const root = document.getElementById("rbx-friends-running-games");
        const list = document.getElementById(
          "rbx-friends-game-server-item-container",
        );
        if (!root || !list) return null;
        const items = Array.from(
          list.querySelectorAll("li.rbx-friends-game-server-item"),
        );
        if (!items.length) return null;

        const servers = new Map();
        const meta = new Map();
        const rsdExtractServerId = (joinBtn, li) => {
          if (!joinBtn && !li) return null;
          const el = joinBtn || li;

          const attrCandidates = [
            "data-btr-instance-id",
            "data-btrinstanceid",
            "data-game-id",
            "data-gameid",
            "data-game-instance-id",
            "data-gameinstanceid",
            "data-instance-id",
            "data-instanceid",
            "data-server-id",
            "data-serverid",
            "data-id",
          ];
          for (const a of attrCandidates) {
            const v = el.getAttribute ? el.getAttribute(a) : null;
            if (v) return String(v);
          }

          const ds = joinBtn?.dataset || li?.dataset || {};
          const dsCandidates = [
            "btrInstanceId",
            "gameId",
            "gameid",
            "gameInstanceId",
            "instanceId",
            "serverId",
            "id",
          ];
          for (const k of dsCandidates) {
            if (ds && ds[k]) return String(ds[k]);
          }

          const hay = [
            joinBtn?.getAttribute?.("onclick") || "",
            joinBtn?.getAttribute?.("data-join-script") || "",
            joinBtn?.outerHTML || "",
            li?.outerHTML || "",
          ].join(" ");

          const m = hay.match(
            /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
          );
          return m ? String(m[0]) : null;
        };
        const rsdExtractAvatarUrls = (li) => {
          const urls = [];
          const container =
            li.querySelector(".player-thumbnails-container") || li;

          try {
            const imgEls = Array.from(container.querySelectorAll("img"));
            for (const img of imgEls) {
              let src =
                img.getAttribute("src") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-delaysrc") ||
                img.getAttribute("data-lazy-src") ||
                img.src ||
                "";
              if (!src) {
                const srcset = img.getAttribute("srcset") || "";
                if (srcset)
                  src = srcset.split(",")[0]?.trim()?.split(" ")[0] || "";
              }
              if (src) urls.push(String(src));
            }
          } catch {}

          try {
            const selector =
              '[style*="background"], .player-thumbnail, .thumbnail-2d, .avatar-card, .avatar, span, div';
            const els = Array.from(container.querySelectorAll(selector));
            for (const el of els) {
              const bgInline = el?.style?.backgroundImage || "";
              const bgComputed =
                typeof getComputedStyle === "function"
                  ? getComputedStyle(el).backgroundImage || ""
                  : "";
              for (const bg of [bgInline, bgComputed]) {
                if (!bg || bg === "none") continue;
                const mm = String(bg).match(/url\(["']?(.*?)["']?\)/i);
                if (mm && mm[1]) urls.push(String(mm[1]));
              }
            }
          } catch {
}
          return Array.from(
            new Set(urls.filter((u) => !!u && !String(u).startsWith("data:"))),
          );
        };
        for (const li of items) {
          const joinBtn = li.querySelector(
            "button.rbx-friends-game-server-join.game-server-join-btn",
          );
          const extractedServerId = rsdExtractServerId(joinBtn, li);
          const statusText =
            li.querySelector('.rbx-friends-game-server-status')?.textContent ||
            '';
          const counts = rsdParsePlayersTextToCounts(statusText);
          const avatarUrls = rsdExtractAvatarUrls(li);
          const nameAnchors = Array.from(
            li.querySelectorAll('.friends-in-server-label a.text-name'),
          );
          const names = nameAnchors
            .map((a) => (a.textContent || '').trim())
            .filter(Boolean);
          const seen = new Set();
          const uniqueNames = [];
          for (const nm of names) {
            const key = nm.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            uniqueNames.push(nm);
          }
          if (!uniqueNames.length) continue;

          let serverId = extractedServerId;
          if (!serverId) {
            // Roblox no longer reliably exposes a server instance id in DOM.
            // Create a stable, in-memory id so we can show avatars without changing UI.
            const placeAttr = li.querySelector('span[data-placeid]')?.getAttribute('data-placeid') || '';
            const sig = uniqueNames.map((n) => n.toLowerCase()).sort().join('|');
            serverId = `dom:${placeAttr || '0'}:${sig || 'na'}:${items.indexOf(li)}`;
          }
          servers.set(
            String(serverId),
            uniqueNames.map((nm) => ({ name: nm })),
          );
          meta.set(String(serverId), { ...counts, avatarUrls, joinBtn });
        }
        if (!servers.size) return null;
        const totalFriends = Array.from(servers.values()).reduce(
          (a, arr) => a + (arr?.length || 0),
          0,
        );
        return { totalFriends, servers, meta };
      } catch {
        return null;
      }
    }

    function rsdDomStateHasAnyAvatars(domState) {
      try {
        if (!domState?.meta || !domState?.servers) return false;
        for (const [sid, m] of domState.meta.entries()) {
          const arr = m?.avatarUrls;
          if (Array.isArray(arr) && arr.length) return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    function rsdIsAnyJoinButtonHovered() {
      try {
        return !!document.querySelector(
          ".rsd-sidepanel button:hover, .rsd-sidepanel [role=\"button\"]:hover, .rsd-sidepanel .rsd-clickable:hover",
        );
      } catch {
        return false;
      }
    }

    let rsdFriendsModuleObserver = null;
    let rsdFriendsBodyObserver = null;
    let rsdFriendsObservedRoot = null;
    let rsdFriendsDomRescanTimer = null;
    let rsdFriendsDomRescanUntil = 0;
    let rsdFriendsModuleObserverInit = false;
    function rsdKickFriendsDomRescan(ms = 12000) {
      const until = Date.now() + ms;
      rsdFriendsDomRescanUntil = Math.max(rsdFriendsDomRescanUntil || 0, until);
      if (rsdFriendsDomRescanTimer) return;
      rsdFriendsDomRescanTimer = setInterval(async () => {
        try {
          if (Date.now() > rsdFriendsDomRescanUntil) {
            clearInterval(rsdFriendsDomRescanTimer);
            rsdFriendsDomRescanTimer = null;
            return;
          }
          const domState = rsdReadFriendsFromRobloxModule();
          if (domState?.servers && domState.totalFriends > 0) {
            rsdFriendsCache = rsdMergeDomStateIntoCache(domState);
            rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, false);
            if (document.getElementById("rsd-friends-sidepanel")) {
              if (!rsdIsAnyJoinButtonHovered()) {
                try {
                  await rsdOpenFriendsServersPanel({
                    forceRefresh: false,
                    rerender: true,
                  });
                } catch {}
              }
            }
          }
        } catch {}
      }, 650);
    }

    function rsdAttachFriendsModuleObserver() {
      const root =
        document.getElementById("rbx-friends-running-games") ||
        document.getElementById("rbx-friends-game-server-item-container");
      if (!root) return false;

      if (
        rsdFriendsObservedRoot &&
        rsdFriendsObservedRoot === root &&
        rsdFriendsModuleObserver
      )
        return true;
      rsdFriendsObservedRoot = root;
      let t = null;
      const debounced = () => {
        if (t) clearTimeout(t);
        t = setTimeout(async () => {
          try {
            const domState = rsdReadFriendsFromRobloxModule();
            if (domState?.servers && domState.totalFriends > 0) {
              rsdFriendsCache = rsdMergeDomStateIntoCache(domState);
            rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, false);
              rsdKickFriendsDomRescan(9000);
              if (document.getElementById("rsd-friends-sidepanel")) {
                if (!rsdIsAnyJoinButtonHovered()) {
                  try {
                    await rsdOpenFriendsServersPanel({
                      forceRefresh: false,
                      rerender: true,
                    });
                  } catch {}
                }
              }
            } else {
              try {
                rsdSetFriendsButtonState(
                  rsdFriendsCache.totalFriends || 0,
                  false,
                );
              } catch {}
            }
          } catch {}
        }, 250);
      };
      try {
        if (rsdFriendsModuleObserver) rsdFriendsModuleObserver.disconnect();
        rsdFriendsModuleObserver = new MutationObserver(debounced);
        rsdFriendsModuleObserver.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            "src",
            "style",
            "class",
            "data-src",
            "data-delaysrc",
            "data-lazy-src",
            "srcset",
          ],
        });
        debounced();
      } catch {}
      return true;
    }

    function rsdInitFriendsModuleObserver() {
      if (rsdFriendsModuleObserverInit) return;
      rsdFriendsModuleObserverInit = true;

      try {
        rsdFriendsBodyObserver = new MutationObserver(() => {
          try {
            rsdAttachFriendsModuleObserver();
          } catch {}
        });
        rsdFriendsBodyObserver.observe(
          document.documentElement || document.body,
          { childList: true, subtree: true },
        );
      } catch {}

      rsdAttachFriendsModuleObserver();

      rsdKickFriendsDomRescan(10000);
    }

    function rsdSetFriendsButtonState(totalFriendsCount, isChecking = false) {
      const btn = document.getElementById("rsd-friends-btn");
      if (!btn) return;
      const hasFriends = (totalFriendsCount || 0) > 0;

      const isDisabled = !hasFriends && !isChecking;
      btn.classList.toggle("rsd-disabled", isDisabled);
      btn.setAttribute("aria-disabled", isDisabled ? "true" : "false");

      const isDarkMode = getCurrentTheme() === "dark";
      btn.style.color = hasFriends
        ? isDarkMode
          ? "#ccc"
          : "#555"
        : isDarkMode
          ? "#888"
          : "#999";
      btn.classList.toggle("rsd-friends-active", !!hasFriends);
      btn.classList.toggle("rsd-friends-hasfriends", !!hasFriends);
      btn.classList.toggle("rsd-friends-inactive", !hasFriends);
      btn.classList.toggle("rsd-friends-checking", !!isChecking);

      btn.style.opacity = "1";
      rsdSetFriendsButtonIcon(btn, totalFriendsCount || 0);

      try {
        btn.removeAttribute("title");
      } catch {}
    }
    async function rsdCheckFriendsInServers(force = false) {
      const now = Date.now();

      if (
        !force &&
        rsdFriendsCache.ts &&
        now - rsdFriendsCache.ts < RSD_FRIENDS_CACHE_MS
      ) {
        rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, false);
        return rsdFriendsCache;
      }

      rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, true);

      let domStateFast = null;
      if (force && rsdLastDomStateFast && rsdLastDomStateFast.servers) {
        domStateFast = rsdLastDomStateFast;
      }

      if (!force) {
        let domState = rsdReadFriendsFromRobloxModule();
        if (!domState) {
          const t0 = Date.now();
          while (Date.now() - t0 < 200) {
            await new Promise((r) => setTimeout(r, 50));
            domState = rsdReadFriendsFromRobloxModule();
            if (
              domState?.servers &&
              domState.totalFriends > 0 &&
              (rsdDomStateHasAnyAvatars(domState) || Date.now() - t0 > 100)
            )
              break;
          }
        }
        if (domState?.servers && domState.totalFriends > 0) {
          domStateFast = domState;
          rsdLastDomStateFast = domState;
          rsdSetFriendsButtonState(domState.totalFriends, false);
try {
  rsdFriendsCache = {
    ts: now,
    totalFriends: domStateFast.totalFriends,
    servers: domStateFast.servers,
    meta: domStateFast.meta,
    otherGames: null,
    source: "dom-fast",
  };
} catch {}
try {
  if (!rsdPresenceAugmentInFlight) {
    rsdPresenceAugmentInFlight = true;
    setTimeout(() => {
      (async () => {
        try {
          await rsdCheckFriendsInServers(true);
        } catch {} finally {
          rsdPresenceAugmentInFlight = false;
        }
        try {
          const p = document.getElementById("rsd-friends-sidepanel");
          if (p && p.classList?.contains("rsd-open")) {
            rsdOpenFriendsServersPanel({ rerender: true });
          }
        } catch {}
      })();
    }, 0);
  }
} catch {}
return rsdFriendsCache;
}
      }
      try {
        const myUserId = await rsdGetAuthenticatedUserId();
        if (!myUserId) {
          rsdFriendsCache = { ts: now, totalFriends: 0, servers: null };
          rsdSetFriendsButtonState(0);
          return rsdFriendsCache;
        }
        const friends = await rsdFetchAllFriends(myUserId);
        if (!friends.length) {
          rsdFriendsCache = { ts: now, totalFriends: 0, servers: null };
          rsdSetFriendsButtonState(0);
          return rsdFriendsCache;
        }
        const friendIds = friends.map((f) => f.id).filter(Boolean);

  const presences = await rsdFetchPresence(friendIds);
  const inGame = (presences || []).filter(
    (p) => p && Number(p.userPresenceType) === 2 && p.placeId,
  );

  if (!inGame.length) {
    if (domStateFast?.servers && domStateFast.totalFriends > 0) {
      rsdFriendsCache = {
        ts: now,
        totalFriends: domStateFast.totalFriends,
        servers: domStateFast.servers,
        meta: domStateFast.meta,
        otherGames: null,
        source: "dom",
      };
      rsdSetFriendsButtonState(domStateFast.totalFriends, false);
      return rsdFriendsCache;
    }
    rsdFriendsCache = { ts: now, totalFriends: 0, servers: null, otherGames: null };
    rsdSetFriendsButtonState(0);
    return rsdFriendsCache;
  }

  const friendById = new Map(friends.map((f) => [String(f.id), f]));
  const inThisPlace = inGame.filter(
    (p) => String(p?.placeId) === String(placeId),
  );

  const servers = new Map();
  for (const p of inThisPlace) {
    const fr = friendById.get(String(p.userId));
    if (!fr) continue;

    const joinable = !!p.gameId;
    const sid = joinable ? String(p.gameId) : `private:${p.userId}`;

    let arr = servers.get(sid);
    if (!arr) {
      arr = [];
      arr.__rsdJoinable = joinable;
      servers.set(sid, arr);
    }
    arr.push(fr);
  }
  const other = inGame.filter((p) => String(p?.placeId) !== String(placeId));
  const otherByPlace = new Map(); // placeId -> Map(gameId -> friends[])
  for (const p of other) {
    const pid = String(p.placeId);
    const fr = friendById.get(String(p.userId));
    if (!pid || !fr) continue;

    const joinable = !!p.gameId;
    const gid = joinable ? String(p.gameId) : `private:${p.userId}`;

    if (!otherByPlace.has(pid)) otherByPlace.set(pid, new Map());
    const byServer = otherByPlace.get(pid);

    let arr = byServer.get(gid);
    if (!arr) {
      arr = [];
      arr.__rsdJoinable = joinable;
      byServer.set(gid, arr);
    }
    arr.push(fr);
  }
  let otherGames = null;
  if (otherByPlace.size) {
    const placeIds = Array.from(otherByPlace.keys());
    const details = await rsdFetchPlaceDetails(placeIds);
    otherGames = new Map();
    for (const [pid, byServer] of otherByPlace.entries()) {
      const d = details?.get?.(String(pid)) || null;
      otherGames.set(String(pid), {
        placeId: String(pid),
        name: d?.name || "Unknown game",
        url: d?.url || (pid ? `https://www.roblox.com/games/${pid}` : ""),
        universeId: d?.universeId,
        servers: byServer,
      });
    }
  }
  try {
    if (!state.meta || typeof state.meta.get !== "function") state.meta = new Map();
  } catch {}

  const idsToLookup = Array.from(servers.keys()).filter(
    (sid) => sid && !String(sid).startsWith("private:"),
  );
  try {
    const need = idsToLookup.filter((sid) => !state?.meta?.get?.(String(sid)));
    if (need.length) {
      if (!globalThis.__rsdFriendsMetaLookupInFlight) globalThis.__rsdFriendsMetaLookupInFlight = new Set();
      const inflight = globalThis.__rsdFriendsMetaLookupInFlight;

      setTimeout(() => {
        (async () => {
          for (const sid of need) {
            try {
              const k = `${placeId}:${sid}`;
              if (inflight.has(k)) continue;
              inflight.add(k);

              const found = await rsdLookupPublicServerById(placeId, sid);
              if (found) {
                const pt = Array.isArray(found.playerTokens) ? found.playerTokens : [];
                const playing = Number.isFinite(Number(found.playing)) ? Number(found.playing) : undefined;
                const maxPlayers = Number.isFinite(Number(found.maxPlayers)) ? Number(found.maxPlayers) : undefined;
                state.meta.set(String(sid), { playerTokens: pt, playing, maxPlayers });
              }
            } catch {} finally {
              try { inflight.delete(`${placeId}:${sid}`); } catch {}
            }
          }
          try {
            const p = document.getElementById("rsd-friends-sidepanel");
            if (p && p.classList?.contains("rsd-open")) {
              rsdOpenFriendsServersPanel({ rerender: true });
            }
          } catch {}
        })();
      }, 0);
    }
  } catch {}

  const totalFriends = inGame.length;

    rsdFriendsCache = {
    ts: now,
    totalFriends,
    servers: servers.size ? servers : null,
    otherGames: otherGames && otherGames.size ? otherGames : null,
    source: "presence",
  };
  if (domStateFast?.servers && domStateFast.totalFriends > 0) {
    rsdFriendsCache.meta = domStateFast.meta;
    rsdFriendsCache.source = "dom+presence";
  }

  rsdSetFriendsButtonState(totalFriends);
  return rsdFriendsCache;
} catch {
        try {
          rsdSetFriendsButtonState(rsdFriendsCache.totalFriends || 0, false);
        } catch {}
        return rsdFriendsCache;
      }
    }
let rsdCsrfToken = null;
let rsdCsrfTokenTs = 0;
const RSD_CSRF_TTL_MS = 15 * 60 * 1000;

async function rsdGetCsrfToken(force = false) {
  const now = Date.now();
  if (!force && rsdCsrfToken && now - rsdCsrfTokenTs < RSD_CSRF_TTL_MS) return rsdCsrfToken;

  try {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const metaToken =
      meta?.getAttribute("data-token") ||
      meta?.getAttribute("content") ||
      meta?.dataset?.token;
    if (metaToken) {
      rsdCsrfToken = metaToken;
      rsdCsrfTokenTs = now;
      return metaToken;
    }
  } catch {}

  return rsdCsrfToken;
}

async function rsdGetAuthenticatedUserId() {
      try {
        const res = await fetch(
          "https://users.roblox.com/v1/users/authenticated",
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.id ? data.id : null;
      } catch {
        return null;
      }
    }
    async function rsdFetchAllFriends(userId) {
      try {
        const res = await fetch(
          `https://friends.roblox.com/v1/users/${userId}/friends`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.data) ? data.data : [];
      } catch {
        return [];
      }
    }

async function rsdFetchPresence(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const out = [];
  const batchSize = 100;
  let csrf = await rsdGetCsrfToken();

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    try {
      let res = await fetch("https://presence.roblox.com/v1/presence/users", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        },
        body: JSON.stringify({ userIds: batch }),
      });
      if (res.status === 403) {
        const newToken = res.headers.get("x-csrf-token");
        if (newToken) {
          csrf = newToken;
          rsdCsrfToken = newToken;
          rsdCsrfTokenTs = Date.now();
          res = await fetch("https://presence.roblox.com/v1/presence/users", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-TOKEN": csrf,
            },
            body: JSON.stringify({ userIds: batch }),
          });
        }
      }

      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.userPresences)) out.push(...data.userPresences);
    } catch {}
  }
  return out;
}
let rsdPlaceDetailsCache = { ts: 0, map: new Map() };
const RSD_PLACE_CACHE_MS = 10 * 60 * 1000;

async function rsdFetchPlaceDetails(placeIds) {
  try {
    if (!Array.isArray(placeIds) || placeIds.length === 0) return new Map();

    const now = Date.now();
    const cacheFresh =
      rsdPlaceDetailsCache?.ts &&
      now - rsdPlaceDetailsCache.ts < RSD_PLACE_CACHE_MS;

    const cacheMap =
      rsdPlaceDetailsCache && rsdPlaceDetailsCache.map instanceof Map
        ? rsdPlaceDetailsCache.map
        : new Map();

    const unique = Array.from(
      new Set(placeIds.map((p) => String(p)).filter(Boolean)),
    );
    if (!cacheFresh) cacheMap.clear();

    const missing = cacheFresh
      ? unique.filter((pid) => !cacheMap.has(pid))
      : unique;

    if (missing.length) {
      const batchSize = 50;
      for (let i = 0; i < missing.length; i += batchSize) {
        const batch = missing.slice(i, i + batchSize);
        try {
          const url =
            "https://games.roblox.com/v1/games/multiget-place-details?placeIds=" +
            batch.map(encodeURIComponent).join(",");
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const g of data) {
              const pid = g?.placeId != null ? String(g.placeId) : null;
              if (!pid) continue;
              cacheMap.set(pid, {
                placeId: pid,
                name: g?.name || "",
                url: pid ? `https://www.roblox.com/games/${pid}` : "",
                universeId: g?.universeId,
              });
            }
          }
        } catch {}
      }
    }

    rsdPlaceDetailsCache = { ts: now, map: cacheMap };
    return cacheMap;
  } catch {
    return new Map();
  }
}

function rsdJoinGameInstance(placeId, gameInstanceId) {
  try {
    const pid = String(placeId || "").trim();
    const gid = String(gameInstanceId || "").trim();
    if (!pid || !gid) return;
    try {
      if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { action: "joinGameInstance", placeId: pid, serverId: gid },
          () => {},
        );
        return;
      }
    } catch {}
    window.location.href = `https://www.roblox.com/games/start?placeId=${encodeURIComponent(pid)}&gameInstanceId=${encodeURIComponent(gid)}`;
  } catch {}
}

    async function rsdOpenFriendsServersPanel(opts = {}) {
      const { forceRefresh = false } = opts || {};

			if (opts?.rerender && (rsdIsAnyJoinButtonHovered() || rsdIsFriendsPanelInteracting())) {
				try {
					const p = document.getElementById("rsd-friends-sidepanel");
					const l = p ? p.querySelector(".rsd-sidepanel-list") : null;
					if (l && l.querySelector(".rsd-sidepanel-spinner")) {
					} else {
						try {
							if (rsdFriendsDeferredRerenderTimer)
								clearTimeout(rsdFriendsDeferredRerenderTimer);
							rsdFriendsDeferredRerenderTimer = setTimeout(() => {
								try {
									const p = document.getElementById("rsd-friends-sidepanel");
									if (p && p.classList?.contains("rsd-open") && !rsdIsFriendsPanelInteracting()) {
										rsdOpenFriendsServersPanel({ rerender: true });
									}
								} catch {}
							}, 140);
						} catch {}
						return;
					}
				} catch {}
			}

      try {
        rsdCancelCloseSidePanel();
      } catch {}
      rsdSuppressSidePanelCloseUntil = Date.now() + 250;

      const dropdown = document.getElementById("regionDropdown");
      if (!dropdown) return;

      try {
        const recentPanel = document.getElementById("rsd-recent-sidepanel");
        if (recentPanel) {try { recentPanel.remove(); } catch {}
          try {
            const btn = document.getElementById("rsd-recent-btn");
            if (btn) btn.classList.remove("rsd-panel-open");
          } catch {}
        }
      } catch {}

      try {
        rsdInitFriendsModuleObserver();
      } catch {}
      try {
        rsdKickFriendsDomRescan(12000);
      } catch {}
      try {
        rsdKickFriendsDomRescan(12000);
      } catch {}
      const isDarkMode = getCurrentTheme() === "dark";

      const existing = document.getElementById("rsd-friends-sidepanel");
      if (existing && !opts?.rerender) return;

      try {
        const region_panel = document.getElementById("rsd-region-sidepanel");
        if (region_panel) {
          try {
            region_panel.remove();
          } catch {}
          try {
            const b2 = document.getElementById("rsd-sidepanel-bridge");
            if (b2) b2.remove();
          } catch {}
        }
      } catch {}

      let panel = document.getElementById("rsd-friends-sidepanel");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "rsd-friends-sidepanel";
        panel.className = `rsd-sidepanel ${isDarkMode ? "rsd-dark" : "rsd-light"}`;
        panel.innerHTML = `
								<div class="rsd-sidepanel-header">
									<div class="rsd-sidepanel-title">Friends playing now</div>
								</div>
							<div class="rsd-sidepanel-body">
								<div class="rsd-sidepanel-list"></div>
							</div>
						`;

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

          try {
            if (!spBridge.dataset.rsdHoverHandlers) {
              spBridge.dataset.rsdHoverHandlers = "1";
              spBridge.addEventListener("mouseenter", rsdCancelCloseSidePanel);
              spBridge.addEventListener(
                "mouseleave",
                rsdScheduleCloseSidePanel,
              );
            }
          } catch {}
        }
        spBridge.style.pointerEvents = "auto";

        panel.addEventListener("mouseenter", rsdCancelCloseSidePanel);
        panel.addEventListener("mouseleave", rsdScheduleCloseSidePanel);
      }

      panel.classList.toggle("rsd-dark", isDarkMode);
      panel.classList.toggle("rsd-light", !isDarkMode);
      try {
        panel.classList.add("rsd-open");
      } catch {}
      const titleEl = panel.querySelector(".rsd-sidepanel-title");
      const listEl = panel.querySelector(".rsd-sidepanel-list");

      const now = Date.now();
      const cacheFresh =
        !forceRefresh &&
        rsdFriendsCache &&
        rsdFriendsCache.ts &&
        now - rsdFriendsCache.ts < RSD_FRIENDS_CACHE_MS;
      if (listEl) {
        if (!cacheFresh) {
          listEl.innerHTML = `<div class="rsd-sidepanel-spinner" aria-label="Loading"></div>`;
        } else {
          listEl.innerHTML = "";
        }
      }

      const rsdFriendThumbCache = (window.__rsdFriendThumbCache ||= new Map());
      async function rsdFetchFriendHeadshots(userIds) {
        const out = {};
        const ids = (userIds || []).map(String).filter(Boolean);
        const unique = [...new Set(ids)];
        const uncached = unique.filter((id) => !rsdFriendThumbCache.has(id));
        if (!uncached.length) {
          for (const id of unique)
            out[id] = rsdFriendThumbCache.get(id) ?? null;
          return out;
        }

        const batchSize = 100;
        for (let i = 0; i < uncached.length; i += batchSize) {
          const batch = uncached.slice(i, i + batchSize);
          try {
            const qs = batch.join(",");
            const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(qs)}&size=48x48&format=Png&isCircular=true`;
            const res = await fetch(url, {
              credentials: "include",
              cache: "no-store",
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (Array.isArray(data?.data)) {
              for (const d of data.data) {
                const id = String(d.targetId);
                const img =
                  d.state === "Completed" && d.imageUrl ? d.imageUrl : null;
                rsdFriendThumbCache.set(id, img);
              }
            }
          } catch {}
        }
        for (const id of unique) out[id] = rsdFriendThumbCache.get(id) ?? null;
        return out;
      }

      async function rsdRenderFriendsStateToPanel(state, liveTitle, liveList) {
        if (!liveList) return;
        const hadSpinner = !!liveList.querySelector(".rsd-sidepanel-spinner");
        if (hadSpinner) rsdClearFriendsSpinner(liveList);

        if (typeof createServerFetch !== "function") {
          if (liveTitle) liveTitle.textContent = "Friends playing now";
          liveList.innerHTML = `<div class="rsd-sidepanel-empty">Unable to render friends list (missing UI renderer).</div>`;
          return;
        }

        const hasThisGame =
          state?.servers && state.totalFriends > 0 && state.servers.size > 0;
        const hasOtherGames =
          state?.otherGames && state.otherGames instanceof Map && state.otherGames.size > 0;

        if (!hasThisGame && !hasOtherGames) {
          if (liveTitle) liveTitle.textContent = "Friends playing now";
          liveList.innerHTML = `<div class="rsd-sidepanel-empty">No friends are currently in-game.</div>`;
          return;
        }

        if (liveTitle) liveTitle.textContent = "Friends playing now";
			if (!hadSpinner && rsdIsFriendsPanelInteracting()) {
				try {
					if (rsdFriendsDeferredRerenderTimer)
						clearTimeout(rsdFriendsDeferredRerenderTimer);
					rsdFriendsDeferredRerenderTimer = setTimeout(() => {
						try {
							rsdOpenFriendsServersPanel({ rerender: true });
						} catch {}
					}, 140);
				} catch {}
				return;
			}

			liveList.innerHTML = "";
        if (hasThisGame) {
          const sectionTitle = document.createElement("div");
          sectionTitle.textContent = "This game";
          sectionTitle.style.fontWeight = "600";
          sectionTitle.style.margin = "6px 0 8px 0";
          liveList.appendChild(sectionTitle);
        }

        const servers = hasThisGame ? state.servers : null;

        const isDomSource = !!(
          state?.meta &&
          (state?.source === "dom" || String(state?.source || "").includes("dom"))
        );
        let friendThumbMap = {};
        let friendThumbPromise = null;
        if (!isDomSource) {
          try {
            const allFriendIds = [];
            if (hasThisGame && servers && servers instanceof Map) {
              for (const sid of servers.keys()) {
                const frs = servers.get(sid) || [];
                for (const f of frs) if (f?.id != null) allFriendIds.push(String(f.id));
              }
            }
            if (state?.otherGames && state.otherGames instanceof Map) {
              for (const place of state.otherGames.values()) {
                const byServer = place?.servers instanceof Map ? place.servers : null;
                if (!byServer) continue;
                for (const frs of byServer.values()) {
                  for (const f of frs || []) if (f?.id != null) allFriendIds.push(String(f.id));
                }
              }
            }

            friendThumbPromise = rsdFetchFriendHeadshots(allFriendIds);
          } catch {}
        }

        if (hasThisGame) {
        const serverIds = Array.from(servers.keys());
                let friendServers = serverIds
                  .map((id) => {
                    const ars = getAllRobloxServers();
                    return (
                      (Array.isArray(ars)
                        ? ars.find((s) => String(s.id) === String(id))
                        : null) || {
                        id,
                        playing: "?",
                        maxPlayers: "?",
                        playerTokens: [],
                      }
                    );
                  })
                  .filter(Boolean);
                let thumbMapThisGame = {};
                try {
                  const tokens = friendServers.flatMap((s) => s?.playerTokens || []);
                  const uniqueTokens = Array.from(new Set(tokens)).filter(Boolean);
                  const thumbnailCache = getThumbnailCache();
                  const uncached = uniqueTokens.filter(
                    (t) =>
                      !(
                        thumbnailCache &&
                        typeof thumbnailCache.has === "function" &&
                        thumbnailCache.has(t)
                      ),
                  );

                  let fetched = {};
                  if (uncached.length && typeof fetchThumbnailAssets === "function") {
                    fetched = (await fetchThumbnailAssets(uncached)) || {};
                    if (thumbnailCache && typeof thumbnailCache.set === "function") {
                      for (const [t, u] of Object.entries(fetched)) {
                        try {
                          if (u) thumbnailCache.set(t, u);
                        } catch {}
                      }
                    }
                  }
                  let cacheObj = {};
                  try {
                    if (
                      thumbnailCache &&
                      typeof thumbnailCache[Symbol.iterator] === "function"
                    ) {
                      cacheObj = Object.fromEntries(thumbnailCache);
                    }
                  } catch {
                    cacheObj = {};
                  }
                  thumbMapThisGame = { ...cacheObj, ...fetched };
                } catch {
                  thumbMapThisGame = friendThumbMap || {};
                }

                const wrap = document.createElement("div");
                wrap.className = "rsd-sidepanel-cards";
                for (const server of friendServers) {
                  const serverId = String(server.id);
                  const frs = servers.get(serverId) || [];

                  let friendTokens = [];
                  let names = [];
                  if (isDomSource) {
                    const m = state.meta?.get?.(serverId) || null;
                    const avatarUrls = Array.isArray(m?.avatarUrls)
                      ? m.avatarUrls
                      : frs.map((f) => f?.avatarUrl).filter(Boolean);
                    names = frs.map((f) => (f?.name || "").trim()).filter(Boolean);

                    const playingCount = Number(m?.playing ?? server.playing);
                    const desiredCount = Number.isFinite(playingCount)
                      ? playingCount
                      : avatarUrls.length;
                    const maxThumbs = 5;
                    const tokensToRender = Math.min(desiredCount, maxThumbs);
                    friendTokens = [];
                    for (let i = 0; i < tokensToRender; i++) {
                      if (i < avatarUrls.length) {
                        const t = `dom:${serverId}:${i}`;
                        friendTokens.push(t);
                        thumbMapThisGame[t] = avatarUrls[i];
                      } else {
                        friendTokens.push(`dom:${serverId}:placeholder:${i}`);
                      }
                    }

                    if (m && (m.playing !== "?" || m.maxPlayers !== "?")) {
                      server.playing = m.playing;
                      server.maxPlayers = m.maxPlayers;
                    }
                  } else {
                    const m = state.meta?.get?.(serverId) || null;
                    names = frs.map((f) => (f?.name || "").trim()).filter(Boolean);

                    const maxThumbs = 5;
                    const tokens = Array.isArray(m?.playerTokens) ? m.playerTokens.filter(Boolean) : [];
                    if (tokens.length) {
                      friendTokens = tokens.slice(0, maxThumbs);
                      const assets = await fetchThumbnailAssets(friendTokens);
                      for (const t of friendTokens) {
                        const u = assets?.[t];
                        if (u) thumbMapThisGame[t] = u;
                      }
                      if (m && (m.playing !== undefined || m.maxPlayers !== undefined)) {
                        if (m.playing !== undefined) server.playing = m.playing;
                        if (m.maxPlayers !== undefined) server.maxPlayers = m.maxPlayers;
                      }
                    } else {
                      friendTokens = frs.map((f) => String(f.id)).filter(Boolean).slice(0, maxThumbs);
                    }

                    names = frs.map((f) => f.displayName || f.name).filter(Boolean);
                  }
                  const tokensForCard =
                    isDomSource
                      ? friendTokens
                      : (Array.isArray(server?.playerTokens) && server.playerTokens.length
                          ? server.playerTokens
                          : friendTokens);
                  const serverForCard = { ...server, playerTokens: tokensForCard };

                  const thumbCountOpt = isDomSource
                    ? Number(server.playing)
                    : undefined;
                  const entry = createServerFetch(
                    serverForCard,
                    thumbMapThisGame,
                    isDarkMode,
                    {
                      compact: true,
                      thumbCount: Number.isFinite(thumbCountOpt)
                        ? thumbCountOpt
                        : undefined,
                    },
                  );
                  try {
                    const pct = entry.querySelector(".player-count-text");
                    if (pct) {
                      const label = names.join(", ");
                      const playingNum = Number(server.playing);
                      const maxNum = Number(server.maxPlayers);
                      const hasCounts =
                        Number.isFinite(playingNum) && Number.isFinite(maxNum);
                      if (!hasCounts) {
                        pct.textContent = "";
                      }

                      if (label) {
                        if (hasCounts) {
                          const inline = document.createElement("span");
                          inline.className = "rsd-friends-inline";

                          const sep = document.createElement("span");
                          sep.className = "rsd-friends-sep";
                          sep.setAttribute("aria-hidden", "true");

                          const nm = document.createElement("span");
                          nm.className = "rsd-friends-name";
                          nm.textContent = label;

                          inline.appendChild(sep);
                          inline.appendChild(nm);
                          pct.appendChild(inline);
                        } else {
                          const nm = document.createElement("span");
                          nm.className = "rsd-friends-name";
                          nm.textContent = label;
                          pct.appendChild(nm);
                        }
                      }
                    }
                  } catch {}
                  const infoSection = entry.querySelector(".info-section");
                  if (infoSection && names.length) {
                  }
                  const joinBtn = entry.querySelector("button.join-button");
                  if (joinBtn) {
                    const isJoinable = (frs && frs.__rsdJoinable !== false) && !String(serverId).startsWith("private:");
                    const maxP = Number(server.maxPlayers);
                    const playingP = Number(server.playing);
                    const isFull =
                      Number.isFinite(maxP) && Number.isFinite(playingP)
                        ? playingP >= maxP
                        : false;

                    if (!isJoinable) {
                      joinBtn.disabled = true;
                      try { joinBtn.textContent = "Private"; } catch {}
                      try {
                        joinBtn.style.backgroundColor = "rgba(127,127,127,0.35)";
                        joinBtn.style.cursor = "not-allowed";
                        joinBtn.style.opacity = "0.85";
                      } catch {}
                      joinBtn.onclick = null;
                    } else {
joinBtn.disabled = false;
try {
  const base = rsdGetStandardJoinButtonSize(joinBtn);
  if (base?.width) {
    const w = Math.round(base.width);
    joinBtn.style.width = w + "px";
    joinBtn.style.minWidth = w + "px";
    joinBtn.style.maxWidth = w + "px";
  }
  if (base?.height) {
    const h = Math.round(base.height);
    joinBtn.style.minHeight = h + "px";
  }
  joinBtn.style.flex = "0 0 auto";
  joinBtn.style.whiteSpace = "nowrap";
  joinBtn.style.display = "flex";
  joinBtn.style.alignItems = "center";
  joinBtn.style.justifyContent = "center";
  joinBtn.style.textAlign = "center";
} catch {}

if (isFull) {
  try {
    joinBtn.textContent = "FULL";
  } catch {}
  try {
    joinBtn.style.backgroundColor = "#c62828";
    joinBtn.style.color = "#fff";
    joinBtn.style.cursor = "pointer";
    joinBtn.style.opacity = "1";
  } catch {}
} else {
  try {
    joinBtn.textContent = "Join";
  } catch {}
  try {
    joinBtn.style.backgroundColor = "";
    joinBtn.style.color = "";
    joinBtn.style.cursor = "";
    joinBtn.style.opacity = "";
  } catch {}
}

joinBtn.onclick = () => {
                      joinSpecificServer(serverId);

                      try {
                        if (typeof window.__rsdCloseRegionDropdown === "function")
                          window.__rsdCloseRegionDropdown();
                      } catch {}

                      try {
                        const fp = document.getElementById("rsd-friends-sidepanel");
                        if (fp) rsdAnimateSidePanelOut(fp);
                      } catch {}
                      try {
                        const b2 = document.getElementById("rsd-sidepanel-bridge");
                        if (b2) b2.remove();
                      } catch {}
                    };
                    }
                  }
                  wrap.appendChild(entry);
                }
                liveList.appendChild(wrap);
              }
if (hasOtherGames) {
  try {
    if (hasThisGame) {
      const divider = document.createElement("div");
      divider.style.margin = "10px 0";
      divider.style.borderTop = "1px solid rgba(127,127,127,0.25)";
      liveList.appendChild(divider);
    }

    const sectionTitle = document.createElement("div");
    sectionTitle.textContent = "Other games";
    sectionTitle.style.fontWeight = "600";
    sectionTitle.style.margin = "6px 0 8px 0";
    liveList.appendChild(sectionTitle);
  const wrap = document.createElement("div");
  wrap.className = "rsd-sidepanel-cards";
  const rsdOtherGameServerMeta =
    (state && state.__rsdOtherGameServerMeta) ||
    (globalThis.__rsdOtherGameServerMeta ||= { ts: 0, map: new Map() });

  const RSD_OG_META_TTL_MS = 60 * 1000;
  const rsdUniverseIconCache =
    globalThis.__rsdUniverseIconCache ||= { ts: 0, map: new Map() };
  const RSD_OG_ICON_TTL_MS = 10 * 60 * 1000;

  async function rsdFetchUniverseIcons(universeIds) {
    const now = Date.now();
    const fresh = rsdUniverseIconCache.ts && now - rsdUniverseIconCache.ts < RSD_OG_ICON_TTL_MS;
    if (!fresh) rsdUniverseIconCache.map.clear();
    rsdUniverseIconCache.ts = now;

    const ids = Array.from(new Set((universeIds || []).map((x) => String(x)).filter(Boolean)));
    const missing = ids.filter((id) => !rsdUniverseIconCache.map.has(id));
    if (!missing.length) return rsdUniverseIconCache.map;

    try {
      const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${missing
        .map(encodeURIComponent)
        .join(",")}&size=50x50&format=Png&isCircular=false`;
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data?.data) ? data.data : [];
        for (const r of rows) {
          const id = r?.targetId != null ? String(r.targetId) : null;
          if (!id) continue;
          const u = String(r?.imageUrl || "").trim();
          rsdUniverseIconCache.map.set(id, u);
        }
      }
    } catch {}
    for (const id of missing) {
      if (!rsdUniverseIconCache.map.has(String(id))) rsdUniverseIconCache.map.set(String(id), "");
    }
    return rsdUniverseIconCache.map;
  }

  async function rsdFetchOtherGameServerMeta(placeId, serverIds) {
    const pid = String(placeId);
    const now = Date.now();
    const fresh = rsdOtherGameServerMeta.ts && now - rsdOtherGameServerMeta.ts < RSD_OG_META_TTL_MS;
    if (!fresh) rsdOtherGameServerMeta.map.clear();
    rsdOtherGameServerMeta.ts = now;

    const placeCache = rsdOtherGameServerMeta.map.get(pid) || new Map();
    rsdOtherGameServerMeta.map.set(pid, placeCache);

    const needed = (serverIds || []).map(String).filter(Boolean).filter((sid) => !placeCache.has(sid));
    if (!needed.length) return placeCache;
    const remaining = new Set(needed);
    let cursor = null;
    let page = 0;
    while (remaining.size && page < 5) {
      page++;
      try {
        let url = `https://games.roblox.com/v1/games/${pid}/servers/Public?limit=100&sortOrder=Asc`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        const res = await fetch(url, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
        if (!res.ok) break;
        const data = await res.json();
        cursor = data?.nextPageCursor || null;
        const rows = Array.isArray(data?.data) ? data.data : [];
        for (const s of rows) {
          const sid = s?.id ? String(s.id) : null;
          if (!sid || !remaining.has(sid)) continue;
          placeCache.set(sid, {
            playing: typeof s.playing === "number" ? s.playing : null,
            maxPlayers: typeof s.maxPlayers === "number" ? s.maxPlayers : null,
          });
          remaining.delete(sid);
        }
        if (!cursor) break;
      } catch {
        break;
      }
    }
    for (const sid of remaining) placeCache.set(String(sid), { playing: null, maxPlayers: null });
    return placeCache;
  }

  const places = Array.from(state.otherGames.values()).sort((a, b) => {
    const aServers = a?.servers instanceof Map ? a.servers : null;
    const bServers = b?.servers instanceof Map ? b.servers : null;
    const ca = aServers
      ? Array.from(aServers.values()).reduce((n, xs) => n + (Array.isArray(xs) ? xs.length : 0), 0)
      : 0;
    const cb = bServers
      ? Array.from(bServers.values()).reduce((n, xs) => n + (Array.isArray(xs) ? xs.length : 0), 0)
      : 0;
    return cb - ca;
  });
  const rsdEscape = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\'/g, "&#39;");
  const rsdUserNameCache =
    globalThis.__rsdUserNameCache instanceof Map
      ? globalThis.__rsdUserNameCache
      : (globalThis.__rsdUserNameCache = new Map());

  async function rsdResolveUserName(userId) {
    const uid = userId != null ? String(userId) : "";
    if (!uid) return "";
    if (rsdUserNameCache.has(uid)) return rsdUserNameCache.get(uid) || "";
    try {
      const res = await fetch(`https://users.roblox.com/v1/users/${uid}`, {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        rsdUserNameCache.set(uid, "");
        return "";
      }
      const data = await res.json();
      const nm = String(data?.displayName || data?.name || "").trim();
      rsdUserNameCache.set(uid, nm);
      return nm;
    } catch {
      rsdUserNameCache.set(uid, "");
      return "";
    }
  }

  for (const place of places) {
    const byServer = place?.servers instanceof Map ? place.servers : null;
    if (!byServer || !byServer.size) continue;
    const placeServerIds = Array.from(byServer.keys()).map(String).filter(Boolean);
    const entriesByServerId = new Map();

    for (const [gid, frs] of byServer.entries()) {
      try {
        const friends = Array.isArray(frs) ? frs : [];
        const friendTokens = friends
          .map((f) => {
            const uid =
              f?.userId ?? f?.id ?? f?.userID ?? f?.uid ?? f?.robloxId ?? null;
            return uid != null ? String(uid) : null;
          })
          .filter(Boolean);
        const friendUids = Array.isArray(friends)
          ? friends
              .map((f) =>
                f?.userId ??
                f?.id ??
                f?.userID ??
                f?.uid ??
                f?.robloxId ??
                null,
              )
              .filter((v) => v != null)
          : [];

        const friendLabel = Array.isArray(friends)
          ? friends
              .map((f) =>
                String(
                  f?.displayName ||
                    f?.display_name ||
                    f?.username ||
                    f?.userName ||
                    f?.name ||
                    "",
                ).trim(),
              )
              .filter(Boolean)
              .join(", ")
          : "";
      const entry = (() => {
        const serverEntry = document.createElement("div");
        serverEntry.className = `server-entry ${isDarkMode ? "dark" : "light"} rsd-compact rsd-othergame-card`;
        serverEntry.dataset.serverId = String(gid);

        const topRow = document.createElement("div");
        topRow.className = "rsd-compact-top";

        const left = document.createElement("div");
        left.className = "rsd-og-left";

        const icon = document.createElement("img");
        icon.className = "rsd-og-gameicon";
        icon.alt = "";
        icon.loading = "lazy";
        icon.referrerPolicy = "no-referrer";
        left.appendChild(icon);

        const placeName = (place?.name || "").trim();
        const placeId =
          place?.placeId ??
          place?.placeID ??
          place?.rootPlaceId ??
          place?.rootPlaceID ??
          place?.id ??
          null;

        const title = document.createElement(placeId ? "a" : "div");
        title.className = "rsd-og-title";
        title.textContent = placeName || "Unknown game";
        if (placeId) {
          try {
            title.href = `https://www.roblox.com/games/${encodeURIComponent(String(placeId))}`;
            title.target = "_blank";
            title.rel = "noopener noreferrer";
          } catch {}
        }

        left.appendChild(title);

        const btnWrap = document.createElement("div");
        btnWrap.className = "buttons-container";
        const joinButton = document.createElement("button");
        joinButton.className = "server-button join-button light";
        joinButton.textContent = "Join";
        btnWrap.appendChild(joinButton);

        topRow.appendChild(left);
        topRow.appendChild(btnWrap);

        const info = document.createElement("div");
        info.className = "info-section";
        const pct = document.createElement("div");
        pct.className = `player-count-text ${isDarkMode ? "dark" : "light"}`;
        pct.textContent = String(friendLabel || "…");
        info.appendChild(pct);

        serverEntry.appendChild(topRow);
        serverEntry.appendChild(info);

        return serverEntry;
      })();
        if (!entry || typeof entry !== "object" || !entry.appendChild) continue;
        try {
          const pct = entry.querySelector(".player-count-text");
          if (pct) {
            const uid0 =
              friends?.[0]?.userId ??
              friends?.[0]?.id ??
              friends?.[0]?.userID ??
              friends?.[0]?.uid ??
              friends?.[0]?.robloxId ??
              null;
            try {
              if (uid0 != null) entry.dataset.rsdFriendUid = String(uid0);
              if (Array.isArray(friendUids) && friendUids.length)
                entry.dataset.rsdFriendUids = friendUids.map((u) => String(u)).join(",");
            } catch {}
            try { entry.dataset.rsdFriendLabel = String(friendLabel || ""); } catch {}
            try { entry.dataset.rsdHasCounts = "0"; } catch {}
            const initialLabel = String(friendLabel || "").trim();
            pct.textContent = initialLabel ? `${initialLabel}` : `…`;
            try {
              const uidCsv = String(entry?.dataset?.rsdFriendUids || "").trim();
              const uids = uidCsv
                ? uidCsv.split(",").map((s) => s.trim()).filter(Boolean)
                : (uid0 != null ? [String(uid0)] : []);

              const shownCount = initialLabel
                ? initialLabel.split(",").map((s) => s.trim()).filter(Boolean).length
                : 0;

              const needsResolve =
                (uids.length > 1) ||
                (!initialLabel) ||
                (shownCount && shownCount < uids.length);

              if (needsResolve && uids.length && entry?.dataset?.rsdFriendLabelResolved !== "1") {
                try { entry.dataset.rsdFriendLabelResolved = "1"; } catch {}
                Promise.all(
                  uids.map((u) =>
                    rsdResolveUserName(u)
                      .then((nm) => String(nm || "").trim())
                      .catch(() => ""),
                  ),
                )
                  .then((resolved) => {
                    const label = resolved.filter(Boolean).join(", ");
                    if (!label) return;
                    try { entry.dataset.rsdFriendLabel = String(label); } catch {}
                    try {
                      const pct2 = entry.querySelector(".player-count-text");
                      if (!pct2) return;
                      const hasCounts = entry?.dataset?.rsdHasCounts === "1";
                      const countsText = String(entry?.dataset?.rsdCountsText || "").trim();
                      pct2.textContent = hasCounts && countsText ? `${countsText} • ${label}` : `${label}`;
                    } catch {}
                  })
                  .catch(() => {});
              }
            } catch {}
          }
        } catch {}
        try {
          const joinBtn = entry.querySelector("button.join-button");
          if (joinBtn) {
            const isJoinable = (frs && frs.__rsdJoinable !== false) && !String(gid).startsWith("private:");

            if (!isJoinable) {
              joinBtn.disabled = true;
              joinBtn.textContent = "Private";
              try {
                joinBtn.style.backgroundColor = "rgba(127,127,127,0.35)";
                joinBtn.style.cursor = "not-allowed";
                joinBtn.style.opacity = "0.85";
              } catch {}
              joinBtn.onclick = null;
            } else {

            joinBtn.disabled = false;
            joinBtn.textContent = "Join";
            joinBtn.onclick = () => {
              rsdJoinGameInstance(place?.placeId, gid);

            try {
              if (typeof window.__rsdCloseRegionDropdown === "function")
                window.__rsdCloseRegionDropdown();
            } catch {}

            try {
              const fp = document.getElementById("rsd-friends-sidepanel");
              if (fp) rsdAnimateSidePanelOut(fp);
            } catch {}
            try {
              const b2 = document.getElementById("rsd-sidepanel-bridge");
              if (b2) b2.remove();
            } catch {}
            };
            }
          }
        } catch {}

        wrap.appendChild(entry);
        try {
          entriesByServerId.set(String(gid), entry);
        } catch {}
      } catch {}
    }
    (async () => {
      try {
        try {
          const uni = place?.universeId;
          if (uni != null) {
            const iconMap = await rsdFetchUniverseIcons([uni]);
            const iconUrl = iconMap?.get?.(String(uni)) || "";
            if (iconUrl) {
              for (const sid of placeServerIds) {
                const entry = entriesByServerId.get(String(sid));
                if (!entry) continue;
                const img = entry.querySelector("img.rsd-og-gameicon");
                if (img && !img.getAttribute("src")) img.src = iconUrl;
              }
            }
          }
        } catch {}
        try {
          const pid2 = place?.placeId != null ? String(place.placeId) : "";
          const nameNow = String(place?.name || "").trim();
          const detailsNeeded = !nameNow || place?.universeId == null;
          if (pid2 && typeof rsdFetchPlaceDetails === "function") {
            const detMap = detailsNeeded ? await rsdFetchPlaceDetails([pid2]) : null;
            const det = detMap && detMap.get ? detMap.get(pid2) : null;

            const resolvedName = String(nameNow || det?.name || "").trim();
            const resolvedUniverse = place?.universeId != null ? place.universeId : det?.universeId;

            if (resolvedName || resolvedUniverse != null) {
              for (const sid of placeServerIds) {
                const entry = entriesByServerId.get(String(sid));
                if (!entry) continue;
                if (resolvedName) {
                  const titleEl = entry.querySelector(".rsd-og-title");
                  if (titleEl && !String(titleEl.textContent || "").trim()) {
                    titleEl.textContent = resolvedName;
                  }
                }
                try {
                  const titleEl = entry.querySelector(".rsd-og-title");
                  if (titleEl && titleEl.tagName === "A" && !titleEl.getAttribute("href")) {
                    titleEl.href = `https://www.roblox.com/games/${encodeURIComponent(pid2)}`;
                    titleEl.target = "_blank";
                    titleEl.rel = "noopener noreferrer";
                  }
                } catch {}
              }
              if (resolvedUniverse != null) {
                const iconMap = await rsdFetchUniverseIcons([resolvedUniverse]);
                const iconUrl = iconMap?.get?.(String(resolvedUniverse)) || "";
                if (iconUrl) {
                  for (const sid of placeServerIds) {
                    const entry = entriesByServerId.get(String(sid));
                    if (!entry) continue;
                    const img = entry.querySelector("img.rsd-og-gameicon");
                    if (img && !img.getAttribute("src")) img.src = iconUrl;
                  }
                }
              }
            }
          }
        } catch {}
        try {
          const pidName = place?.placeId != null ? String(place.placeId) : "";
          if (pidName && typeof rsdFetchPlaceDetails === "function") {
            const detMap = await rsdFetchPlaceDetails([pidName]);
            const det = detMap?.get?.(pidName);
            const nm = String(det?.name || "").trim();
            if (nm) {
              for (const sid of placeServerIds) {
                const entry = entriesByServerId.get(String(sid));
                if (!entry) continue;
                const titleEl = entry.querySelector(".rsd-og-title");
                if (titleEl) {
                  const cur = String(titleEl.textContent || "").trim();
                  if (!cur || /^unknown game$/i.test(cur)) titleEl.textContent = nm;
                }
              }
            }
          }
        } catch {}

        const pid = place?.placeId;
        if (!pid || !placeServerIds.length) return;
        if (String(state?.placeId || "") !== String(pid)) return;
        const metaMap = await rsdFetchOtherGameServerMeta(pid, placeServerIds);
        if (!metaMap) return;

        for (const sid of placeServerIds) {
          const entry = entriesByServerId.get(String(sid));
          if (!entry) continue;
          const meta = metaMap.get(String(sid));

          const playingRaw = meta?.playing;
          const maxRaw = meta?.maxPlayers;
          const playing = Number.isFinite(Number(playingRaw)) ? Number(playingRaw) : null;
          const maxPlayers = Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;
          const maxValid = maxPlayers != null && maxPlayers > 0;
          const playingValid = playing != null && playing >= 0;
          const pct = entry.querySelector(".player-count-text");
          if (pct) {
            let friendLabel =
              (entry?.dataset && typeof entry.dataset.rsdFriendLabel === "string"
                ? entry.dataset.rsdFriendLabel
                : "") || "";
            const friendUid =
              (entry?.dataset && typeof entry.dataset.rsdFriendUid === "string"
                ? entry.dataset.rsdFriendUid
                : "") || "";
            const hasCounts = !!(playingValid && maxValid);
            const countsText = hasCounts ? `${playing} / ${maxPlayers} players` : "";
            try { entry.dataset.rsdHasCounts = hasCounts ? "1" : "0"; } catch {}
            try { entry.dataset.rsdCountsText = countsText; } catch {}

            const renderLine = (nm) => {
              const name = String(nm || "").trim();
              if (hasCounts && countsText) return `${countsText} • ${name || "…"}`;
              return `${name || "…"}`;
            };
            if (friendLabel) {
              pct.textContent = renderLine(friendLabel);
            } else {
              pct.textContent = renderLine("…");
              if (friendUid) {
                rsdResolveUserName(friendUid)
                  .then((nm) => {
                    if (!nm) return;
                    try { entry.dataset.rsdFriendLabel = String(nm); } catch {}
                    try {
                      const pct2 = entry.querySelector(".player-count-text");
                      if (pct2) pct2.textContent = renderLine(nm);
                    } catch {}
                  })
                  .catch(() => {});
              }
            }
          }
          const joinBtn = entry.querySelector("button.join-button");
          if (joinBtn && playingValid && maxValid) {
            const full = playing >= maxPlayers;
            if (full) {
              try {
                const base = rsdGetStandardJoinButtonSize(joinBtn);
                if (base?.width) {
                  const w = Math.round(base.width);
                  joinBtn.style.width = w + "px";
                  joinBtn.style.minWidth = w + "px";
                  joinBtn.style.maxWidth = w + "px";
                }
                if (base?.height) {
                  const h = Math.round(base.height);
                  joinBtn.style.minHeight = h + "px";
                }
                joinBtn.style.flex = "0 0 auto";
                joinBtn.style.whiteSpace = "nowrap";
                joinBtn.style.display = "flex";
                joinBtn.style.alignItems = "center";
                joinBtn.style.justifyContent = "center";
                joinBtn.style.textAlign = "center";
              } catch {}
              joinBtn.disabled = false;
              joinBtn.textContent = "FULL";
              joinBtn.style.backgroundColor = "#c62828";
              joinBtn.style.color = "#fff";
              joinBtn.style.cursor = "pointer";
              joinBtn.style.opacity = "1";
            }
          }
        }
      } catch {}
    })();
  }

  if (!wrap.childElementCount) {
    const empty = document.createElement("div");
    empty.className = "rsd-sidepanel-empty";
    empty.textContent = "No friends are currently in other games.";
    liveList.appendChild(empty);
  } else {
    liveList.appendChild(wrap);
  }
  } catch {
    try {
      const empty = document.createElement("div");
      empty.className = "rsd-sidepanel-empty";
      empty.textContent = "Unable to render other games right now.";
      liveList.appendChild(empty);
    } catch {}
  }
}
        if (friendThumbPromise && typeof friendThumbPromise.then === "function") {
          friendThumbPromise
            .then((m) => {
              if (!m) return;
              friendThumbMap = m;
              try {
                const imgs = liveList.querySelectorAll(
                  "img.profile-thumbnail[data-rsd-token]",
                );
                for (const img of imgs) {
                  const t = img?.dataset?.rsdToken;
                  if (!t) continue;
                  const url = friendThumbMap[t];
                  if (url) img.src = url;
                }
              } catch {}
            })
            .catch(() => {});
        }
      }

      (async () => {
        const livePanel = document.getElementById("rsd-friends-sidepanel");
        if (!livePanel) return;
        const liveTitle = livePanel.querySelector(".rsd-sidepanel-title");
        const liveList = livePanel.querySelector(".rsd-sidepanel-list");

        let state = cacheFresh ? rsdFriendsCache : null;

        if (
          state?.servers &&
          state.totalFriends > 0 &&
          state.servers.size > 0
        ) {
          try {
            await rsdRenderFriendsStateToPanel(state, liveTitle, liveList);
          } catch {}
        }

        if (!state) {
          state = await rsdCheckFriendsInServers(!!forceRefresh);
        } else {
          try {
            rsdCheckFriendsInServers(false);
          } catch {}
        }
        if (!document.getElementById("rsd-friends-sidepanel")) return;
        try {
          await rsdRenderFriendsStateToPanel(state, liveTitle, liveList);
        } catch {}
        try {
          rsdClearFriendsSpinner(liveList);
        } catch {}
        return;
})();

      return;
    }

    const api = {
      CACHE_MS:
        typeof RSD_FRIENDS_CACHE_MS === "number" ? RSD_FRIENDS_CACHE_MS : 60000,
      cache:
        typeof rsdFriendsCache !== "undefined"
          ? rsdFriendsCache
          : { ts: 0, totalFriends: 0, servers: null },
      renderFriendsButtonIcon:
        typeof rsdRenderFriendsButtonIcon === "function"
          ? rsdRenderFriendsButtonIcon
          : () => "",
      setFriendsButtonState:
        typeof rsdSetFriendsButtonState === "function"
          ? rsdSetFriendsButtonState
          : () => {},
      checkFriendsInServers:
        typeof rsdCheckFriendsInServers === "function"
          ? rsdCheckFriendsInServers
          : async () => api.cache,
      openFriendsServersPanel:
        typeof rsdOpenFriendsServersPanel === "function"
          ? rsdOpenFriendsServersPanel
          : () => {},
      initFriendsModuleObserver:
        typeof rsdInitFriendsModuleObserver === "function"
          ? rsdInitFriendsModuleObserver
          : () => {},
    };

    return api;
  };

    RSD.friends_serverlist_panel.initFriendsServerlistPanel = function initFriendsServerlistPanel(ctx) {
    return ctx?.friends || null;
  };
})();
