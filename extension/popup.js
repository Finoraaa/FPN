/**
 * FPN (Freedom Private Network) - Extension Popup Controller
 * Connects directly to FPN Desktop Backend & Manages Browser Proxy
 */

const API_BASE = 'http://127.0.0.1:4040';

const state = {
    isConnected: false,
    isConnecting: false,
    activeNode: null,
    nodes: [],
    isBackendAlive: false,
    browserProxyActive: false
};

// Toast notification helper
function showToast(msg) {
    let toast = document.getElementById('fpnToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'fpnToast';
        toast.className = 'fpn-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// Safe cross-browser storage and runtime helpers
function getStorage(keys, callback) {
    try {
        const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) 
            ? chrome.storage.local 
            : (typeof browser !== 'undefined' && browser.storage ? browser.storage.local : null);

        if (storageAPI) {
            storageAPI.get(keys, (res) => {
                if (chrome && chrome.runtime && chrome.runtime.lastError) {}
                callback(res || {});
            });
            return;
        }
    } catch (e) {}
    callback({});
}

function sendBgMessage(msg, callback) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage(msg, (response) => {
                if (chrome.runtime.lastError) {}
                if (callback) callback(response);
            });
            return;
        }
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            browser.runtime.sendMessage(msg).then(response => {
                if (callback) callback(response);
            }).catch(() => {
                if (callback) callback();
            });
            return;
        }
    } catch (e) {}
    if (callback) callback();
}

// DOM Elements
const statusCapsule = document.getElementById('statusCapsule');
const capsuleDot = document.getElementById('capsuleDot');
const capsuleText = document.getElementById('capsuleText');

const powerButtonWrap = document.querySelector('.power-button-wrap');
const btnToggleConnect = document.getElementById('btnToggleConnect');
const powerLabel = document.getElementById('powerLabel');

const shieldHeading = document.getElementById('shieldHeading');
const shieldSub = document.getElementById('shieldSub');
const timerBadge = document.getElementById('timerBadge');
const uptimeText = document.getElementById('uptimeText');

const targetFlag = document.getElementById('targetFlag');
const targetName = document.getElementById('targetName');
const targetPing = document.getElementById('targetPing');

const btnOpenServerList = document.getElementById('btnOpenServerList');
const btnSmartConnect = document.getElementById('btnSmartConnect');
const offlineNotice = document.getElementById('offlineNotice');
const btnBrowserOnly = document.getElementById('btnBrowserOnly');

const serverModal = document.getElementById('serverModal');
const btnCloseServerModal = document.getElementById('btnCloseServerModal');
const serverListContainer = document.getElementById('serverListContainer');

let uptimeTimer = null;
let currentUptimeSec = 0;

// Format seconds into HH:MM:SS
function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Update UI States
function updateUI() {
    if (!statusCapsule || !powerButtonWrap) return;

    if (state.isConnecting) {
        statusCapsule.className = 'status-capsule connecting';
        if (capsuleText) capsuleText.innerText = 'BAĞLANILIYOR...';
        powerButtonWrap.className = 'power-button-wrap connecting';
        if (btnToggleConnect) btnToggleConnect.className = 'power-btn connecting';
        if (powerLabel) powerLabel.innerText = 'BEKLEYİN';
        if (shieldHeading) shieldHeading.innerText = 'BAĞLANTI KURULUYOR';
        if (shieldSub) shieldSub.innerText = 'Tünel şifreleniyor, lütfen bekleyin...';
        if (timerBadge) timerBadge.style.display = 'none';
        return;
    }

    if (state.isConnected || state.browserProxyActive) {
        statusCapsule.className = 'status-capsule connected';
        if (capsuleText) capsuleText.innerText = 'GÜVENLİ TÜNEL AKTİF';
        powerButtonWrap.className = 'power-button-wrap connected';
        if (btnToggleConnect) btnToggleConnect.className = 'power-btn connected';
        if (powerLabel) powerLabel.innerText = 'BAĞLI';
        if (shieldHeading) {
            shieldHeading.innerText = 'GÜVENDESİNİZ';
            shieldHeading.style.color = 'var(--accent-emerald)';
        }
        if (shieldSub) {
            shieldSub.innerText = state.isConnected 
                ? 'Tüm sansür kaldırıldı • Tam Hız' 
                : 'Yerel SOCKS5 Proxy devrede';
        }
        if (timerBadge) timerBadge.style.display = state.isConnected ? 'inline-block' : 'none';
    } else {
        statusCapsule.className = 'status-capsule';
        if (capsuleText) {
            capsuleText.innerText = state.isBackendAlive ? 'KORUMA DEVRE DIŞI' : 'MASAÜSTÜ BEKLENİYOR';
        }
        powerButtonWrap.className = 'power-button-wrap';
        if (btnToggleConnect) btnToggleConnect.className = 'power-btn';
        if (powerLabel) {
            powerLabel.innerText = state.isBackendAlive ? 'BAĞLAN' : 'PROXY AÇ';
        }
        if (shieldHeading) {
            shieldHeading.innerText = state.isBackendAlive ? 'GÜVENLİK KAPALI' : 'UYGULAMA KAPALI';
            shieldHeading.style.color = 'var(--text-primary)';
        }
        if (shieldSub) {
            shieldSub.innerText = state.isBackendAlive 
                ? 'Sansürsüz ve güvenli internet için dokunun' 
                : 'Tam VPN için masaüstü uygulamasını başlatın';
        }
        if (timerBadge) timerBadge.style.display = 'none';
    }

    if (state.activeNode) {
        if (targetFlag) targetFlag.innerText = state.activeNode.flag || '🌐';
        if (targetName) targetName.innerText = state.activeNode.name || 'FPN Cloud';
        if (targetPing) {
            if (state.activeNode.ping && state.activeNode.ping > 0) {
                targetPing.innerText = `⚡ ${state.activeNode.ping} ms`;
            } else {
                targetPing.innerText = '⚡ Hızlı';
            }
        }
    }
}

// Fetch Status from FPN Desktop Backend
async function fetchStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${API_BASE}/api/status`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            state.isBackendAlive = true;
            state.isConnected = !!data.isConnected;
            currentUptimeSec = data.uptime || 0;
            if (uptimeText) uptimeText.innerText = formatTime(currentUptimeSec);
            if (data.activeNode) {
                state.activeNode = data.activeNode;
            }
            if (offlineNotice) offlineNotice.style.display = 'none';

            // Also keep browser proxy in sync
            if (state.isConnected) {
                sendBgMessage({ action: 'ENABLE_PROXY' });
            }
        } else {
            handleBackendOffline();
        }
    } catch (e) {
        handleBackendOffline();
    } finally {
        updateUI();
    }
}

function handleBackendOffline() {
    state.isBackendAlive = false;
    if (offlineNotice) offlineNotice.style.display = 'block';

    getStorage(['proxyActive'], (r) => {
        state.browserProxyActive = !!(r && r.proxyActive);
        if (btnBrowserOnly) {
            btnBrowserOnly.innerText = state.browserProxyActive ? 'Yerel Proxy\'yi Kapat' : 'Yerel Proxy\'yi Aç (SOCKS5)';
            btnBrowserOnly.style.background = state.browserProxyActive ? '#f43f5e' : '#fbbf24';
            btnBrowserOnly.style.color = state.browserProxyActive ? '#ffffff' : '#000000';
        }
        updateUI();
    });
}

// Fetch Node List
async function fetchNodes() {
    if (!state.isBackendAlive) return;
    try {
        const res = await fetch(`${API_BASE}/api/nodes`);
        if (res.ok) {
            state.nodes = await res.json();
        }
    } catch (e) {}
}

// Render Server List Drawer
function renderServerList() {
    if (!serverListContainer) return;

    if (!state.nodes || state.nodes.length === 0) {
        serverListContainer.innerHTML = '<div class="loading-nodes">Kayıtlı sunucu bulunamadı.</div>';
        return;
    }

    serverListContainer.innerHTML = '';
    state.nodes.forEach(node => {
        const item = document.createElement('div');
        const isActive = state.activeNode && state.activeNode.id === node.id;
        item.className = `server-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
            <span class="item-flag">${node.flag || '🌐'}</span>
            <span class="item-name">${node.name}</span>
            <span class="item-ping">${node.ping ? `${node.ping} ms` : '⚡'}</span>
        `;
        item.onclick = async () => {
            await selectNode(node);
        };
        serverListContainer.appendChild(item);
    });
}

// Select a Node
async function selectNode(node) {
    state.activeNode = node;
    if (serverModal) serverModal.classList.remove('show');
    updateUI();

    if (state.isBackendAlive) {
        try {
            await fetch(`${API_BASE}/api/nodes/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: node.id })
            });

            if (state.isConnected) {
                state.isConnecting = true;
                updateUI();
                await fetch(`${API_BASE}/api/connect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodeId: node.id })
                });
            }
        } catch (e) {}
        finally {
            state.isConnecting = false;
            await fetchStatus();
        }
    }
}

// Toggle Connection (Main Button)
async function toggleConnect() {
    if (state.isConnecting) return;

    if (state.isBackendAlive) {
        state.isConnecting = true;
        updateUI();

        try {
            if (state.isConnected) {
                await fetch(`${API_BASE}/api/disconnect`, { method: 'POST' });
                sendBgMessage({ action: 'DISABLE_PROXY' });
                state.isConnected = false;
                showToast('VPN bağlantısı kesildi.');
            } else {
                const res = await fetch(`${API_BASE}/api/connect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodeId: state.activeNode ? state.activeNode.id : null })
                });
                const data = await res.json();
                if (data.success) {
                    state.isConnected = true;
                    sendBgMessage({ action: 'ENABLE_PROXY' });
                    showToast('🛡️ Güvenli tünel kuruldu!');
                } else {
                    showToast(data.error || 'Bağlantı kurulamadı.');
                }
            }
        } catch (e) {
            console.error("Bağlantı hatası:", e);
            showToast('FPN çekirdeğine bağlanırken hata oluştu.');
        } finally {
            state.isConnecting = false;
            await fetchStatus();
        }
    } else {
        // Backend offline -> Toggle browser proxy fallback or warn user
        toggleBrowserProxy();
    }
}

// Smart Connect (Lowest Latency Node)
async function handleSmartConnect() {
    if (state.isConnecting) return;
    if (!state.isBackendAlive) {
        showToast('Akıllı bağlan için lütfen masaüstü uygulamasını açın.');
        return;
    }

    state.isConnecting = true;
    updateUI();

    try {
        const res = await fetch(`${API_BASE}/api/connect/smart`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            state.isConnected = true;
            if (data.activeNode) state.activeNode = data.activeNode;
            sendBgMessage({ action: 'ENABLE_PROXY' });
            showToast(`⚡ En hızlı sunucuya bağlandı: ${data.activeNode ? data.activeNode.name : ''}`);
        } else {
            showToast('Uygun sunucu bulunamadı.');
        }
    } catch (e) {
        console.error("Akıllı bağlantı hatası:", e);
        showToast('Akıllı bağlantı sırasında hata oluştu.');
    } finally {
        state.isConnecting = false;
        await fetchStatus();
    }
}

// Toggle Browser-Only SOCKS5 Proxy
function toggleBrowserProxy() {
    getStorage(['proxyActive'], (r) => {
        const willEnable = !(r && r.proxyActive);
        if (willEnable) {
            sendBgMessage({ action: 'ENABLE_PROXY', port: 2080 }, () => {
                state.browserProxyActive = true;
                if (btnBrowserOnly) {
                    btnBrowserOnly.innerText = 'Yerel Proxy\'yi Kapat';
                    btnBrowserOnly.style.background = '#f43f5e';
                    btnBrowserOnly.style.color = '#ffffff';
                }
                updateUI();
                showToast('Yerel SOCKS5 Proxy açıldı (127.0.0.1:2080)');
            });
        } else {
            sendBgMessage({ action: 'DISABLE_PROXY' }, () => {
                state.browserProxyActive = false;
                if (btnBrowserOnly) {
                    btnBrowserOnly.innerText = 'Yerel Proxy\'yi Aç (SOCKS5)';
                    btnBrowserOnly.style.background = '#fbbf24';
                    btnBrowserOnly.style.color = '#000000';
                }
                updateUI();
                showToast('Yerel Proxy devre dışı bırakıldı.');
            });
        }
    });
}

// Event Listeners
if (btnToggleConnect) btnToggleConnect.addEventListener('click', toggleConnect);
if (btnSmartConnect) btnSmartConnect.addEventListener('click', handleSmartConnect);
if (btnBrowserOnly) btnBrowserOnly.addEventListener('click', toggleBrowserProxy);

if (btnOpenServerList) {
    btnOpenServerList.addEventListener('click', async () => {
        if (!state.isBackendAlive) {
            showToast('Sunucu listesi için masaüstü uygulamasını açın.');
            return;
        }
        if (serverModal) serverModal.classList.add('show');
        await fetchNodes();
        renderServerList();
    });
}

if (btnCloseServerModal) {
    btnCloseServerModal.addEventListener('click', () => {
        if (serverModal) serverModal.classList.remove('show');
    });
}

// Periodic Status Polling & Timer
setInterval(() => {
    if (state.isConnected) {
        currentUptimeSec++;
        if (uptimeText) uptimeText.innerText = formatTime(currentUptimeSec);
    }
}, 1000);

// Init on popup open
document.addEventListener('DOMContentLoaded', async () => {
    await fetchStatus();
    await fetchNodes();
    setInterval(fetchStatus, 3000);
});
