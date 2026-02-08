/**
 * File: i18n.js
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

"use strict";

(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : window;

  function t(key, fallback) {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.i18n &&
        typeof chrome.i18n.getMessage === "function"
      ) {
        const msg = chrome.i18n.getMessage(key);
        return msg && msg.length ? msg : fallback || key;
      }
    } catch (_) {}
    return fallback || key;
  }

  g.serversIn_Translated = t("serversIn", "Servers in");
  g.playerCount_Translated = t(
    "playerCount",
    "PLAYING_COUNT / MAX_PLAYERS players",
  );
  g.regionSelector_Translated = t("regionSelector", "Region Selector");
  g.joinButton_Translated = t("joinButton", "Join");
  g.closeButton_Translated = t("closeButton", "Close");
  g.sortPingLowest_Translated = t("sortPingLowest", "Sort: Ping (Lowest)");
  g.sortPlayersHighest_Translated = t(
    "sortPlayersHighest",
    "Sort: Players (Highest)",
  );
  g.sortPlayersLowest_Translated = t(
    "sortPlayersLowest",
    "Sort: Players (Lowest)",
  );
  g.refreshServerList_Translated = t(
    "refreshServerList",
    "Refresh Server List",
  );
  g.loadMoreServers_Translated = t("loadMoreServers", "Load More Servers");
  g.comingEarly2026_Translated = t("comingEarly2026", "Coming early 2026");
  g.serversText_Translated = t("serversText", "SERVER_COUNT server");
  g.serversText_Plural_Translated = t(
    "serversTextPlural",
    "SERVER_COUNT servers",
  );
  g.unknown_Translated = t("unknown", "Unknown");
  g.unknownLocation_Translated = t("unknownLocation", "Unknown Location");
  g.focusOnRegion_Translated = t("focusOnRegion", "Focus on this region");
  g.loading_Translated = t("loading", "Loading...");
  g.loadingServers_Translated = t("loadingServers", "Loading servers...");
  g.errorLoadingServers_Translated = t(
    "errorLoadingServers",
    "Error loading servers. Please try again.",
  );
  g.errorLoadingMore_Translated = t(
    "errorLoadingMore",
    "Error loading more servers",
  );
  g.noPlayersOnline_Translated = t("noPlayersOnline", "No players online");

  try {
    if (g.regionCoordinates && g.regionCoordinates.BR) {
      if (g.regionCoordinates.BR.city === "Coming early 2026") {
        g.regionCoordinates.BR.city =
          g.comingEarly2026_Translated || "Coming early 2026";
      }
    }
  } catch (_) {}
})();
