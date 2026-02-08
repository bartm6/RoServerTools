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
  RSD.history_panel = RSD.history_panel || {};

  const __u = globalThis.RSD?.utils || {};
  const escapeHtml = __u.escapeHtml || ((s) => String(s));
  const createEl = __u.createEl || null;
  const getDebugEnabled = __u.getDebugEnabled || (() => false);

  function dbg(...args) {
    try {
      if (!getDebugEnabled()) return;
      console.debug("[RSD][history_panel]", ...args);
    } catch {}
  }

  function safeImageUrl(u) {
    try {
      const s = String(u || "").trim();
      if (!s) return "";
      if (/^data:image\//i.test(s)) return s;
      const url = new URL(s, location.href);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {}
    return "";
  }

  function getUtils() {
    return globalThis.RSD?.history_panel?.utils || {};
  }

  function getTheme(getCurrentTheme) {
    try {
      if (typeof getCurrentTheme === "function") {
        const t = getCurrentTheme();
        if (t) return String(t);
      }
    } catch {}
    try {
      return document.body.classList.contains("dark-theme") ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function stop(ev) {
    try {
      ev.preventDefault();
      ev.stopPropagation();
    } catch {}
  }
  let closeTimer = null;
  function cancelClose() {
    try {
      if (closeTimer) clearTimeout(closeTimer);
    } catch {}
    closeTimer = null;
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => {
      try {
        globalThis.RSD?.history_panel?.close?.();
      } catch {}
    }, 180);
  }

  function animateIn(overlay, el) {
    try {
      overlay?.animateSidePanelIn?.(el);
    } catch {}
  }
  function animateOut(overlay, el) {
    try {
      return overlay?.animateSidePanelOut?.(el);
    } catch {
      return Promise.resolve();
    }
  }

  async function open({ overlay = null, getCurrentTheme = null } = {}) {
    try {
      cancelClose();
    } catch {}

    const dropdown = document.getElementById("regionDropdown");
    if (!dropdown) return;
    const existing = document.getElementById("rsd-recent-sidepanel");
    if (existing) {
      try {
        if (existing.classList?.contains("rsd-open")) return;
      } catch {}
      try {
        existing.remove();
      } catch {}
    }

    try {
      const btn = document.getElementById("rsd-recent-btn");
      if (btn) btn.classList.add("rsd-panel-open");
    } catch {}
    try {
      const friendsPanel = document.getElementById("rsd-friends-sidepanel");
      if (friendsPanel) friendsPanel.remove();
    } catch {}
    try {
      const region_panel = document.getElementById("rsd-region-sidepanel");
      if (region_panel) region_panel.remove();
    } catch {}

    const isDark = getTheme(getCurrentTheme) === "dark";

    const panel = document.createElement("div");
    panel.id = "rsd-recent-sidepanel";
    panel.className = `rsd-sidepanel ${isDark ? "rsd-dark" : "rsd-light"}`;
    panel.innerHTML = `
      <div class="rsd-sidepanel-header">
        <div class="rsd-sidepanel-title">Join history</div>
      </div>
      <div class="rsd-sidepanel-body">
        <ul class="rsd-sidepanel-list" id="rsd-recent-list"></ul>
      </div>`;

    const rsdGapPx =
      typeof window !== "undefined" && Number.isFinite(Number(window.__rsdUiGapPx))
        ? Number(window.__rsdUiGapPx)
        : 8;

    panel.style.position = "absolute";
    panel.style.top = "0px";
    panel.style.right = `calc(100% + ${rsdGapPx}px)`;

    dropdown.appendChild(panel);
    animateIn(overlay, panel);
    try {
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
      } else {
        try {
          if (spBridge.parentElement !== dropdown) dropdown.appendChild(spBridge);
        } catch {}
      }
      spBridge.style.pointerEvents = "auto";
      spBridge.addEventListener("mouseenter", cancelClose);
      spBridge.addEventListener("mouseleave", scheduleClose);
    } catch {}

    panel.addEventListener("mouseenter", cancelClose);
    panel.addEventListener("mouseleave", scheduleClose);

    async function renderList() {
      const list = panel.querySelector("#rsd-recent-list");
      if (!list) return;
      const utils = getUtils();
      const items = (await utils.getRecentAll?.()) || [];

      if (!items.length) {
        list.textContent = "";
        const empty = document.createElement("div");
        empty.className = "rsd-sidepanel-empty";
        empty.textContent = "No join history yet.";
        list.appendChild(empty);
        return;
      }
      list.textContent = "";
      for (const x of items) {
        const sid = String(x.serverId || "");
        const pid = String(x.placeId || "");
        const ago = utils.formatTimeAgo ? utils.formatTimeAgo(x.ts) : "";

        const li = document.createElement("li");
        li.className = "rsd-recent-item";
        li.dataset.sid = sid;
        li.dataset.pid = pid;

        const left = document.createElement("div");
        left.className = "rsd-recent-left";

        const img = document.createElement("img");
        img.className = "rsd-recent-gameicon";
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        const safeUrl = safeImageUrl(x.gameIconUrl);
        if (safeUrl) img.src = safeUrl;

        const text = document.createElement("div");
        text.className = "rsd-recent-text";

        const title = document.createElement("div");
        title.className = "rsd-recent-title";
        title.textContent = String(x.gameName || "Unknown game");

        const sub = document.createElement("div");
        sub.className = "rsd-recent-sub";
        sub.textContent = `Last joined ${String(ago || "")}`;

        text.appendChild(title);
        text.appendChild(sub);

        left.appendChild(img);
        left.appendChild(text);

        const btn = document.createElement("button");
        btn.className = "server-button join-button rsd-recent-join";
        btn.dataset.sid = sid;
        btn.dataset.pid = pid;
        btn.textContent = "Join";

        btn.addEventListener("click", (ev) => {
          try {
            ev.preventDefault();
            ev.stopPropagation();
          } catch (e) {
            dbg("click stop failed", e);
          }

          if (!sid || !pid) return;
          try {
            const gameName = String(title.textContent || "").trim();
            const gameIconUrl = String(img.getAttribute("src") || "").trim();
            globalThis.RSD?.history_panel?.recordRecentJoin?.(String(pid), String(sid), {
              gameName,
              gameIconUrl,
            });
          } catch (e) {
            dbg("recordRecentJoin failed", e);
          }

          try {
            chrome.runtime.sendMessage(
              { action: "joinGameInstance", placeId: String(pid), serverId: String(sid) },
              () => {},
            );
          } catch (e) {
            dbg("sendMessage joinGameInstance failed", e);
          }
        });

        li.appendChild(left);
        li.appendChild(btn);
        list.appendChild(li);
      }
    }

    try {
      window.addEventListener("rsd:recentChanged", () => {
        try {
          renderList();
        } catch {}
      });
    } catch {}

    renderList();
    try {
      RSD.history_panel.close = async () => {
        try {
          cancelClose();
        } catch {}
        const p = document.getElementById("rsd-recent-sidepanel");
        if (!p) {
          try {
            const btn = document.getElementById("rsd-recent-btn");
            if (btn) btn.classList.remove("rsd-panel-open");
          } catch {}
          return;
        }
        try {
          await animateOut(overlay, p);
        } catch {}
        try {
          p.remove();
        } catch {}
        try {
          const btn = document.getElementById("rsd-recent-btn");
          if (btn) btn.classList.remove("rsd-panel-open");
        } catch {}
        try {
          const b = document.getElementById("rsd-sidepanel-bridge");
          const region_panel = document.getElementById("rsd-region-sidepanel");
          const friendsPanel = document.getElementById("rsd-friends-sidepanel");
          const recentPanel = document.getElementById("rsd-recent-sidepanel");
          if (b && !region_panel && !friendsPanel && !recentPanel) b.remove();
        } catch {}
      };
    } catch {}
  }

  function bindButton(button, opts = {}) {
    if (!button) return;
    button.addEventListener(
      "pointerdown",
      (e) => {
        stop(e);
        try {
          open(opts);
        } catch {}
      },
      true,
    );
    button.addEventListener("mousedown", stop, true);
    button.addEventListener("touchstart", stop, true);
    button.addEventListener(
      "click",
      (e) => {
        stop(e);
      },
      true,
    );

    try {
      button.onclick = null;
    } catch {}
  }

  RSD.history_panel.open = open;
  RSD.history_panel.bindButton = bindButton;
})();
