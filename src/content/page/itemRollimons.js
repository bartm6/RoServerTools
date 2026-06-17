(() => {
  "use strict";

  const rsdWarnOnce = globalThis.RSDDebug?.warnOnce || (() => {});

  const BUTTON_ID = "rsd-rollimons-item-button";
  const API_CACHE_TTL_MS = 10 * 60 * 1000;
  const API_RETRY_MS = 2500;

  let lastPath = "";
  let refreshTimer = 0;
  const apiCache = new Map();
  const pendingApiRequests = new Set();

  function getMarketplaceItem() {
    let match = window.location.pathname.match(/(?:^|\/)catalog\/(\d+)(?:\/.*)?$/i);
    if (match) return { id: match[1], kind: "asset" };

    match = window.location.pathname.match(/(?:^|\/)bundles\/(\d+)(?:\/.*)?$/i);
    if (match) return { id: match[1], kind: "bundle" };

    return null;
  }

  function itemCacheKey(item) {
    return item ? `${item.kind}:${item.id}` : "";
  }

  function getRollimonsUrl(item) {
    if (!item) return "#";
    return `https://www.rolimons.com/${item.kind === "bundle" ? "bundle" : "item"}/${item.id}`;
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(element) {
    if (!element || element.id === BUTTON_ID) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getSmallText(element) {
    const text = cleanText(element?.innerText || element?.textContent || "");
    return text.length <= 80 ? text : "";
  }

  function findButtonByText(pattern) {
    return Array.from(document.querySelectorAll("button, a, [role=\"button\"]"))
      .find((element) => isVisible(element) && pattern.test(cleanText(element.innerText || element.textContent)));
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

  function findTryOnControls() {
    const tryOn = findButtonByText(/^try on$/i);
    const viewToggle = findButtonByText(/^(?:3d|2d)$/i);

    if (!tryOn) return null;

    let row = null;
    if (viewToggle) {
      row = tryOn.parentElement === viewToggle.parentElement
        ? tryOn.parentElement
        : commonAncestor([tryOn, viewToggle]);
    }

    row = row || tryOn.parentElement;
    if (!row) return null;

    return {
      row,
      template: viewToggle || tryOn,
      insertAfter: viewToggle || tryOn
    };
  }

  function applyButtonLook(button, template) {
    const computed = template ? window.getComputedStyle(template) : null;

    button.className = "rsd-rollimons-item-button";
    button.style.setProperty("height", computed?.height && computed.height !== "auto" ? computed.height : "40px", "important");
    button.style.setProperty("min-height", computed?.minHeight && computed.minHeight !== "0px" ? computed.minHeight : "40px", "important");
    button.style.setProperty("width", computed?.height && computed.height !== "auto" ? computed.height : "40px", "important");
    button.style.setProperty("margin-left", computed?.marginLeft || "8px", "important");
    button.style.setProperty("margin-right", computed?.marginRight || "0", "important");
    button.style.setProperty("border", computed?.border && computed.border !== "0px none rgb(0, 0, 0)" ? computed.border : "0", "important");
    button.style.setProperty("border-radius", computed?.borderRadius && computed.borderRadius !== "0px" ? computed.borderRadius : "8px", "important");
    button.style.setProperty("background", computed?.backgroundColor || "rgb(57, 59, 67)", "important");
    button.style.setProperty("background-color", computed?.backgroundColor || "rgb(57, 59, 67)", "important");
    button.style.setProperty("color", computed?.color || "inherit", "important");
    button.style.setProperty("font-size", computed?.fontSize || "16px", "important");
    button.style.setProperty("font-weight", computed?.fontWeight || "600", "important");
    button.style.setProperty("font-family", computed?.fontFamily || "inherit", "important");
    button.style.setProperty("line-height", computed?.lineHeight || "1", "important");
  }

  function makeRollimonsButton(item, template) {
    const button = document.createElement("a");
    button.id = BUTTON_ID;
    button.href = getRollimonsUrl(item);
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.innerHTML = `
      <svg class="rsd-rollimons-item-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="12" width="3.5" height="7" rx="1"></rect>
        <rect x="10.25" y="7" width="3.5" height="12" rx="1"></rect>
        <rect x="16.5" y="4" width="3.5" height="15" rx="1"></rect>
      </svg>
    `;
    button.setAttribute("aria-label", "Open this item on Rolimon's");
    applyButtonLook(button, template);

    button.addEventListener("click", (event) => {
      const currentItem = getMarketplaceItem();
      if (!currentItem) {
        event.preventDefault();
        return;
      }

      button.href = getRollimonsUrl(currentItem);
    });

    return button;
  }

function extractYesNo(text) {
    const normalized = cleanText(text);
    if (/^yes$/i.test(normalized)) return "yes";
    if (/^no$/i.test(normalized)) return "no";
    return null;
  }

  function isTradableLabelText(text) {
    return /^Tradable\b/i.test(cleanText(text)) && cleanText(text).length <= 35;
  }

  function readValueFromNearbySiblings(label) {
    const siblingCandidates = [];

    if (label.nextElementSibling) siblingCandidates.push(label.nextElementSibling);
    if (label.parentElement) {
      const children = Array.from(label.parentElement.children || []);
      const index = children.indexOf(label);
      if (index >= 0) siblingCandidates.push(...children.slice(index + 1, index + 4));
      if (label.parentElement.nextElementSibling) siblingCandidates.push(label.parentElement.nextElementSibling);
    }

    for (const candidate of siblingCandidates) {
      if (!candidate || !isVisible(candidate)) continue;
      const value = extractYesNo(getSmallText(candidate));
      if (value) return value;
    }

    return null;
  }

  function readValueFromSameRowText(label) {
    let row = label.parentElement;
    for (let depth = 0; row && depth < 3; depth++, row = row.parentElement) {
      if (!row || row === document.body || row === document.documentElement || !isVisible(row)) continue;
      const text = getSmallText(row);
      const match = text.match(/^Tradable\s+(Yes|No)$/i);
      if (match) return match[1].toLowerCase();
    }
    return null;
  }

  function readValueFromGeometry(label) {
    const labelRect = label.getBoundingClientRect();
    if (!labelRect.width || !labelRect.height) return null;

    const labelCenterY = labelRect.top + labelRect.height / 2;
    const candidates = Array.from(document.querySelectorAll("div, span, p, dd, td"))
      .map((element) => {
        if (element === label || !isVisible(element)) return null;
        const value = extractYesNo(getSmallText(element));
        if (!value) return null;

        const rect = element.getBoundingClientRect();
        if (rect.left < labelRect.right - 4) return null;

        const centerY = rect.top + rect.height / 2;
        const yDelta = Math.abs(centerY - labelCenterY);
        if (yDelta > 22) return null;

        return {
          value,
          score: yDelta * 1000 + Math.max(0, rect.left - labelRect.right),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);

    return candidates[0]?.value || null;
  }

  function readTradableValueFromDetails() {
    const labels = Array.from(document.querySelectorAll("div, span, p, label, dt, td"))
      .filter((element) => isVisible(element) && isTradableLabelText(getSmallText(element)));

    for (const label of labels) {
      const value = readValueFromNearbySiblings(label)
        || readValueFromSameRowText(label)
        || readValueFromGeometry(label);

      if (value === "yes" || value === "no") return value;
    }

    return null;
  }

  function isLimitedFromCatalogDetails(data) {
    if (!data || typeof data !== "object") return null;

    const boolFields = [
      "isTradable",
      "IsTradable",
      "isLimited",
      "IsLimited",
      "isLimitedUnique",
      "IsLimitedUnique",
      "isCollectible",
      "IsCollectible",
    ];

    for (const field of boolFields) {
      if (data[field] === true) return true;
    }

    const restrictions = Array.isArray(data.itemRestrictions)
      ? data.itemRestrictions
      : Array.isArray(data.ItemRestrictions)
        ? data.ItemRestrictions
        : [];

    if (restrictions.some((restriction) => /limited|collectible/i.test(String(restriction)))) {
      return true;
    }

    const statusText = cleanText([
      data.itemStatus,
      data.ItemStatus,
      data.status,
      data.Status,
      data.itemTypeDisplayName,
      data.ItemTypeDisplayName,
    ].filter(Boolean).join(" "));

    if (/\b(?:limited|limited\s+u|collectible)\b/i.test(statusText)) return true;

    if (data.collectibleItemId || data.CollectibleItemId || data.collectibleProductId || data.CollectibleProductId) {
      return true;
    }

    for (const field of boolFields) {
      if (data[field] === false) return false;
    }

    return null;
  }

  function requestCatalogDetails(item) {
    const key = itemCacheKey(item);
    if (!key || pendingApiRequests.has(key)) return;

    pendingApiRequests.add(key);

    try {
      chrome.runtime.sendMessage(
        {
          action: "fetchCatalogItemDetails",
          itemKind: item.kind,
          itemId: item.id,
        },
        (response) => {
          pendingApiRequests.delete(key);

          const now = Date.now();
          const limited = response?.success ? isLimitedFromCatalogDetails(response.data) : null;
          apiCache.set(key, {
            status: limited === true ? "show" : limited === false ? "hide" : "unknown",
            timestamp: now,
          });

          scheduleRefresh(0);
        },
      );
    } catch (error) {
      rsdWarnOnce("itemRollimons:catalog", error);
      pendingApiRequests.delete(key);
      apiCache.set(key, { status: "unknown", timestamp: Date.now() });
      scheduleRefresh(API_RETRY_MS);
    }
  }

  function getApiVisibility(item) {
    const key = itemCacheKey(item);
    if (!key) return "wait";

    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < API_CACHE_TTL_MS) {
      return cached.status === "show" || cached.status === "hide" ? cached.status : "wait";
    }

    requestCatalogDetails(item);
    return "wait";
  }

  function getRollimonsButtonVisibility(item) {
    const tradable = readTradableValueFromDetails();

    if (tradable === "yes") return "show";
    if (tradable === "no") return "hide";

    return getApiVisibility(item);
  }

  function insertButton() {
    const item = getMarketplaceItem();
    if (!item) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    const visibility = getRollimonsButtonVisibility(item);
    if (visibility !== "show") {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      existing.href = getRollimonsUrl(item);
      return;
    }

    const controls = findTryOnControls();
    if (!controls) return;

    const button = makeRollimonsButton(item, controls.template);
    controls.insertAfter.after(button);
  }

  function refreshForRoute() {
    const item = getMarketplaceItem();

    if (!item) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }

    insertButton();
  }

  function scheduleRefresh(delay = 100) {
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
    document.getElementById(BUTTON_ID)?.remove();
    scheduleRefresh(0);
  }

  function start() {
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
