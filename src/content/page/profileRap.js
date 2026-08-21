(() => {
  "use strict";

  const rsdWarnOnce = globalThis.RSDDebug?.warnOnce || (() => {});

  const CARD_ID = "rsd-profile-rap-stat";
  const PANEL_ID = "rsd-profile-rap-panel";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const FALLBACK_PILL_BG = "rgb(28, 29, 34)";
  const FALLBACK_PILL_HOVER_BG = "rgb(28, 29, 34)";
  const FALLBACK_PILL_BG_LIGHT = "rgb(209, 213, 219)";
  const RATE_LIMIT_BASE_WAIT_MS = 1200;
  const RATE_LIMIT_MAX_WAIT_MS = 30000;


  let lastPath = "";
  let refreshTimer = 0;
  let activeUserId = null;

  function getProfileUserId() {
    const match = window.location.pathname.match(/(?:^|\/)users\/(\d+)\/profile(?:\/.*)?$/i);
    return match ? match[1] : null;
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }




  function formatNumber(value) {
    const number = Number(value) || 0;
    return number.toLocaleString();
  }

  function formatUpdated(timestamp) {
    if (!timestamp) return "just now";
    const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) return resolve(null);
      chrome.storage.local.get(key, (result) => resolve(result?.[key] || null));
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeHttpError(response) {
    const error = new Error(`Roblox inventory request failed: ${response.status}`);
    error.status = response.status;
    return error;
  }

  function updateLoadStatus(statusText, onProgress) {
    if (typeof onProgress === "function") onProgress(statusText);
  }

  async function fetchCollectibles(userId, onProgress) {
    let cursor = "";
    const items = [];
    let pageNumber = 0;
    let rateLimitAttempt = 0;

    do {
      if (activeUserId !== userId) {
        const cancelled = new Error("RAP request cancelled");
        cancelled.silent = true;
        throw cancelled;
      }

      const params = new URLSearchParams({
        limit: "100",
        sortOrder: "Asc"
      });
      if (cursor) params.set("cursor", cursor);

      updateLoadStatus(
        pageNumber === 0 ? "Loading from Roblox..." : `Loading Roblox page ${pageNumber + 1}...`,
        onProgress
      );

      const response = await fetch(
        `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?${params}`,
        { credentials: "include" }
      );

      if (response.status === 429) {
        const retryAfterHeader = Number(response.headers.get("Retry-After"));
        const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(RATE_LIMIT_MAX_WAIT_MS, RATE_LIMIT_BASE_WAIT_MS * Math.pow(1.65, rateLimitAttempt));

        rateLimitAttempt += 1;
        updateLoadStatus("Waiting for Roblox...", onProgress);
        await sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        throw makeHttpError(response);
      }

      rateLimitAttempt = 0;
      const payload = await response.json();
      const pageItems = Array.isArray(payload.data) ? payload.data : [];
      items.push(...pageItems);
      cursor = payload.nextPageCursor || "";
      pageNumber += 1;

      updateLoadStatus(`Loaded ${items.length.toLocaleString()} limiteds...`, onProgress);
    } while (cursor);

    return items;
  }

  async function getRapData(userId, onProgress) {
    const cacheKey = `rsd_profile_rap_${userId}`;
    const cached = await storageGet(cacheKey);

    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return { ...cached, fromCache: true };
    }

    const items = await fetchCollectibles(userId, onProgress);
    const totalRap = items.reduce((total, item) => {
      return total + (Number(item.recentAveragePrice) || 0);
    }, 0);

    const data = {
      totalRap,
      limiteds: items.length,
      source: "Roblox",
      updatedAt: Date.now(),
      fromCache: false
    };

    await storageSet(cacheKey, data);
    return data;
  }

  function hasOnlyThisStat(text, label) {
    const normalized = cleanText(text);
    if (!normalized || normalized.length > 60) return false;
    if (!new RegExp(`(^|\\b)${label}\\b`, "i").test(normalized)) return false;
    if (!/\d/.test(normalized)) return false;

    const otherLabels = ["Friends", "Followers", "Following"].filter((item) => item !== label);
    return !otherLabels.some((item) => new RegExp(`(^|\\b)${item}\\b`, "i").test(normalized));
  }

  function isVisible(element) {
    if (!element || element.id === CARD_ID) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function normalizeToWholePill(element, label) {
    let current = element;

    while (current?.parentElement && current.parentElement !== document.body && current.parentElement !== document.documentElement) {
      const parent = current.parentElement;
      const parentText = cleanText(parent.innerText || parent.textContent);
      const parentRect = parent.getBoundingClientRect();

      if (!isVisible(parent) || !hasOnlyThisStat(parentText, label)) break;
      if (parentRect.width > 320 || parentRect.height > 90) break;

      current = parent;
    }

    return current;
  }

  function findStatPill(label) {
    const rawMatches = Array.from(document.querySelectorAll("a, button, li, div, span"))
      .filter((element) => isVisible(element) && hasOnlyThisStat(element.innerText || element.textContent, label));

    const unique = [];
    for (const match of rawMatches) {
      const pill = normalizeToWholePill(match, label);
      if (!unique.includes(pill)) unique.push(pill);
    }

    unique.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aArea = aRect.width * aRect.height;
      const bArea = bRect.width * bRect.height;
      return bArea - aArea;
    });

    return unique[0] || null;
  }

  function commonAncestor(elements) {
    if (!elements.length) return null;
    const ancestors = [];
    let node = elements[0].parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      ancestors.push(node);
      node = node.parentElement;
    }

    return ancestors.find((candidate) => elements.every((element) => candidate.contains(element))) || null;
  }

  function findStatsRowAndTemplate() {
    const friends = findStatPill("Friends");
    const followers = findStatPill("Followers");
    const following = findStatPill("Following");

    if (!friends || !followers || !following) return null;

    const stats = [friends, followers, following];
    const row = stats.every((element) => element.parentElement === following.parentElement)
      ? following.parentElement
      : commonAncestor(stats);

    if (!row) return null;

    return {
      row,
      template: following,
      insertAfter: following
    };
  }

  function forcePillLook(card, template) {
    const computed = template ? window.getComputedStyle(template) : null;

    card.className = "rsd-profile-rap-pill";
    card.style.setProperty("height", computed?.height && computed.height !== "auto" ? computed.height : "auto", "important");
    card.style.setProperty("padding", computed?.padding && computed.padding !== "0px" ? computed.padding : "7px 16px", "important");
    card.style.setProperty("margin-right", computed?.marginRight || "0", "important");
    card.style.setProperty("border", computed?.border && computed.border !== "0px none rgb(0, 0, 0)" ? computed.border : "0", "important");
    card.style.setProperty("border-radius", computed?.borderRadius && computed.borderRadius !== "0px" ? computed.borderRadius : "9999px", "important");
    const pageIsLight = (() => {
      try {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor || "";
        const m = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return false;
        return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 > 180;
      } catch (error) {
        rsdWarnOnce("profileRap:theme", error);
        return false;
      }
    })();
    const baseBackground = pageIsLight ? FALLBACK_PILL_BG_LIGHT : FALLBACK_PILL_BG;
    const hoverBackground = baseBackground;

    card.dataset.rsdRapBg = baseBackground;
    card.dataset.rsdRapHoverBg = hoverBackground;
    card.style.setProperty("--rsd-rap-bg", baseBackground);
    card.style.setProperty("--rsd-rap-hover-bg", hoverBackground);
    card.style.setProperty("color", pageIsLight ? "rgb(35, 37, 42)" : (computed?.color || "inherit"), "important");
    card.style.setProperty("font-size", computed?.fontSize || "20px", "important");
    card.style.setProperty("font-weight", computed?.fontWeight || "700", "important");
    card.style.setProperty("font-family", computed?.fontFamily || "inherit", "important");
    card.style.setProperty("line-height", computed?.lineHeight || "1", "important");
  }

  function makeRapPill(template) {
    const card = document.createElement("button");
    card.type = "button";
    card.id = CARD_ID;
    card.dataset.rsdStatus = "Loading...";
    forcePillLook(card, template);
    return card;
  }

  function setCardContent(card, valueText) {
    card.textContent = `${valueText} RAP`;
  }

  function positionPanel(card, panel) {
    const rect = card.getBoundingClientRect();
    panel.style.top = `${window.scrollY + rect.bottom + 8}px`;
    panel.style.left = `${window.scrollX + rect.left}px`;
  }

  function ensurePanel(card) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.addEventListener("mouseenter", () => {
        if (hidePanelTimer) {
          clearTimeout(hidePanelTimer);
          hidePanelTimer = null;
        }
      });
      panel.addEventListener("mouseleave", scheduleHidePanel);
      document.body.appendChild(panel);
    }

    positionPanel(card, panel);
    return panel;
  }

  function renderPanel(card, data, statusText) {
    const panel = ensurePanel(card);

    if (!data) {
      panel.innerHTML = `
        <div>Limiteds: —</div>
        <div>Status: ${statusText || "Loading..."}</div>
      `;
      return panel;
    }

    panel.innerHTML = `
      <div>Limiteds: ${data.limiteds ?? "—"}</div>
      <div>Updated: ${data.updatedAt ? formatUpdated(data.updatedAt) : "just now"}</div>
    `;
    return panel;
  }

  let hidePanelTimer = null;

  function showPanel(card) {
    if (hidePanelTimer) {
      clearTimeout(hidePanelTimer);
      hidePanelTimer = null;
    }

    const data = card.__rsdRapData || null;
    const status = card.dataset.rsdStatus || "Loading...";
    const panel = renderPanel(card, data, status);
    panel.style.display = "block";
  }

  function scheduleHidePanel() {
    if (hidePanelTimer) clearTimeout(hidePanelTimer);
    hidePanelTimer = setTimeout(() => {
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.style.display = "none";
    }, 120);
  }

  function hidePanel(event) {
    const panel = document.getElementById(PANEL_ID);
    const card = document.getElementById(CARD_ID);
    if (!panel || panel.style.display === "none") return;
    if (panel.contains(event.target) || card?.contains(event.target)) return;
    panel.style.display = "none";
  }

  function setRapPillHover(card, isHovering) {
    const color = isHovering
      ? (card.dataset.rsdRapHoverBg || FALLBACK_PILL_HOVER_BG)
      : (card.dataset.rsdRapBg || FALLBACK_PILL_BG);

    card.style.setProperty("background", color, "important");
    card.style.setProperty("background-color", color, "important");
  }

  function insertRapCard() {
    const userId = getProfileUserId();
    if (!userId) return;

    if (document.getElementById(CARD_ID)) return;

    const found = findStatsRowAndTemplate();
    if (!found) return;

    const card = makeRapPill(found.template);
    setCardContent(card, "…");

    card.addEventListener("mouseenter", () => {
      card.classList.add("rsd-profile-rap-pill-hover");
      setRapPillHover(card, true);
      showPanel(card);
    });

    card.addEventListener("mouseleave", () => {
      card.classList.remove("rsd-profile-rap-pill-hover");
      setRapPillHover(card, false);
      scheduleHidePanel();
    });

    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentUserId = getProfileUserId();
      if (!currentUserId) return;

      window.open(`https://www.rolimons.com/player/${currentUserId}`, "_blank", "noopener,noreferrer");
    });

    card.addEventListener("focus", () => {
      setRapPillHover(card, true);
      showPanel(card);
    });
    card.addEventListener("blur", () => {
      setRapPillHover(card, false);
      scheduleHidePanel();
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.style.display = "none";
        card.blur();
      }
    });

    found.insertAfter.after(card);

    getRapData(userId, (statusText) => {
      if (activeUserId !== userId || !document.getElementById(CARD_ID)) return;
      card.dataset.rsdStatus = statusText;
      setCardContent(card, "…");

      const panel = document.getElementById(PANEL_ID);
      if (panel && panel.style.display !== "none") {
        renderPanel(card, card.__rsdRapData || null, statusText);
        panel.style.display = "block";
      }
    })
      .then((data) => {
        if (activeUserId !== userId || !document.getElementById(CARD_ID)) return;
        card.__rsdRapData = data;
        card.dataset.rsdStatus = formatUpdated(data.updatedAt);
        setCardContent(card, formatNumber(data.totalRap));

        const panel = document.getElementById(PANEL_ID);
        if (panel && panel.style.display !== "none") {
          renderPanel(card, data, card.dataset.rsdStatus);
          panel.style.display = "block";
        }
      })
      .catch((error) => {
        if (error?.silent) return;

        const status = Number(error?.status) || 0;
        if (status === 403 || status === 401) {
          card.dataset.rsdStatus = "Inventory private";
        } else if (status === 404) {
          card.dataset.rsdStatus = "Inventory unavailable";
        } else {
          card.dataset.rsdStatus = "Unavailable";
        }

        setCardContent(card, "N/A");

        const panel = document.getElementById(PANEL_ID);
        if (panel && panel.style.display !== "none") {
          renderPanel(card, null, card.dataset.rsdStatus);
          panel.style.display = "block";
        }
      });
  }

  function refreshForRoute() {
    const userId = getProfileUserId();
    activeUserId = userId;

    if (!userId) {
      document.getElementById(CARD_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    insertRapCard();
  }

  function scheduleRefresh(delay = 150) {
    if (delay <= 0 && refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = 0;
    }

    if (refreshTimer) return;

    refreshTimer = setTimeout(() => {
      refreshTimer = 0;
      refreshForRoute();
    }, delay);
  }

  function handlePossibleRouteChange() {
    const path = window.location.pathname;
    if (path === lastPath) return;

    lastPath = path;
    document.getElementById(CARD_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();
    scheduleRefresh(0);
  }

  function start() {
    document.addEventListener("click", hidePanel, true);
    window.addEventListener("resize", () => {
      const panel = document.getElementById(PANEL_ID);
      const card = document.getElementById(CARD_ID);
      if (panel && card && panel.style.display !== "none") positionPanel(card, panel);
    });

    const observer = new MutationObserver(() => {
      handlePossibleRouteChange();
      scheduleRefresh(150);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    lastPath = window.location.pathname;
    refreshForRoute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
