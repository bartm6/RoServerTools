/**
 * File: gamePage.js
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

  function installRobloxConnectionsRetryOnError() {
    try {

      const TITLES = [
        "Servers My Connections Are In",
        "Servers my connections are in",
        "Servers My Friends Are In",
      ];

      const BASE_DELAY_MS = 1200;
      const MAX_DELAY_MS = 8000;
      const BACKOFF = 1.25;

      let retryActive = false;
      let retryTimer = null;
      let retryAttempt = 0;

      let serversTabNudgeAttempts = 0;
      let lastServersTabNudgeAt = 0;

      function norm(s) {
        return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      }

      function textIncludesAny(haystack, needles) {
        const t = norm(haystack);
        return needles.some((n) => t.includes(norm(n)));
      }

      function findServersTabEl() {

        const candidates = [];

        const byHref = document.querySelectorAll(
          "a[href*='/servers' i],a[href*='servers' i]",
        );
        byHref.forEach((el) => candidates.push(el));

        const byTestId = document.querySelectorAll(
          "[data-testid*='servers' i],[id*='servers' i]",
        );
        byTestId.forEach((el) => {
          if (el.tagName === "A" || el.tagName === "BUTTON") candidates.push(el);
          const a = el.querySelector?.("a,button");
          if (a) candidates.push(a);
        });

        const byRoleTab = document.querySelectorAll("[role='tab']");
        byRoleTab.forEach((el) => {
          const t = norm(el.textContent);
          if (t === "servers") candidates.push(el);
        });

        const byText = document.querySelectorAll("a,button,div[role='button']");
        for (const el of byText) {
          const t = norm(el.textContent);
          if (t === "servers") candidates.push(el);
        }

        const uniq = Array.from(new Set(candidates)).filter(Boolean);
        return uniq[0] || null;
      }

      function isServersTabSelected(tabEl) {
        if (!tabEl) return false;
        const aria = tabEl.getAttribute?.("aria-selected");
        if (aria === "true") return true;
        const cls = norm(tabEl.className);
        if (cls.includes("active") || cls.includes("selected")) return true;
        const parent = tabEl.closest?.("[role='tablist']");

        if (tabEl.tagName === "A" && typeof tabEl.href === "string") {
          try {
            const u = new URL(tabEl.href);
            if (u.pathname.toLowerCase().includes("/servers")) {

              if (window.location.pathname.toLowerCase().includes("/servers")) return true;
            }
          } catch {}
        }

        if (parent) {
          const sel = parent.querySelector?.("[aria-selected='true']");
          if (sel && sel === tabEl) return true;
        }
        return false;
      }

      function nudgeServersTab() {
        const now = Date.now();
        if (serversTabNudgeAttempts >= 6) return false;
        if (now - lastServersTabNudgeAt < 750) return false;

        const tabEl = findServersTabEl();
        if (!tabEl) return false;
        if (isServersTabSelected(tabEl)) return true;

        try {
          tabEl.click();
          serversTabNudgeAttempts += 1;
          lastServersTabNudgeAt = now;
          return true;
        } catch {
          return false;
        }
      }

      function findModuleRoot() {
        const all = document.querySelectorAll("h1,h2,h3,[role='heading'],div,span,p");
        let titleEl = null;

        for (const el of all) {
          const t = norm(el.textContent);
          if (!t) continue;
          for (const candidate of TITLES) {
            if (t === norm(candidate)) {
              titleEl = el;
              break;
            }
          }
          if (titleEl) break;
        }
        if (!titleEl) return null;

        let cur = titleEl;
        for (let i = 0; i < 10 && cur; i++) {

          if (
            cur.querySelector?.("button") ||
            cur.querySelector?.("[data-testid*='server'],[class*='server'],a[href*='server']")
          ) {
            return cur;
          }
          cur = cur.parentElement;
        }
        return titleEl.closest("section,div") || titleEl.parentElement;
      }

      function findRefreshButton(scopeEl) {
        if (!scopeEl) return null;

        const labelled =
          scopeEl.querySelector(
            "button[aria-label*='Refresh' i],button[title*='Refresh' i],button[data-testid*='refresh' i]",
          ) || null;
        if (labelled) return labelled;

        const buttons = scopeEl.querySelectorAll("button");
        for (const b of buttons) {
          const t = norm(b.textContent);
          const a = norm(b.getAttribute("aria-label"));
          const title = norm(b.getAttribute("title"));
          const dt = norm(b.getAttribute("data-testid"));

          if (
            t.includes("refresh") ||
            a.includes("refresh") ||
            title.includes("refresh") ||
            dt.includes("refresh")
          ) {
            return b;
          }

          const svgTitle = b.querySelector("svg title")?.textContent || "";
          const svgAria = b.querySelector("svg")?.getAttribute("aria-label") || "";
          if (textIncludesAny(svgTitle + " " + svgAria, ["refresh", "reload"])) {
            return b;
          }
        }
        return null;
      }

      function moduleHasServers(scopeEl) {
        if (!scopeEl) return false;
        return (
          scopeEl.querySelector(
            "[data-testid*='server'],[class*='server'],a[href*='server']",
          ) != null
        );
      }

      function moduleTextState(scopeEl) {
        const text = norm(scopeEl?.textContent);

        const error =
          textIncludesAny(text, [
            "unable to load servers",
            "could not load",
            "something went wrong",
            "try again",
            "failed to load",

            "kan servers niet laden",
            "kan de servers niet laden",
            "probeer het opnieuw",
          ]) && !textIncludesAny(text, ["no servers found", "geen servers gevonden"]);

        const empty = textIncludesAny(text, [
          "no servers found",
          "geen servers gevonden",
          "no servers",
        ]) && !textIncludesAny(text, ["unable", "kan", "could not", "failed"]);

        return { error, empty };
      }

      function stopRetry() {
        retryActive = false;
        retryAttempt = 0;
        serversTabNudgeAttempts = 0;
        lastServersTabNudgeAt = 0;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      }

      function scheduleRetryTick() {
        if (!retryActive) return;

        const delay = Math.min(
          MAX_DELAY_MS,
          Math.round(BASE_DELAY_MS * Math.pow(BACKOFF, retryAttempt)),
        );

        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!retryActive) return;

          const root = findModuleRoot();
          if (!root) {

            if (nudgeServersTab()) {

              setTimeout(() => {
                try {
                  if (!retryActive) return;
                  maybeStartRetry();
                  if (retryActive && !retryTimer) scheduleRetryTick();
                } catch {}
              }, 400);
              return;
            }
            stopRetry();
            return;
          }

          const { error, empty } = moduleTextState(root);
          const hasServers = moduleHasServers(root);

          if (hasServers || empty) {
            stopRetry();
            return;
          }

          if (error) {
            const refreshBtn = findRefreshButton(root);
            if (refreshBtn && !refreshBtn.disabled) {
              try {
                refreshBtn.click();
              } catch {}
            }
            retryAttempt = Math.min(retryAttempt + 1, 50);
            scheduleRetryTick();
            return;
          }

          stopRetry();
        }, delay);
      }

      function maybeStartRetry() {
        const root = findModuleRoot();
        if (!root) {

          if (nudgeServersTab()) {
            setTimeout(() => {
              try {
                maybeStartRetry();
              } catch {}
            }, 450);
            return;
          }
          stopRetry();
          return;
        }

        serversTabNudgeAttempts = 0;

        const { error, empty } = moduleTextState(root);
        const hasServers = moduleHasServers(root);

        if (hasServers || empty) {
          stopRetry();
          return;
        }

        if (error && !retryActive) {
          retryActive = true;
          retryAttempt = 0;
          scheduleRetryTick();
        }
      }

      const obs = new MutationObserver(() => {
        try {
          maybeStartRetry();
        } catch {}
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });

      document.addEventListener(
        "click",
        (e) => {
          try {
            const root = findModuleRoot();
            if (!root) return;
            if (!root.contains(e.target)) return;

            setTimeout(() => {
              try {

                maybeStartRetry();

                const r2 = findModuleRoot();
                if (retryActive && r2) {
                  const st = moduleTextState(r2);
                  if (st.error) {
                    retryAttempt = 0;
                    if (retryTimer) {
                      clearTimeout(retryTimer);
                      retryTimer = null;
                    }
                    scheduleRetryTick();
                  }
                }
              } catch {}
            }, 250);
          } catch {}
        },
        true,
      );

      maybeStartRetry();
    } catch {}
  }

function start() {
    installRsdScrollLock();
    installRobloxConnectionsRetryOnError();
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
      "initFriendsServerlistPanel",
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
        start();
      }
    }
  } catch {
    if (!window.__rsdInitDone) {
      window.__rsdInitDone = true;
      start();
    }
  }
})();
