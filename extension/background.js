/**
 * FPN (Freedom Private Network) - Extension Background Service Worker
 * Handles Browser-Level SOCKS5 Proxy & Badge Sync
 */

const DEFAULT_PORT = 2080;
const API_BASE = 'http://127.0.0.1:4040';

const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

let isProxyActive = false;
let activeProxyPort = DEFAULT_PORT;

// Firefox / Gecko Native Request-Based Proxy Interceptor
// Works in normal & private windows without requiring special permissions
if (typeof browser !== 'undefined' && browser.proxy && browser.proxy.onRequest) {
    browser.proxy.onRequest.addListener((requestInfo) => {
        if (!isProxyActive) {
            return { type: "direct" };
        }
        try {
            const url = new URL(requestInfo.url);
            // Bypass localhost, 127.0.0.1 and internal FPN backend
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
                return { type: "direct" };
            }
        } catch (e) {}

        return [
            {
                type: "socks",
                host: "127.0.0.1",
                port: activeProxyPort,
                proxyDNS: true
            },
            { type: "direct" }
        ];
    }, { urls: ["<all_urls>"] });
}

// Enable SOCKS5 browser proxy
function enableProxy(port = DEFAULT_PORT) {
    const targetPort = parseInt(port) || DEFAULT_PORT;
    isProxyActive = true;
    activeProxyPort = targetPort;

    // 1. Try Firefox browser.proxy.settings if allowed (fails gracefully without throwing)
    if (typeof browser !== 'undefined' && browser.proxy && browser.proxy.settings) {
        try {
            browser.proxy.settings.set({
                value: {
                    proxyType: "manual",
                    socks: `127.0.0.1:${targetPort}`,
                    socksVersion: 5,
                    proxyDNS: true,
                    passthrough: "localhost, 127.0.0.1, ::1"
                }
            }).catch(() => {});
        } catch (e) {}
    }

    // 2. Chromium chrome.proxy.settings
    if (typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings) {
        const config = {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: "socks5",
                    host: "127.0.0.1",
                    port: targetPort
                },
                bypassList: ["localhost", "127.0.0.1", "::1", "<local>"]
            }
        };

        chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {});
    }

    updateBadge(true);
    browserAPI.storage.local.set({ proxyActive: true, proxyPort: targetPort });
}

// Disable browser proxy (revert to direct)
function disableProxy() {
    isProxyActive = false;

    if (typeof browser !== 'undefined' && browser.proxy && browser.proxy.settings) {
        try {
            browser.proxy.settings.set({ value: { proxyType: "system" } }).catch(() => {});
        } catch (e) {}
    }

    if (typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings) {
        chrome.proxy.settings.set({ value: { mode: "system" }, scope: "regular" }, () => {});
    }

    updateBadge(false);
    browserAPI.storage.local.set({ proxyActive: false });
}

function updateBadge(active) {
    const actionAPI = (typeof chrome !== 'undefined' && chrome.action) 
        ? chrome.action 
        : (typeof browser !== 'undefined' && (browser.action || browser.browserAction));

    if (!actionAPI) return;

    if (active) {
        actionAPI.setBadgeText({ text: "ON" });
        if (actionAPI.setBadgeBackgroundColor) {
            actionAPI.setBadgeBackgroundColor({ color: "#10b981" });
        }
    } else {
        actionAPI.setBadgeText({ text: "" });
    }
}

// Sync proxy state on startup/init
browserAPI.storage.local.get(['proxyActive', 'proxyPort'], (r) => {
    if (r && r.proxyActive) {
        isProxyActive = true;
        if (r.proxyPort) activeProxyPort = r.proxyPort;
        updateBadge(true);
    }
});

// Periodically sync with local FPN desktop backend
async function checkBackendSync() {
    try {
        const res = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.isConnected) {
                isProxyActive = true;
                updateBadge(true);
            } else {
                browserAPI.storage.local.get(['proxyActive'], (r) => {
                    if (!r || !r.proxyActive) {
                        isProxyActive = false;
                        updateBadge(false);
                    }
                });
            }
        }
    } catch (e) {
        // Backend offline
    }
}

chrome.runtime.onInstalled.addListener(() => {
    updateBadge(false);
    checkBackendSync();
});

chrome.runtime.onStartup.addListener(() => {
    checkBackendSync();
});

// Message listener from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ENABLE_PROXY') {
        enableProxy(msg.port || DEFAULT_PORT);
        sendResponse({ success: true });
    } else if (msg.action === 'DISABLE_PROXY') {
        disableProxy();
        sendResponse({ success: true });
    } else if (msg.action === 'CHECK_SYNC') {
        checkBackendSync().then(() => sendResponse({ success: true }));
        return true;
    }
});
