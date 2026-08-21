(() => {
  "use strict";

  const root = globalThis;
  const store = root.RSDDebug || (root.RSDDebug = {});
  const warned = store.warned || (store.warned = new Set());

  function isDebugEnabled() {
    const localDebug = typeof root.localStorage !== "undefined" && root.localStorage?.getItem?.("rsd_debug") === "1";
    const rsdDebug = root.RSD?.utils?.getDebugEnabled?.() === true || root.RSD?.getDebugEnabled?.() === true;
    return root.__RSD_DEBUG__ === true || rsdDebug || localDebug;
  }

  store.warnOnce = store.warnOnce || ((key, error) => {
    if (!isDebugEnabled() || warned.has(key)) return;
    warned.add(key);
    console.warn("[RSD]", key, error);
  });
})();
