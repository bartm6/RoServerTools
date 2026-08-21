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
