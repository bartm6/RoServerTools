/**
 * File: friends_serverlist_panel.js
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
  try {
    globalThis.RSD = globalThis.RSD || {};
    RSD.friends_serverlist_panel = RSD.friends_serverlist_panel || {};
    if (typeof RSD.friends_serverlist_panel.createFriendsServerlistPanel === "function") {
      RSD.createFriendsServerlistPanel = RSD.friends_serverlist_panel.createFriendsServerlistPanel;
    }
    if (typeof RSD.friends_serverlist_panel.initFriendsServerlistPanel === "function") {
      RSD.initFriendsServerlistPanel = RSD.friends_serverlist_panel.initFriendsServerlistPanel;
    }

  } catch {}
})();
