/**
 * File: service_worker.js
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
const JOININFO_MAX_INFLIGHT = 12;
const JOININFO_MAX_QUEUE = 300;
const JOININFO_TIMEOUT_MS = 8000;
const BAD_SERVER_TTL_MS = 60_000;
let joinInfoInFlight = 0;
let joinInfoBlockedUntil = 0;
let joinInfoQueue = [];
let csrfToken = null;

function enqueueJoinInfoJob(job) {
  while (joinInfoQueue.length >= JOININFO_MAX_QUEUE) {
    const dropped = joinInfoQueue.shift();
    try {
      const e = new Error("Join-info queue overflow: dropped oldest request");
      e.status = 503;
      dropped?.reject?.(e);
    } catch (_) {
    }
  }
  joinInfoQueue.push(job);
}
const badServers = new Map();

function badServerKey(placeId, serverId) {
  return `${placeId}:${serverId}`;
}

function isServerTemporarilyBad(placeId, serverId) {
  const key = badServerKey(placeId, serverId);
  const exp = badServers.get(key);
  if (!exp) return false;
  if (Date.now() > exp) {
    badServers.delete(key);
    return false;
  }
  return true;
}

function markServerTemporarilyBad(placeId, serverId) {
  badServers.set(badServerKey(placeId, serverId), Date.now() + BAD_SERVER_TTL_MS);
}
const JOININFO_UA_RULE_ID = 1001;
let joinInfoUaRefCount = 0;
let joinInfoUaRuleEnabled = false;
let joinInfoUaDisableTimer = null;

async function cleanupJoinInfoUserAgentRule() {
  try {
    if (chrome?.declarativeNetRequest?.updateDynamicRules) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [JOININFO_UA_RULE_ID],
      });
    }
  } catch (_) {
  } finally {
    joinInfoUaRuleEnabled = false;
    joinInfoUaRefCount = 0;
    if (joinInfoUaDisableTimer) {
      clearTimeout(joinInfoUaDisableTimer);
      joinInfoUaDisableTimer = null;
    }
  }
}

async function enableJoinInfoUserAgentRule() {
  if (joinInfoUaRuleEnabled) return;
  if (!chrome?.declarativeNetRequest?.updateDynamicRules) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [JOININFO_UA_RULE_ID],
      addRules: [
        {
          id: JOININFO_UA_RULE_ID,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { header: "User-Agent", operation: "set", value: "Roblox/WinInet" },
            ],
          },
          condition: {
            requestDomains: ["gamejoin.roblox.com"],
            urlFilter: "/v1/join-game-instance",
            resourceTypes: ["xmlhttprequest"],
          },
        },
      ],
    });
    joinInfoUaRuleEnabled = true;
  } catch (_) {
  }
}

async function disableJoinInfoUserAgentRule() {
  if (!joinInfoUaRuleEnabled) return;
  if (!chrome?.declarativeNetRequest?.updateDynamicRules) return;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [JOININFO_UA_RULE_ID],
    });
  } catch (_) {
  } finally {
    joinInfoUaRuleEnabled = false;
  }
}

async function acquireJoinInfoUserAgent() {
  if (!chrome?.declarativeNetRequest?.updateDynamicRules) {
    const e = new Error(
      "Missing permission: declarativeNetRequest (Compatibility Join) is required for join-info requests",
    );
    e.status = 403;
    throw e;
  }
  joinInfoUaRefCount++;
  if (joinInfoUaDisableTimer) {
    clearTimeout(joinInfoUaDisableTimer);
    joinInfoUaDisableTimer = null;
  }
  if (joinInfoUaRefCount === 1) {
    await enableJoinInfoUserAgentRule();
  }
}

function releaseJoinInfoUserAgent() {
  joinInfoUaRefCount = Math.max(0, joinInfoUaRefCount - 1);
  if (joinInfoUaRefCount > 0) return;
  if (joinInfoInFlight > 0) return;
  if (joinInfoQueue.length > 0) return;

  if (joinInfoUaDisableTimer) return;
  joinInfoUaDisableTimer = setTimeout(() => {
    joinInfoUaDisableTimer = null;
    if (joinInfoUaRefCount === 0 && joinInfoInFlight === 0 && joinInfoQueue.length === 0) {
      disableJoinInfoUserAgentRule().catch(() => {});
    }
  }, 800);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchWithTimeout(url, options = {}, timeoutMs = JOININFO_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}
async function getCsrfToken() {
  return csrfToken || null;
}

async function doJoinInfoFetch(placeId, serverId) {
  let csrfRetry = 0;
  const MAX_CSRF_RETRIES = 1;
  let retry429 = 0;
  const MAX_429_RETRIES = 2;

  while (true) {
    const token = await getCsrfToken();

    await acquireJoinInfoUserAgent();

    let resp;
    try {
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { "X-Csrf-Token": token } : {}),
      };

      resp = await fetchWithTimeout(
        "https://gamejoin.roblox.com/v1/join-game-instance",
        {
          method: "POST",
          credentials: "include",
          headers: {
            ...headers,
          },
          body: JSON.stringify({
            placeId: parseInt(placeId, 10),
            isTeleport: false,
            gameId: serverId,
            gameJoinAttemptId: crypto.randomUUID(),
          }),
        },
        JOININFO_TIMEOUT_MS,
      );
    } catch (e) {
      if (e?.name === "AbortError" || e instanceof TypeError) {
        markServerTemporarilyBad(placeId, serverId);
      }
      throw e;
    } finally {
      releaseJoinInfoUserAgent();
    }
    if (resp?.status === 403 && csrfRetry < MAX_CSRF_RETRIES) {
      const newToken = resp.headers.get("x-csrf-token");
      if (newToken) {
        csrfToken = newToken;
        csrfRetry++;
        continue;
      }
    }

    if (resp.status === 429 && retry429 < MAX_429_RETRIES) {
      const backoffMs = 1200 + Math.random() * 1800;
      joinInfoBlockedUntil = Date.now() + backoffMs;
      retry429++;
      await sleep(backoffMs);
      continue;
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const e = new Error(`join-game-instance failed: ${resp.status}`);
      e.status = resp.status;
      e.body = errText;
      throw e;
    }

    const data = await resp.json();
    if (!data || typeof data !== "object" || !data.joinScript || typeof data.joinScript !== "object") {
      const e = new Error("Unexpected join-info response");
      e.status = 502;
      throw e;
    }
    return data;
  }
}

async function pumpJoinInfoQueue() {
  while (joinInfoInFlight < JOININFO_MAX_INFLIGHT && joinInfoQueue.length > 0) {
    const now = Date.now();
    if (now < joinInfoBlockedUntil) {
      const waitMs = joinInfoBlockedUntil - now;
      await sleep(waitMs);
      continue;
    }

    const job = joinInfoQueue.shift();
    if (!job) return;
    if (isServerTemporarilyBad(job.placeId, job.serverId)) {
      try {
        const e = new Error("Server temporarily skipped (recent timeout/failure)");
        e.status = 504;
        job.reject(e);
      } catch (_) {}
      continue;
    }

    joinInfoInFlight++;

    (async () => {
      try {
        const data = await doJoinInfoFetch(job.placeId, job.serverId);
        job.resolve(data);
      } catch (e) {
        job.reject(e);
      } finally {
        joinInfoInFlight--;
        pumpJoinInfoQueue().catch(() => {});
      }
    })();
  }
}

function isAllowedSender(sender) {
  const url = sender?.url || sender?.tab?.url || "";
  return /^https:\/\/www\.roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/\d+/.test(
    url,
  );
}

// Ensure no DNR rules persist across crashes/restarts.
try {
  chrome.runtime.onInstalled?.addListener(() => {
    cleanupJoinInfoUserAgentRule().catch(() => {});
  });
  chrome.runtime.onStartup?.addListener(() => {
    cleanupJoinInfoUserAgentRule().catch(() => {});
  });
  chrome.runtime.onSuspend?.addListener(() => {
    cleanupJoinInfoUserAgentRule().catch(() => {});
  });
} catch (_) {
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || typeof message !== "object") return;

      if (message.action === "joinGameInstance") {
        if (!isAllowedSender(sender))
          return sendResponse?.({
            success: false,
            error: "Blocked: sender not allowed",
          });
        const tabId = sender?.tab?.id;
        const placeId = String(message.placeId || "");
        const serverId = String(message.serverId || "");
        if (!tabId || !placeId || !serverId)
          return sendResponse?.({
            success: false,
            error: "Missing tabId/placeId/serverId",
          });

        chrome.scripting.executeScript(
          {
            target: { tabId },
            world: "MAIN",
            func: (pid, sid) => {
              try {
                const GL = globalThis.Roblox?.GameLauncher;
                if (GL?.joinGameInstance) {
                  GL.joinGameInstance(pid, sid);
                } else {
                  console.warn(
                    "[RoServerTools] Roblox.GameLauncher.joinGameInstance not available",
                  );
                }
              } catch (e) {
                console.error("[RoServerTools] joinGameInstance failed", e);
              }
            },
            args: [placeId, serverId],
          },
          () => {
            const err = chrome.runtime.lastError;
            if (err) sendResponse?.({ success: false, error: err.message });
            else sendResponse?.({ success: true });
          },
        );
        return;
      }

      if (message.action === "fetchJoinInfo") {
        if (!isAllowedSender(sender))
          return sendResponse?.({
            success: false,
            error: "Blocked: sender not allowed",
          });

        const placeId = String(message.placeId || "");
        const serverId = String(message.serverId || "");
        if (!placeId || !serverId)
          return sendResponse?.({
            success: false,
            error: "Missing placeId/serverId",
          });

        if (isServerTemporarilyBad(placeId, serverId)) {
          return sendResponse?.({
            success: false,
            error: "Server temporarily skipped (recent timeout/failure)",
            status: 504,
          });
        }
        const p = new Promise((resolve, reject) => {
          enqueueJoinInfoJob({ placeId, serverId, resolve, reject });
        });
        pumpJoinInfoQueue().catch(() => {});

        try {
          const data = await p;
          return sendResponse?.({ success: true, data });
        } catch (e) {
          return sendResponse?.({
            success: false,
            error: String(e?.message || e),
            status: e?.status,
          });
        }
      }
    } catch (e) {
      return sendResponse?.({ success: false, error: String(e?.message || e) });
    }
  })();

  return true;
});
