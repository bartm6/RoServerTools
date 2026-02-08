/**
 * File: theme.js
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

  function createTheme(env) {
    async function detectThemeAPI() {
      const theme = document.body.classList.contains("dark-theme")
        ? "dark"
        : "light";
      env.setCurrentTheme(theme);
      return theme;
    }

    async function applyTheme() {
      await detectThemeAPI();
    }

    return { detectThemeAPI, applyTheme };
  }

  function initTheme(ctx) {
    ctx.theme = ctx.theme || {};
  }

  globalThis.RSD.createTheme = createTheme;
  globalThis.RSD.initTheme = initTheme;
})();
