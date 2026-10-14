/**
 * ====================================================================
 *  FPN (Freedom Private Network) - Frontend Controller
 * ====================================================================
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:4040' : '';

let appState = {
    isConnected: false,
    uptime: 0,
    activeNodeId: null,
    nodes: [],
    settings: {},
    isConnecting: false,
    uptimeTimer: null,
    qrCodeInstance: null
};

// DOM Elements
const btnToggleConnect = document.getElementById('btnToggleConnect');
const powerButtonContainer = document.querySelector('.power-button-container');
const btnStatusLabel = document.getElementById('btnStatusLabel');
const shieldHeading = document.getElementById('shieldHeading');
const shieldSub = document.getElementById('shieldSub');
const timerPill = document.getElementById('timerPill');
const uptimeCounter = document.getElementById('uptimeCounter');
const sidebarDot = document.getElementById('sidebarDot');
const sidebarStatusText = document.getElementById('sidebarStatusText');
const headerPingVal = document.getElementById('headerPingVal');
const headerPingBadge = document.getElementById('headerPingBadge');
const selectActiveNode = document.getElementById('selectActiveNode');
const metricDownSpeed = document.getElementById('metricDownSpeed');
const metricUpSpeed = document.getElementById('metricUpSpeed');
const metricTotalDown = document.getElementById('metricTotalDown');
const metricTotalUp = document.getElementById('metricTotalUp');
const nodesListContainer = document.getElementById('nodesListContainer');
const vlessLinkInput = document.getElementById('vlessLinkInput');
const terminalOutput = document.getElementById('terminalOutput');
const toastNotification = document.getElementById('toastNotification');

// Tabs
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetPanel = document.getElementById('panel' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    const targetBtn = document.getElementById('tabBtn' + tabId.charAt(0).toUpperCase() + tabId.slice(1));

    if (targetPanel) targetPanel.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    const topHeader = document.getElementById('topHeader');
    if (topHeader) {
        topHeader.style.display = tabId === 'dashboard' ? 'none' : 'flex';
    }

    const titles = {
        dashboard: { title: "Ana Ekran", desc: "Bağlantı & Güvenlik Kontrolü" },
        nodes: { title: "Sunucular & Düğümler", desc: "Cloudflare Workers veya VLESS çıkış noktalarınızı yönetin ve test edin" },
        speedtest: { title: "Dahili Hız Testi", desc: "Cloudflare CDN omurgası üzerinden gerçek indirme hızı ve gecikmeyi ölçün" },
        mobile: { title: "Mobil Cihaza Aktar (QR)", desc: "Telefonunuzla QR kodu okutarak Android veya iPhone'da tek tıkla bağlanın" },
        donate: { title: "Geliştiriciye Destek & Bağış (donatr.ee)", desc: "FPN'in tamamen ücretsiz, sınırsız ve sansürsüz kalmasına katkıda bulunun" },
        settings: { title: "Sansür Koruması & Ayarlar", desc: "DNS over HTTPS, portlar ve Türkiye bölünmüş tünel kurallarını yapılandırın" },
        logs: { title: "Canlı Konsol Kayıtları", desc: "sing-box çekirdeğinin gerçek zamanlı ağ ve tünel etkinlikleri" }
    };

    if (titles[tabId] && document.getElementById('currentSectionTitle')) {
        document.getElementById('currentSectionTitle').innerText = titles[tabId].title;
        document.getElementById('currentSectionDesc').innerText = titles[tabId].desc;
    }

    if (tabId === 'mobile') {
        renderMobileQr();
    } else if (tabId === 'logs') {
        fetchLogs();
        if (window.logPollInterval) clearInterval(window.logPollInterval);
        window.logPollInterval = setInterval(fetchLogs, 1500);
    } else if (tabId === 'settings') {
        fetchSettings();
        checkTunStatus();
    }

    if (tabId !== 'logs' && window.logPollInterval) {
        clearInterval(window.logPollInterval);
        window.logPollInterval = null;
    }
}

function switchMobileSubTab(subTab) {
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));

    if (subTab === 'android') {
        document.querySelector('.sub-tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('subTabAndroid').classList.add('active');
    } else {
        document.querySelector('.sub-tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('subTabIos').classList.add('active');
    }
}

// Toast
function showToast(msg) {
    toastNotification.innerText = msg;
    toastNotification.classList.add('show');
    setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3500);
}

// Copy external IP
function copyExternalIp() {
    const el = document.getElementById('labelCurrentIp');
    const card = document.getElementById('cardExternalIp');
    const ip = el ? el.innerText.trim() : '';
    if (ip && ip !== 'Yükleniyor...' && ip !== 'Bilinmiyor') {
        navigator.clipboard.writeText(ip).then(() => {
            showToast("📋 Dış IP adresi panoya kopyalandı: " + ip);
            if (card) {
                card.style.transform = "scale(0.97)";
                setTimeout(() => card.style.transform = "", 200);
            }
        }).catch(() => {
            showToast("IP: " + ip);
        });
    }
}

// Formatters
function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec < 1024) return `${(bytesPerSec || 0).toFixed(1)} <small>B/s</small>`;
    const kb = bytesPerSec / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} <small>KB/s</small>`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} <small>MB/s</small>`;
}

function formatBytes(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
}

function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Target Display Helper
function updateDashboardTargetDisplay(node) {
    if (!node) return;
    const labelCurrentCountry = document.getElementById('labelCurrentCountry');
    const labelCountryFlag = document.getElementById('labelCountryFlag');
    const dashTargetFlag = document.getElementById('dashTargetFlag');
    const dashTargetName = document.getElementById('dashTargetName');
    const dashQuickPing = document.getElementById('dashQuickPing');
    const dashProtocol = document.getElementById('dashProtocol');
    const dashLatency = document.getElementById('dashLatency');
    const dashSplitTunnel = document.getElementById('dashSplitTunnel');
    const shieldSub = document.getElementById('shieldSub');

    const flag = node.country ? node.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';
    const cName = node.country ? node.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : 'Global Edge';

    if (labelCountryFlag) labelCountryFlag.innerText = flag;
    if (labelCurrentCountry) labelCurrentCountry.innerText = cName;
    if (dashTargetFlag) dashTargetFlag.innerText = flag;
    if (dashTargetName) dashTargetName.innerText = node.name || 'FPN Cloud';

    const pingStr = node.ping && node.ping > 0 ? `${node.ping} ms` : (node.ping === -1 ? 'Zaman aşımı' : '-- ms');
    if (dashQuickPing) {
        dashQuickPing.innerText = `⚡ ${pingStr}`;
        dashQuickPing.style.color = getPingColor(node.ping);
    }
    if (dashLatency) {
        dashLatency.innerText = pingStr;
        dashLatency.style.color = getPingColor(node.ping);
    }

    if (dashProtocol) {
        if (node.type === 'wireguard') {
            dashProtocol.innerText = 'WireGuard Edge';
        } else if (node.security === 'reality') {
            dashProtocol.innerText = 'VLESS Reality (XTLS)';
        } else if (node.transport === 'ws') {
            dashProtocol.innerText = 'VLESS WebSocket (TLS)';
        } else {
            dashProtocol.innerText = 'VLESS Protocol';
        }
    }

    if (dashSplitTunnel) {
        dashSplitTunnel.innerText = appState.settings.bypassTurkey !== false ? 'Aktif (TR Doğrudan)' : 'Tümü Tünelde';
    }

    if (!appState.isConnected && shieldSub && !appState.isConnecting) {
        shieldSub.innerText = `Seçili Hedef: ${node.name} • Bağlanmak için butona tıklayın`;
    }
}

// Connect to a specific node
async function connectToNode(nodeId) {
    if (appState.isConnecting) return;
    appState.isConnecting = true;

    const targetId = nodeId || appState.activeNodeId;
    const node = appState.nodes.find(n => n.id === targetId) || appState.nodes[0];
    const nodeName = node ? node.name : 'Sunucu';
    const countryName = node && node.country ? node.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : '';

    const statusCapsuleBadge = document.getElementById('statusCapsuleBadge');
    const statusBadgeText = document.getElementById('statusBadgeText');
    if (statusCapsuleBadge) statusCapsuleBadge.className = 'status-capsule-badge connecting';
    if (statusBadgeText) statusBadgeText.innerText = 'BAĞLANTI KURULUYOR...';

    if (btnStatusLabel) btnStatusLabel.innerText = "BAĞLANIYOR...";
    if (btnToggleConnect) {
        btnToggleConnect.classList.remove('connected');
        btnToggleConnect.classList.add('connecting');
    }
    if (powerButtonContainer) {
        powerButtonContainer.classList.remove('connected');
        powerButtonContainer.classList.add('connecting');
    }
    if (shieldHeading) {
        shieldHeading.innerText = "BAĞLANTI KURULUYOR...";
        shieldHeading.style.color = "var(--text-primary)";
    }
    if (shieldSub) {
        shieldSub.innerText = `${nodeName} tüneline bağlanılıyor...`;
    }
    showToast(`🔄 ${countryName || nodeName} sunucusuna bağlanılıyor...`);

    try {
        const res = await fetch(API_BASE + '/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId: node ? node.id : targetId })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ ${countryName || nodeName} çıkışına başarıyla bağlanıldı!`);
        } else {
            showToast("Bağlantı hatası: " + (data.error || "Sunucuya ulaşılamadı"));
        }
    } catch (e) {
        showToast("Bağlantı hatası: " + e.message);
    } finally {
        if (btnToggleConnect) btnToggleConnect.classList.remove('connecting');
        if (powerButtonContainer) powerButtonContainer.classList.remove('connecting');
        appState.isConnecting = false;
        await fetchStatus();
        setTimeout(fetchIpInfo, 800);
        setTimeout(fetchIpInfo, 2500);
    }
}

// Disconnect
async function disconnectVpn() {
    if (appState.isConnecting) return;
    appState.isConnecting = true;
    if (btnStatusLabel) btnStatusLabel.innerText = "KESİLİYOR...";
    try {
        const res = await fetch(API_BASE + '/api/disconnect', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast("Bağlantı başarıyla sonlandırıldı.");
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    } finally {
        appState.isConnecting = false;
        await fetchStatus();
        await fetchIpInfo();
    }
}

// VPN Toggle (Main button)
async function toggleConnect() {
    if (appState.isConnecting) return;

    if (appState.isConnected) {
        await disconnectVpn();
    } else {
        await connectToNode(appState.activeNodeId);
    }
}

// Fetch Status
async function fetchStatus() {
    try {
        const res = await fetch(API_BASE + '/api/status');
        const data = await res.json();

        appState.isConnected = data.isConnected;
        appState.uptime = data.uptime;
        if (data.activeNode) {
            appState.activeNodeId = data.activeNode.id;
            updateDashboardTargetDisplay(data.activeNode);
        }

        updateUIStatus(data);
    } catch (e) {
        console.error("Status fetch error:", e);
    }
}

async function fetchIpInfo() {
    try {
        const res = await fetch(API_BASE + '/api/ip-info');
        const data = await res.json();
        
        const labelCurrentIp = document.getElementById('labelCurrentIp');
        const labelCurrentCountry = document.getElementById('labelCurrentCountry');
        const labelCountryFlag = document.getElementById('labelCountryFlag');
        const cardExternalIp = document.getElementById('cardExternalIp');
        const cardCountry = document.getElementById('cardCountry');
        
        if (data.currentIp && labelCurrentIp) {
            labelCurrentIp.innerText = data.currentIp;
        }

        const activeNode = appState.nodes.find(n => n.id === appState.activeNodeId);
        const nodeCountry = activeNode && activeNode.country ? activeNode.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : '';
        const nodeFlag = activeNode && activeNode.country ? activeNode.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';

        if (labelCurrentCountry) {
            if (data.isConnected) {
                labelCurrentCountry.innerText = data.country || nodeCountry || 'Güvenli Tünel';
            } else {
                labelCurrentCountry.innerText = data.targetCountry || nodeCountry || 'Seçiniz';
            }
        }

        if (labelCountryFlag) {
            if (data.isConnected) {
                labelCountryFlag.innerText = data.flag || nodeFlag || '🌐';
            } else {
                labelCountryFlag.innerText = data.targetFlag || nodeFlag || '🌐';
            }
        }

        if (cardExternalIp && cardCountry) {
            if (data.isConnected) {
                cardExternalIp.classList.add('connected');
                cardCountry.classList.add('connected');
            } else {
                cardExternalIp.classList.remove('connected');
                cardCountry.classList.remove('connected');
            }
        }
    } catch (e) {
        console.error("IP info fetch error:", e);
    }
}

function updateUIStatus(data) {
    const labelCountryCardHeader = document.getElementById('labelCountryCardHeader');
    const statusCapsuleBadge = document.getElementById('statusCapsuleBadge');
    const statusBadgeText = document.getElementById('statusBadgeText');
    const dashDownSpeed = document.getElementById('dashDownSpeed');
    const dashUpSpeed = document.getElementById('dashUpSpeed');

    if (data.isConnected) {
        if (statusCapsuleBadge) statusCapsuleBadge.className = 'status-capsule-badge connected';
        if (statusBadgeText) statusBadgeText.innerText = 'KORUMA AKTİF & GÜVENLİ';

        if (labelCountryCardHeader) labelCountryCardHeader.innerText = "BAĞLANILAN ÜLKE";
        if (btnToggleConnect) {
            btnToggleConnect.classList.remove('connecting');
            btnToggleConnect.classList.add('connected');
        }
        if (powerButtonContainer) {
            powerButtonContainer.classList.remove('connecting');
            powerButtonContainer.classList.add('connected');
        }
        if (btnStatusLabel) btnStatusLabel.innerText = "BAĞLI";
        if (shieldHeading) {
            shieldHeading.innerText = "GÜVENDESİNİZ & KORUMA AKTİF";
            shieldHeading.style.color = "var(--accent-emerald)";
        }
        if (shieldSub) {
            shieldSub.innerText = `Aktif Çıkış: ${data.activeNode ? data.activeNode.name : 'Cloudflare Edge'}`;
        }
        if (timerPill) timerPill.style.display = "inline-flex";
        if (uptimeCounter) uptimeCounter.innerText = formatTime(data.uptime);

        if (sidebarDot) sidebarDot.classList.add('connected');
        if (sidebarStatusText) {
            sidebarStatusText.innerText = "Koruma Aktif";
            sidebarStatusText.style.color = "var(--accent-emerald)";
        }

        // Live speeds
        const downStr = formatSpeed(data.stats?.downSpeed);
        const upStr = formatSpeed(data.stats?.upSpeed);
        if (dashDownSpeed) dashDownSpeed.innerHTML = downStr;
        if (dashUpSpeed) dashUpSpeed.innerHTML = upStr;
        if (metricDownSpeed) metricDownSpeed.innerHTML = downStr;
        if (metricUpSpeed) metricUpSpeed.innerHTML = upStr;
        if (metricTotalDown) metricTotalDown.innerText = formatBytes(data.stats?.totalDown);
        if (metricTotalUp) metricTotalUp.innerText = formatBytes(data.stats?.totalUp);
    } else {
        if (statusCapsuleBadge) {
            statusCapsuleBadge.className = appState.isConnecting ? 'status-capsule-badge connecting' : 'status-capsule-badge';
        }
        if (statusBadgeText) {
            statusBadgeText.innerText = appState.isConnecting ? 'BAĞLANTI KURULUYOR...' : 'KORUMA DEVRE DIŞI';
        }

        if (labelCountryCardHeader) labelCountryCardHeader.innerText = "HEDEF ÇIKIŞ ÜLKESİ";
        if (btnToggleConnect) {
            btnToggleConnect.classList.remove('connected');
            if (!appState.isConnecting) btnToggleConnect.classList.remove('connecting');
        }
        if (powerButtonContainer) {
            powerButtonContainer.classList.remove('connected');
            if (!appState.isConnecting) powerButtonContainer.classList.remove('connecting');
        }
        if (!appState.isConnecting && btnStatusLabel) btnStatusLabel.innerText = "BAĞLAN";
        if (shieldHeading && !appState.isConnecting) {
            shieldHeading.innerText = "GÜVENLİK KAPALI";
            shieldHeading.style.color = "var(--text-primary)";
        }
        if (shieldSub && !appState.isConnecting) {
            shieldSub.innerText = data.activeNode ? `Seçili Hedef: ${data.activeNode.name} • Bağlanmak için butona tıklayın` : "Güvenli ve sansürsüz internet için butona tıklayın";
        }
        if (timerPill) timerPill.style.display = "none";

        if (sidebarDot) sidebarDot.classList.remove('connected');
        if (sidebarStatusText) {
            sidebarStatusText.innerText = "Bağlı Değil";
            sidebarStatusText.style.color = "var(--text-muted)";
        }

        if (dashDownSpeed) dashDownSpeed.innerHTML = `0.0 KB/s`;
        if (dashUpSpeed) dashUpSpeed.innerHTML = `0.0 KB/s`;
        if (metricDownSpeed) metricDownSpeed.innerHTML = `0.0 <small>KB/s</small>`;
        if (metricUpSpeed) metricUpSpeed.innerHTML = `0.0 <small>KB/s</small>`;
    }
}

// Fetch Nodes
async function fetchNodes() {
    try {
        const res = await fetch(API_BASE + '/api/nodes');
        appState.nodes = await res.json();
        renderNodesUI();
        renderCountryPickerModal();
    } catch (e) {
        console.error("Nodes fetch error:", e);
    }
}

// Country Filter and Search State
let currentCountryFilter = 'all';

function setCountryFilter(countryCode) {
    currentCountryFilter = countryCode;
    renderNodesUI();
}

function filterNodesList() {
    renderNodesUI();
}

function getProtocolBadge(node) {
    if (node.type === 'wireguard') return '<span class="proto-tag proto-wg">WireGuard</span>';
    if (node.security === 'reality') return '<span class="proto-tag proto-reality">VLESS Reality</span>';
    if (node.transport === 'ws') return '<span class="proto-tag proto-ws">VLESS WS</span>';
    return '<span class="proto-tag proto-vless">VLESS</span>';
}

function getPingColor(ping) {
    if (!ping || ping <= 0) return 'var(--text-muted)';
    if (ping < 100) return 'var(--accent-emerald)';
    if (ping < 220) return '#f59e0b';
    return 'var(--accent-danger)';
}

function renderNodesUI() {
    // 1. Populate Country Filter Chips in Nodes Tab
    const chipsContainer = document.getElementById('nodeFilterChips');
    if (chipsContainer) {
        const countryCounts = {};
        appState.nodes.forEach(n => {
            const cc = n.countryCode || 'GL';
            const flag = n.country ? n.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';
            const cName = n.country ? n.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : 'Diğer';
            if (!countryCounts[cc]) {
                countryCounts[cc] = { count: 0, flag, name: cName };
            }
            countryCounts[cc].count++;
        });

        let chipsHtml = `<button class="filter-chip ${currentCountryFilter === 'all' ? 'active' : ''}" onclick="setCountryFilter('all')">Tümü (${appState.nodes.length})</button>`;
        for (const [code, info] of Object.entries(countryCounts)) {
            chipsHtml += `<button class="filter-chip ${currentCountryFilter === code ? 'active' : ''}" onclick="setCountryFilter('${code}')">${info.flag} ${info.name} (${info.count})</button>`;
        }
        chipsContainer.innerHTML = chipsHtml;
    }

    // 2. Filter Nodes List
    const searchInput = document.getElementById('nodeSearchInput');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredNodes = appState.nodes.filter(node => {
        const matchesCountry = currentCountryFilter === 'all' || (node.countryCode || 'GL') === currentCountryFilter;
        const matchesSearch = !searchVal || 
            (node.name && node.name.toLowerCase().includes(searchVal)) ||
            (node.server && node.server.toLowerCase().includes(searchVal)) ||
            (node.country && node.country.toLowerCase().includes(searchVal));
        return matchesCountry && matchesSearch;
    });

    // 3. Render Node Cards
    if (nodesListContainer) {
        if (filteredNodes.length === 0) {
            nodesListContainer.innerHTML = `
                <div class="empty-nodes-state">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">🔍</span>
                    <h4>Arama kriterine uygun sunucu bulunamadı</h4>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">Farklı bir arama yapabilir veya yukarıdaki butonlardan açık kaynak havuzundan yeni sunucular çekebilirsiniz.</p>
                </div>
            `;
            return;
        }

        nodesListContainer.innerHTML = '';
        filteredNodes.forEach(node => {
            const isCurrent = node.id === appState.activeNodeId;
            const flag = node.country ? node.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';
            const countryName = node.country ? node.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : 'Global Edge';
            const pingText = node.ping && node.ping > 0 ? `${node.ping} ms` : (node.ping === -1 ? 'Zaman aşımı' : '-- ms');

            const card = document.createElement('div');
            card.className = `node-card ${isCurrent ? 'active' : ''}`;
            card.innerHTML = `
                <div class="node-card-left">
                    <div class="node-icon-globe">${flag}</div>
                    <div class="node-details">
                        <div class="node-title-row">
                            <h4>${node.name}</h4>
                            ${isCurrent ? '<span class="badge-active-tag">✔ Aktif Çıkış</span>' : ''}
                            ${getProtocolBadge(node)}
                        </div>
                        <div class="node-meta">
                            <span><b>Ülke:</b> ${countryName}</span>
                            <span><b>Sunucu:</b> ${node.server}:${node.port}</span>
                            ${node.useCleanIp ? `<span style="color:var(--accent-emerald);">Clean IP: ${node.cleanIp}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="node-card-right">
                    <span class="node-ping-tag" id="ping-${node.id}" style="color: ${getPingColor(node.ping)}">${pingText}</span>
                    <button class="btn-sm btn-ping-single" onclick="testNodePing('${node.id}')" title="Gecikmeyi Test Et">⚡ Test</button>
                    <button class="btn-sm ${isCurrent && appState.isConnected ? 'btn-active-node' : ''}" onclick="selectNodeAndConnect('${node.id}')">
                        ${isCurrent && appState.isConnected ? '✔ Bağlı' : (isCurrent ? '⚡ Şimdi Bağlan' : 'Bağlan')}
                    </button>
                    <button class="btn-sm" onclick="editNode('${node.id}')">Düzenle</button>
                    ${appState.nodes.length > 1 ? `<button class="btn-sm btn-delete-node" onclick="deleteNode('${node.id}')">Sil</button>` : ''}
                </div>
            `;
            nodesListContainer.appendChild(card);
        });
    }
}

// -------------------------------------------------------------
// Country Picker Modal (Ana Ekrandan Hızlı Ülke Değiştirme)
// -------------------------------------------------------------
let countryPickerFilter = 'all';

function openCountryPickerModal() {
    const modal = document.getElementById('modalCountryPicker');
    if (modal) modal.style.display = 'flex';
    renderCountryPickerModal();
}

function closeCountryPickerModal() {
    const modal = document.getElementById('modalCountryPicker');
    if (modal) modal.style.display = 'none';
}

function filterCountryPickerList() {
    renderCountryPickerModal();
}

function renderCountryPickerModal() {
    const container = document.getElementById('countryPickerList');
    if (!container) return;

    const searchInput = document.getElementById('countryPickerSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = appState.nodes.filter(node => {
        return !searchVal ||
            (node.name && node.name.toLowerCase().includes(searchVal)) ||
            (node.server && node.server.toLowerCase().includes(searchVal)) ||
            (node.country && node.country.toLowerCase().includes(searchVal));
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
                <span>🌐</span>
                <p>Eşleşen ülke veya sunucu bulunamadı.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    filtered.forEach(node => {
        const isCurrent = node.id === appState.activeNodeId;
        const flag = node.country ? node.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';
        const countryName = node.country ? node.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : 'Global Edge';
        const pingText = node.ping && node.ping > 0 ? `${node.ping} ms` : (node.ping === -1 ? 'Timeout' : '-- ms');

        const row = document.createElement('div');
        row.className = `country-picker-item ${isCurrent ? 'selected' : ''}`;
        row.onclick = () => selectNodeAndConnect(node.id);
        row.innerHTML = `
            <div class="c-item-left">
                <span class="c-flag">${flag}</span>
                <div class="c-info">
                    <strong class="c-name">${countryName}</strong>
                    <span class="c-node-name">${node.name}</span>
                </div>
            </div>
            <div class="c-item-right">
                ${getProtocolBadge(node)}
                <span class="c-ping" style="color: ${getPingColor(node.ping)}">${pingText}</span>
                <button class="btn-sm ${isCurrent && appState.isConnected ? 'btn-active-node' : 'btn-select-country'}" onclick="event.stopPropagation(); selectNodeAndConnect('${node.id}')">
                    ${isCurrent && appState.isConnected ? '✔ Bağlı' : (isCurrent ? '⚡ Şimdi Bağlan' : 'Seç & Bağlan')}
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

async function selectNodeAndConnect(nodeId) {
    if (appState.isConnecting) {
        showToast("Lütfen önceki işlemin tamamlanmasını bekleyin...");
        return;
    }

    const node = appState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    appState.activeNodeId = nodeId;
    closeCountryPickerModal();

    // Hemen UI'da seçimi göster
    updateDashboardTargetDisplay(node);
    renderNodesUI();
    renderCountryPickerModal();
    renderMobileQr();

    // Backend'e seçimi bildir
    try {
        await fetch(API_BASE + '/api/nodes/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId })
        });
    } catch (e) {}

    // Ana ekrana geç ki kullanıcı bağlantı animasyonunu ve durumunu görsün
    switchTab('dashboard');

    // Doğrudan bağlan
    await connectToNode(nodeId);
}

function selectNodeAsActive(nodeId) {
    selectNodeAndConnect(nodeId);
}

function changeActiveNode(nodeId) {
    selectNodeAndConnect(nodeId);
}

// -------------------------------------------------------------
// Toplu Ping Testi & Havuzdan Çekme & VLESS İçe Aktarma
// -------------------------------------------------------------
async function testAllNodesPing() {
    showToast("⚡ Tüm sunucuların gecikme süreleri ölçülüyor...");
    const btn = document.getElementById('btnTestAllNodes');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(API_BASE + '/api/test-all-nodes', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.nodes) {
            appState.nodes = data.nodes;
            renderNodesUI();
            renderCountryPickerModal();
            showToast("✅ Tüm sunucuların ping testi tamamlandı.");
        }
    } catch (e) {
        showToast("Ping testi hatası: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function fetchCommunityNodes() {
    showToast("🌐 Açık kaynak havuzundan ücretsiz VLESS sunucuları taranıyor...");
    const btn = document.getElementById('btnFetchCommunity');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(API_BASE + '/api/nodes/fetch-community', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            await fetchNodes();
            showToast(`✅ Açık kaynak havuzundan ${data.addedCount} yeni aktif sunucu eklendi! Toplam: ${data.totalNodes}`);
        } else {
            showToast("Havuzdan çekilemedi: " + (data.error || 'Hata'));
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openImportVlessModal() {
    const modal = document.getElementById('modalImportVless');
    if (modal) modal.style.display = 'flex';
}

function closeImportVlessModal() {
    const modal = document.getElementById('modalImportVless');
    if (modal) modal.style.display = 'none';
}

async function submitImportVless(e) {
    e.preventDefault();
    const textarea = document.getElementById('importVlessTextarea');
    const text = textarea ? textarea.value.trim() : '';
    if (!text) return;

    const btn = document.getElementById('btnSubmitImport');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(API_BASE + '/api/nodes/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.success) {
            closeImportVlessModal();
            if (textarea) textarea.value = '';
            await fetchNodes();
            showToast(`✅ ${data.addedCount} adet VLESS sunucu içeri aktarıldı!`);
        } else {
            showToast("İçe aktarma hatası: " + (data.error || 'Geçersiz bağlantı'));
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Tekil Ping Testi
async function testNodePing(nodeId) {
    const pingTag = document.getElementById(`ping-${nodeId}`);
    if (pingTag) pingTag.innerText = "Ölçülüyor...";

    try {
        const res = await fetch(API_BASE + '/api/test-node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: nodeId })
        });
        const data = await res.json();
        if (data.success) {
            const node = appState.nodes.find(n => n.id === nodeId);
            if (node) node.ping = data.latency;
            if (pingTag) {
                pingTag.innerText = `${data.latency} ms`;
                pingTag.style.color = getPingColor(data.latency);
            }
            if (nodeId === appState.activeNodeId) {
                if (headerPingVal) headerPingVal.innerText = `Ping: ${data.latency} ms`;
                if (headerPingBadge) headerPingBadge.className = `header-badge ping-badge ${data.latency < 120 ? 'good' : data.latency < 250 ? 'fair' : 'poor'}`;
            }
        } else {
            if (pingTag) {
                pingTag.innerText = "Başarısız";
                pingTag.style.color = "var(--accent-danger)";
            }
        }
    } catch (e) {
        if (pingTag) pingTag.innerText = "Hata";
    }
}

function testCurrentNodePing() {
    if (appState.activeNodeId) testNodePing(appState.activeNodeId);
}

// Mobile QR Code
async function renderMobileQr() {
    try {
        const activeId = appState.activeNodeId || (appState.nodes[0] ? appState.nodes[0].id : '');
        const res = await fetch(API_BASE + `/api/vless-uri?id=${activeId}`);
        const data = await res.json();

        if (data.uri && vlessLinkInput) {
            vlessLinkInput.value = data.uri;
            const qrBox = document.getElementById('desktopQrCode');
            if (qrBox) {
                qrBox.innerHTML = '';
                new QRCode(qrBox, {
                    text: data.uri,
                    width: 220,
                    height: 220,
                    colorDark: "#0a0e17",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }
    } catch (e) {
        console.error("QR Render error:", e);
    }
}

function copyVlessLink() {
    if (!vlessLinkInput) return;
    vlessLinkInput.select();
    navigator.clipboard.writeText(vlessLinkInput.value).then(() => {
        showToast("📋 VLESS bağlantısı panoya kopyalandı! Mobil uygulamanıza yapıştırabilirsiniz.");
    });
}

// Settings
async function fetchSettings() {
    try {
        const res = await fetch(API_BASE + '/api/settings');
        appState.settings = await res.json();

        const sMixed = document.getElementById('settingMixedPort');
        if (sMixed) sMixed.value = appState.settings.mixedPort || 2080;
        const sClash = document.getElementById('settingClashApiPort');
        if (sClash) sClash.value = appState.settings.clashApiPort || 9090;
        const sDns = document.getElementById('settingDnsServer');
        if (sDns) sDns.value = appState.settings.dnsServer || "https://1.1.1.1/dns-query";
        const sAuto = document.getElementById('settingAutoProxy');
        if (sAuto) sAuto.checked = appState.settings.autoSetSystemProxy !== false;
        const sBypass = document.getElementById('settingBypassTr');
        if (sBypass) sBypass.checked = appState.settings.bypassTurkey !== false;
        const sBlockAds = document.getElementById('settingBlockAds');
        if (sBlockAds) sBlockAds.checked = appState.settings.blockAds !== false;
        const sAutoFailover = document.getElementById('settingAutoFailover');
        if (sAutoFailover) sAutoFailover.checked = appState.settings.autoFailover !== false;
        const chkQuick = document.getElementById('chkQuickBypassTr');
        if (chkQuick) chkQuick.checked = appState.settings.bypassTurkey !== false;
    } catch (e) {
        console.error("Settings fetch error:", e);
    }
}

async function saveSettingsForm(e) {
    e.preventDefault();
    const updated = {
        mixedPort: parseInt(document.getElementById('settingMixedPort').value),
        clashApiPort: parseInt(document.getElementById('settingClashApiPort').value),
        dnsServer: document.getElementById('settingDnsServer').value,
        autoSetSystemProxy: document.getElementById('settingAutoProxy').checked,
        bypassTurkey: document.getElementById('settingBypassTr').checked,
        blockAds: document.getElementById('settingBlockAds') ? document.getElementById('settingBlockAds').checked : true,
        autoFailover: document.getElementById('settingAutoFailover') ? document.getElementById('settingAutoFailover').checked : true
    };

    try {
        const res = await fetch(API_BASE + '/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
        const data = await res.json();
        if (data.success) {
            showToast("Ayarlar başarıyla kaydedildi.");
            fetchSettings();
        }
    } catch (e) {
        showToast("Ayar kaydetme hatası: " + e.message);
    }
}

async function toggleBypassTurkey(checked) {
    appState.settings.bypassTurkey = checked;
    await fetch(API_BASE + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appState.settings)
    });
    showToast(checked ? "Türkiye Bölünmüş Tünel Açık (Yerel siteler doğrudan bağlanır)" : "Tüm trafik VPN üzerinden yönlendirilecek");
}

async function toggleCleanIp(checked) {
    const node = appState.nodes.find(n => n.id === appState.activeNodeId);
    if (node) {
        node.useCleanIp = checked;
        await fetch(API_BASE + '/api/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(node)
        });
        renderNodesUI();
        renderMobileQr();
        showToast(checked ? "Clean IP (Temiz IP) modu aktif edildi." : "Standart alan adı modu aktif.");
    }
}

// Logs
async function fetchLogs() {
    try {
        const res = await fetch(API_BASE + '/api/logs');
        const data = await res.json();
        if (data.logs && data.logs.length) {
            terminalOutput.innerText = data.logs.join('\n');
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        } else {
            terminalOutput.innerText = "FPN konsolu hazır. Henüz bir etkinlik kaydedilmedi.\nBağlan butonuna basarak tüneli başlatabilirsiniz.";
        }
    } catch (e) {
        terminalOutput.innerText = `Konsol bağlantı hatası: ${e.message}`;
    }
}

async function clearLogs() {
    terminalOutput.innerText = "Konsol temizlendi.";
    try {
        await fetch(API_BASE + '/api/logs', { method: 'DELETE' });
    } catch (e) {}
}

// Modal Node Form
function openAddNodeModal() {
    document.getElementById('modalNodeTitle').innerText = "Yeni Sunucu Ekle";
    document.getElementById('nodeFormId').value = "";
    document.getElementById('nodeFormName').value = "";
    document.getElementById('nodeFormServer').value = "";
    document.getElementById('nodeFormUuid').value = "d342d11e-d424-4583-b36e-524ab1f0afa4";
    document.getElementById('nodeFormPort').value = "443";
    document.getElementById('nodeFormCleanIp').value = "104.16.132.229";
    document.getElementById('nodeFormUseCleanIp').checked = false;
    document.getElementById('modalAddNode').style.display = "flex";
}

function editNode(nodeId) {
    const node = appState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    document.getElementById('modalNodeTitle').innerText = "Sunucuyu Düzenle";
    document.getElementById('nodeFormId').value = node.id;
    document.getElementById('nodeFormName').value = node.name;
    document.getElementById('nodeFormServer').value = node.server;
    document.getElementById('nodeFormUuid').value = node.uuid;
    document.getElementById('nodeFormPort').value = node.port;
    document.getElementById('nodeFormCleanIp').value = node.cleanIp || "";
    document.getElementById('nodeFormUseCleanIp').checked = !!node.useCleanIp;
    document.getElementById('modalAddNode').style.display = "flex";
}

function closeAddNodeModal() {
    document.getElementById('modalAddNode').style.display = "none";
}

async function saveNodeForm(e) {
    e.preventDefault();
    const id = document.getElementById('nodeFormId').value || 'node-' + Date.now();
    const nodeData = {
        id,
        name: document.getElementById('nodeFormName').value,
        server: document.getElementById('nodeFormServer').value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        uuid: document.getElementById('nodeFormUuid').value.trim(),
        port: parseInt(document.getElementById('nodeFormPort').value) || 443,
        cleanIp: document.getElementById('nodeFormCleanIp').value.trim(),
        useCleanIp: document.getElementById('nodeFormUseCleanIp').checked,
        path: '/',
        tls: true,
        sni: document.getElementById('nodeFormServer').value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        country: '🌐 Cloud'
    };

    try {
        const res = await fetch(API_BASE + '/api/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nodeData)
        });
        const data = await res.json();
        if (data.success) {
            closeAddNodeModal();
            showToast("Sunucu başarıyla kaydedildi.");
            fetchNodes();
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    }
}

async function deleteNode(nodeId) {
    if (!confirm("Bu sunucuyu silmek istediğinize emin misiniz?")) return;
    try {
        const res = await fetch(API_BASE + `/api/nodes/${nodeId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast("Sunucu silindi.");
            fetchNodes();
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    }
}

// TUN Mode Management
async function checkTunStatus() {
    try {
        const res = await fetch(API_BASE + '/api/tun/status');
        const data = await res.json();
        const chk = document.getElementById('settingTunMode');
        const capText = document.getElementById('tunCapText');
        const btnGrant = document.getElementById('btnGrantTunCap');

        if (chk) chk.checked = !!data.tunMode;

        if (data.hasCapability) {
            if (capText) capText.innerHTML = '<span style="color:var(--accent-emerald); font-weight: 600;">✔ Linux Kernel TUN Yetkisi Mevcut (Hazır)</span>';
            if (btnGrant) btnGrant.style.display = 'none';
        } else {
            if (capText) capText.innerHTML = '<span style="color:#f59e0b; font-weight: 600;">⚠️ Kernel TUN yetkisi gerekiyor (Tek seferlik)</span>';
            if (btnGrant) btnGrant.style.display = 'inline-block';
        }
    } catch (e) {}
}

async function grantTunCapability() {
    showToast("🔑 Yönetici şifresi ekranı açılıyor (Polkit)...");
    const btn = document.getElementById('btnGrantTunCap');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(API_BASE + '/api/tun/enable', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast("✅ TUN Modu başarıyla yetkilendirildi ve aktif edildi!");
            await checkTunStatus();
            await fetchStatus();
            setTimeout(fetchIpInfo, 2500);
        } else {
            showToast("Hata: " + (data.error || "Yetkilendirilemedi"));
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function toggleTunMode(checked) {
    try {
        const res = await fetch(API_BASE + '/api/tun/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tunMode: checked })
        });
        const data = await res.json();
        showToast(checked ? "🛡️ Tam Sistem VPN (TUN) aktif edildi." : "🌐 Proxy moduna geçildi.");
        await checkTunStatus();
        await fetchStatus();
        setTimeout(fetchIpInfo, 2500);
    } catch (e) {
        showToast("Hata: " + e.message);
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    fetchSettings();
    checkTunStatus();
    fetchIpInfo();
    fetchNodes().then(() => {
        fetchStatus();
        testCurrentNodePing();
    });

    // Polling intervals
    setInterval(fetchStatus, 1500);
    setInterval(fetchIpInfo, 5000);
    setTimeout(checkForAppUpdates, 2000);
});

// Donate Functions
function copyDonateLink() {
    const linkInput = document.getElementById('donateLinkInput');
    const url = linkInput ? linkInput.value : 'https://donatr.ee/fnora/';
    navigator.clipboard.writeText(url).then(() => {
        showToast("💖 Bağış linki kopyalandı! Tarayıcınızda açıp destek olabilirsiniz.");
    }).catch(() => {
        showToast("Bağlantı: https://donatr.ee/fnora/");
    });
}

function openDonateBrowser(e) {
    if (e && e.preventDefault) e.preventDefault();
    const url = 'https://donatr.ee/fnora/';
    fetch(API_BASE + '/api/open-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    }).catch(() => {});
    window.open(url, '_blank');
}

// -------------------------------------------------------------
// Speedtest
// -------------------------------------------------------------
async function startSpeedTest() {
    const btn = document.getElementById('btnRunSpeedTest');
    const elMbps = document.getElementById('stDownloadMbps');
    const elMBps = document.getElementById('stDownloadMBps');
    const elPing = document.getElementById('stPing');
    const elDur = document.getElementById('stDuration');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Test Yapılıyor (İndiriliyor)...</span>';
    }
    if (elMbps) elMbps.innerText = '...';
    if (elMBps) elMBps.innerText = 'Hesaplanıyor...';
    if (elPing) elPing.innerText = '...';

    showToast("⚡ Cloudflare Edge üzerinden hız testi başladı...");

    try {
        const res = await fetch(API_BASE + '/api/speedtest', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            if (elMbps) elMbps.innerText = data.speedMbps;
            if (elMBps) elMBps.innerText = `${data.speedMBps} MB/s`;
            if (elPing) elPing.innerText = data.ping;
            if (elDur) elDur.innerText = `${data.duration} sn (${(data.bytes / (1024*1024)).toFixed(1)} MB)`;
            showToast(`✅ Hız Testi Tamamlandı: ${data.speedMbps} Mbps`);
        } else {
            showToast("Hız testi başarısız: " + (data.error || 'Bilinmeyen hata'));
        }
    } catch (e) {
        showToast("Hız testi bağlantı hatası: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>🚀 Hız Testini Tekrar Başlat</span>';
        }
    }
}

// -------------------------------------------------------------
// Network Doctor (Ağ Doktoru / Acil Kurtarma)
// -------------------------------------------------------------
async function triggerNetworkDoctor() {
    if (!confirm("Ağ ayarları ve proxy sıfırlanıp tünel sonlandırılacak. Onaylıyor musunuz?")) return;
    showToast("🩺 Ağ Doktoru ayarları sıfırlıyor...");
    try {
        const res = await fetch(API_BASE + '/api/network-doctor', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast("✅ Ağ ve proxy ayarları temizlendi. İnternetiniz normal duruma döndü.");
            await fetchStatus();
            await fetchIpInfo();
        } else {
            showToast("Hata: " + data.message);
        }
    } catch (e) {
        showToast("Ağ Doktoru hatası: " + e.message);
    }
}

// -------------------------------------------------------------
// Leak Test (Sızıntı Kontrolü)
// -------------------------------------------------------------
async function openLeakTestModal() {
    const modal = document.getElementById('modalLeakTest');
    if (modal) modal.style.display = 'flex';

    const flagEl = document.getElementById('leakFlagEmoji');
    const ipEl = document.getElementById('leakPublicIp');
    const summaryEl = document.getElementById('leakSummaryBox');

    if (ipEl) ipEl.innerText = "Doğrulanıyor...";
    if (summaryEl) summaryEl.innerHTML = "DNS ve dış IP sızıntı analizi yapılıyor...";

    try {
        const res = await fetch(API_BASE + '/api/leak-test');
        const data = await res.json();
        if (data.success) {
            if (flagEl) flagEl.innerText = data.flag || '🌐';
            if (ipEl) ipEl.innerText = `${data.publicIp} (${data.country})`;
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <div><b>🔒 DNS Durumu:</b> ${data.dnsSecure ? '<span style="color:#10b981;">Şifreli (Cloudflare DoH - Sızıntı Yok)</span>' : '<span style="color:#f43f5e;">Yerel ISS (Şifresiz)</span>'}</div>
                        <div><b>🛡️ WebRTC:</b> <span style="color:#10b981;">Korumalı (Gerçek IP sızıntısı engellendi)</span></div>
                        <div style="margin-top:4px; font-size:0.85rem; color:var(--text-muted);">${data.summary}</div>
                    </div>
                `;
            }
        }
    } catch (e) {
        if (ipEl) ipEl.innerText = "Hata";
        if (summaryEl) summaryEl.innerText = "Bağlantı hatası: " + e.message;
    }
}

function closeLeakTestModal() {
    const modal = document.getElementById('modalLeakTest');
    if (modal) modal.style.display = 'none';
}

// -------------------------------------------------------------
// Clean IP Scanner
// -------------------------------------------------------------
function openCleanIpScannerModal() {
    const modal = document.getElementById('modalCleanIpScanner');
    if (modal) modal.style.display = 'flex';
    scanCleanIpsAction();
}

function closeCleanIpScannerModal() {
    const modal = document.getElementById('modalCleanIpScanner');
    if (modal) modal.style.display = 'none';
}

async function scanCleanIpsAction() {
    const btn = document.getElementById('btnStartCleanIpScan');
    const statusEl = document.getElementById('cleanIpScanStatus');
    const listEl = document.getElementById('cleanIpResultsList');

    if (btn) btn.disabled = true;
    if (statusEl) statusEl.innerText = "⚡ Cloudflare Anycast IP'leri taranıyor...";
    if (listEl) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">Taranıyor, lütfen bekleyin...</div>';
    }

    try {
        const res = await fetch(API_BASE + '/api/scan-clean-ips', { method: 'POST' });
        const data = await res.json();
        if (data.success && listEl) {
            listEl.innerHTML = '';
            const healthyList = data.ips.filter(ip => ip.healthy);
            if (statusEl) statusEl.innerText = `✅ ${healthyList.length} adet sansürsüz ve hızlı Clean IP bulundu.`;

            data.ips.forEach(item => {
                const row = document.createElement('div');
                row.className = 'node-card';
                row.style.padding = '12px 16px';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:1.3rem;">⚡</span>
                        <div>
                            <strong style="color:#fff; font-size:0.95rem;">${item.ip}</strong>
                            <span style="display:block; font-size:0.75rem; color:var(--text-muted);">${item.remark}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-weight:700; color:${item.healthy ? '#10b981' : '#f43f5e'}; font-size:0.85rem;">
                            ${item.healthy ? item.latency + ' ms' : 'Erişilemez'}
                        </span>
                        ${item.healthy ? `<button class="btn-sm btn-primary" onclick="applyCleanIpToActive('${item.ip}')">Bu IP'yi Uygula</button>` : ''}
                    </div>
                `;
                listEl.appendChild(row);
            });
        }
    } catch (e) {
        if (statusEl) statusEl.innerText = "Tarama hatası: " + e.message;
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function applyCleanIpToActive(cleanIp) {
    try {
        const res = await fetch(API_BASE + '/api/nodes/apply-clean-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cleanIp, nodeId: appState.activeNodeId })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Clean IP (${cleanIp}) aktif sunucuya uygulandı!`);
            closeCleanIpScannerModal();
            await fetchNodes();
            await fetchIpInfo();
        } else {
            showToast("Hata: " + (data.error || 'IP uygulanamadı'));
        }
    } catch (e) {
        showToast("Hata: " + e.message);
    }
}

// -------------------------------------------------------------
// Subscription Import (Abonelik Linki)
// -------------------------------------------------------------
function openImportSubModal() {
    const modal = document.getElementById('modalImportSub');
    if (modal) modal.style.display = 'flex';
}

function closeImportSubModal() {
    const modal = document.getElementById('modalImportSub');
    if (modal) modal.style.display = 'none';
}

async function submitImportSub(e) {
    e.preventDefault();
    const input = document.getElementById('importSubUrlInput');
    const url = input ? input.value.trim() : '';
    if (!url) return;

    const btn = document.getElementById('btnSubmitSubImport');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "İndiriliyor...";
    }

    try {
        const res = await fetch(API_BASE + '/api/nodes/import-sub', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Abonelikten ${data.addedCount} yeni sunucu başarıyla eklendi!`);
            closeImportSubModal();
            input.value = '';
            await fetchNodes();
        } else {
            showToast("Abonelik hatası: " + (data.error || 'İndirilemedi'));
        }
    } catch (err) {
        showToast("Hata: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "📥 Sunucuları İndir";
        }
    }
}

// Modal Dismiss Controls (Escape Key & Backdrop Click)
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (typeof closeAddNodeModal === 'function') closeAddNodeModal();
        if (typeof closeCountryPickerModal === 'function') closeCountryPickerModal();
        if (typeof closeImportVlessModal === 'function') closeImportVlessModal();
        if (typeof closeImportSubModal === 'function') closeImportSubModal();
        if (typeof closeCleanIpScannerModal === 'function') closeCleanIpScannerModal();
        if (typeof closeLeakTestModal === 'function') closeLeakTestModal();
    }
});

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// ====================================================================
// In-App Auto-Updater Logic
// ====================================================================
let updatePollTimer = null;
let currentAppUpdate = null;

async function checkForAppUpdates() {
    try {
        const res = await fetch(API_BASE + '/api/check-updates');
        const data = await res.json();
        if (data.hasUpdate && data.latestVersion) {
            currentAppUpdate = data;
            const banner = document.getElementById('updateBanner');
            const title = document.getElementById('updateBannerTitle');
            const sub = document.getElementById('updateBannerSubtitle');
            if (banner && title) {
                title.innerText = `🚀 Yeni FPN Sürümü Mevcut: v${data.latestVersion}`;
                if (sub && data.releaseNotes) {
                    sub.innerText = data.releaseNotes.split('\n')[0] || "Performans ve güvenlik güncellemelerini almak için tek tıkla geçiş yapın.";
                }
                banner.style.display = 'flex';
            }
        }
    } catch (e) {
        console.log("Güncelleme kontrolü atlandı:", e.message);
    }
}

async function triggerUpdateFlow() {
    const btn = document.getElementById('btnUpdateCta');
    const btnText = document.getElementById('btnUpdateCtaText');
    const progressWrap = document.getElementById('updateProgressWrap');
    const progressFill = document.getElementById('updateProgressFill');
    const progressLabel = document.getElementById('updateProgressLabel');

    if (!btn || !btnText) return;

    // If ready to install, perform restart
    if (btn.classList.contains('ready')) {
        btn.disabled = true;
        btnText.innerText = "Yeniden Başlatılıyor...";
        showToast("🚀 FPN yeni sürüme güncelleniyor, uygulama yeniden başlatılıyor...", "success");
        try {
            await fetch(API_BASE + '/api/install-update', { method: 'POST' });
        } catch (e) {}
        return;
    }

    // Start download
    btn.disabled = true;
    btnText.innerText = "İndirme Başlatılıyor...";
    if (progressWrap) progressWrap.style.display = 'flex';

    try {
        const res = await fetch(API_BASE + '/api/download-update', { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || "İndirme başlatılamadı.");
        }

        // Start polling progress
        if (updatePollTimer) clearInterval(updatePollTimer);
        updatePollTimer = setInterval(async () => {
            try {
                const sRes = await fetch(API_BASE + '/api/update-status');
                const status = await sRes.json();

                if (status.percent !== undefined) {
                    if (progressFill) progressFill.style.width = status.percent + '%';
                    if (progressLabel) progressLabel.innerText = `İndiriliyor: %${status.percent}`;
                    btnText.innerText = `İndiriliyor: %${status.percent}`;
                }

                if (status.readyToInstall) {
                    clearInterval(updatePollTimer);
                    updatePollTimer = null;
                    if (progressWrap) progressWrap.style.display = 'none';
                    btn.disabled = false;
                    btn.classList.add('ready');
                    btnText.innerText = "🔄 Şimdi Yeniden Başlat";
                    showToast("✅ Güncelleme hazır! Şimdi Yeniden Başlat butonuna basarak güncel sürüme geçebilirsiniz.", "success");
                } else if (status.error) {
                    clearInterval(updatePollTimer);
                    updatePollTimer = null;
                    btn.disabled = false;
                    btnText.innerText = "Tekrar Dene";
                    showToast("İndirme hatası: " + status.error, "error");
                }
            } catch (e) {}
        }, 500);

    } catch (err) {
        btn.disabled = false;
        btnText.innerText = "Tek Tıkla Güncelle";
        showToast("Güncelleme hatası: " + err.message, "error");
    }
}

function dismissUpdateBanner() {
    const banner = document.getElementById('updateBanner');
    if (banner) banner.style.display = 'none';
}



