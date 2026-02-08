/**
 * File: utils.js
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
  function formatFriendsBadge(count) {
    if (!count || count <= 0) return "";
    return count > 5 ? "5+" : String(count);
  }

  function parsePlayersTextToCounts(text) {
    if (!text) return { playing: "?", maxPlayers: "?" };
    const m = String(text).match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (!m) return { playing: "?", maxPlayers: "?" };
    return { playing: Number(m[1]), maxPlayers: Number(m[2]) };
  }

  function getFriendsIconUrl() {
    try {
      return typeof chrome !== "undefined" && chrome?.runtime?.getURL
        ? chrome.runtime.getURL("assets/icons/friends_wave.png")
        : "";
    } catch {
      return "";
    }
  }

  function renderFriendsButtonIcon(totalFriendsCount) {
    const badge = formatFriendsBadge(totalFriendsCount);
    const iconUrl = getFriendsIconUrl();

    return `
            <span class="rsd-friends-iconwrap">
              ${iconUrl ? `<img class="rsd-friends-icon" src="${iconUrl}" alt="Friends"/>` : ""}
              ${badge ? `<span class="rsd-friends-badge">${badge}</span>` : ""}
            </span>
          `;
  }

  RSD.friends_serverlist_panel.utils = {
    formatFriendsBadge,
    parsePlayersTextToCounts,
    getFriendsIconUrl,
    renderFriendsButtonIcon,
  };
})();
