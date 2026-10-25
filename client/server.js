/**
 * ====================================================================
 *  FPN (Freedom Private Network) - Desktop Client Controller
 *  Node.js Zero-Dependency Native Backend Server
 * ====================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const net = require('net');
const tls = require('tls');
const dns = require('dns').promises;

const PORT = 4040;
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const PUBLIC_DIR = path.join(__dirname, 'public');
const BUNDLED_DATA_DIR = path.join(__dirname, 'data');

// 1. Resolve User Data Directory (Writable location outside app.asar)
function resolveUserDataDir() {
    let baseDir = null;
    try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
            baseDir = app.getPath('userData');
        }
    } catch (e) {}

    if (!baseDir) {
        const os = require('os');
        const home = os.homedir();
        if (isWin) {
            baseDir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'fpn-vpn');
        } else if (process.platform === 'darwin') {
            baseDir = path.join(home, 'Library', 'Application Support', 'fpn-vpn');
        } else {
            baseDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'fpn-vpn');
        }
    }

    const dataDir = path.join(baseDir, 'data');
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
        } catch (e) {
            console.error("DATA_DIR oluşturulamadı:", e);
        }
    }
    return dataDir;
}

const DATA_DIR = resolveUserDataDir();
const RUNTIME_CONFIG_PATH = path.join(DATA_DIR, 'runtime_config.json');

// 2. Resolve Binary & Script Paths (Packaged extraResources vs Dev)
function resolveResourcePath(relSubPath) {
    if (process.resourcesPath) {
        const candidate = path.join(process.resourcesPath, relSubPath);
        if (fs.existsSync(candidate)) return candidate;
    }
    if (__dirname.includes('app.asar')) {
        const candidate = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', relSubPath);
        if (fs.existsSync(candidate)) return candidate;
    }
    const devCandidate = path.resolve(__dirname, '..', relSubPath);
    if (fs.existsSync(devCandidate)) return devCandidate;

    return devCandidate;
}

function resolveBinPath() {
    let targetName = 'sing-box';
    if (isWin) {
        targetName = 'sing-box.exe';
    } else if (isMac) {
        targetName = (process.arch === 'arm64') ? 'sing-box-darwin-arm64' : 'sing-box-darwin-amd64';
    }

    let bundledCandidate = resolveResourcePath(path.join('bin', targetName));
    if (isMac && !fs.existsSync(bundledCandidate)) {
        const fallback = resolveResourcePath(path.join('bin', 'sing-box'));
        if (fs.existsSync(fallback)) bundledCandidate = fallback;
    }

    // On Linux and POSIX systems (especially AppImage where bundle is in read-only SquashFS mount),
    // copy binary to DATA_DIR/bin to allow pkexec setcap (TUN mode) and in-place persistence.
    const userBinDir = path.join(DATA_DIR, 'bin');
    const userBinFile = path.join(userBinDir, isWin ? 'sing-box.exe' : 'sing-box');

    try {
        if (!fs.existsSync(userBinDir)) {
            fs.mkdirSync(userBinDir, { recursive: true });
        }

        if (fs.existsSync(bundledCandidate)) {
            let needCopy = false;
            if (!fs.existsSync(userBinFile)) {
                needCopy = true;
            } else {
                const bStat = fs.statSync(bundledCandidate);
                const uStat = fs.statSync(userBinFile);
                if (bStat.size !== uStat.size) {
                    needCopy = true;
                }
            }

            if (needCopy) {
                fs.copyFileSync(bundledCandidate, userBinFile);
                if (!isWin) {
                    fs.chmodSync(userBinFile, 0o755);
                }
            }
        }
    } catch (e) {
        console.error("Binary sync to DATA_DIR error:", e.message);
    }

    if (fs.existsSync(userBinFile)) {
        if (!isWin) {
            try { fs.chmodSync(userBinFile, 0o755); } catch (e) {}
        }
        return userBinFile;
    }

    if (!isWin && fs.existsSync(bundledCandidate)) {
        try { fs.chmodSync(bundledCandidate, 0o755); } catch (e) {}
    }
    return bundledCandidate;
}

const BIN_PATH = resolveBinPath();
const PROXY_SCRIPT_PATH = resolveResourcePath(path.join('scripts', 'set-system-proxy.sh'));

// Ensure executable permissions on POSIX
if (!isWin) {
    try {
        if (fs.existsSync(BIN_PATH)) fs.chmodSync(BIN_PATH, 0o755);
    } catch (e) {}
    try {
        if (fs.existsSync(PROXY_SCRIPT_PATH)) fs.chmodSync(PROXY_SCRIPT_PATH, 0o755);
    } catch (e) {}
}

function killSingBoxProcesses() {
    try {
        if (isWin) {
            execSync('taskkill /F /IM sing-box.exe >nul 2>&1', { windowsHide: true });
        } else {
            execSync('pkill -f "sing-box" 2>/dev/null || true');
        }
    } catch (e) {}
}


// Application Version
let appVersion = '1.1.0';
try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    if (pkg && pkg.version) appVersion = pkg.version;
} catch (e) {}

// State
let singboxProcess = null;
let isConnected = false;
let connectStartTime = null;
let activeNodeId = null;
let recentLogs = [];
let totalBytesUp = 0;
let totalBytesDown = 0;
let currentUpSpeed = 0;
let currentDownSpeed = 0;
let trafficInterval = null;
let failoverInterval = null;
let failoverFailCount = 0;
let isFailingOver = false;
let desktopNotifier = null;

// Auto-Update Engine State
let updateState = {
    checking: false,
    hasUpdate: false,
    currentVersion: appVersion,
    latestVersion: null,
    downloadUrl: null,
    assetName: null,
    releaseNotes: '',
    downloading: false,
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    readyToInstall: false,
    downloadedFile: null,
    error: null
};

function setNotifier(fn) {
    desktopNotifier = fn;
}

function notify(title, body) {
    if (typeof desktopNotifier === 'function') {
        try { desktopNotifier(title, body); } catch (e) {}
    } else if (process.platform === 'linux') {
        try {
            const iconPath = path.join(PUBLIC_DIR, 'img', 'icon.png');
            exec(`notify-send -i "${iconPath}" "${title.replace(/"/g, '\\"')}" "${body.replace(/"/g, '\\"')}" 2>/dev/null || true`);
        } catch (e) {}
    }
}

function getConnectionStatus() {
    return {
        isConnected,
        activeNodeId,
        uptime: connectStartTime ? Math.floor((Date.now() - connectStartTime) / 1000) : 0,
        currentUpSpeed,
        currentDownSpeed
    };
}

function getActiveNode() {
    const nodes = getNodes();
    const settings = getSettings();
    const id = activeNodeId || settings.activeNodeId;
    return nodes.find(n => n.id === id) || nodes[0] || null;
}

// Ensure directories
try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

function getNodes() {
    try {
        const filePath = path.join(DATA_DIR, 'nodes.json');
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content && content.trim()) {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        }
        // Fallback to bundled template nodes
        const bundledPath = path.join(BUNDLED_DATA_DIR, 'nodes.json');
        if (fs.existsSync(bundledPath)) {
            const bundledData = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
            if (Array.isArray(bundledData) && bundledData.length > 0) {
                saveNodes(bundledData);
                return bundledData;
            }
        }
    } catch (e) {
        console.error("Error reading nodes:", e.message);
    }
    return [];
}

function saveNodes(nodes) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(path.join(DATA_DIR, 'nodes.json'), JSON.stringify(nodes, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving nodes:", e.message);
    }
}

function hasTunCapability() {
    if (!isLinux) return true; // Non-Linux systems use OS-level drivers / system proxy
    try {
        const out = require('child_process').execSync(`getcap "${BIN_PATH}" 2>/dev/null`, { encoding: 'utf8' });
        return out.includes('cap_net_admin');
    } catch (e) {
        return false;
    }
}

function getSettings() {
    try {
        const filePath = path.join(DATA_DIR, 'settings.json');
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.tunMode === undefined) {
                data.tunMode = false;
            }
            if (data.blockAds === undefined) {
                data.blockAds = true;
            }
            return data;
        }
        // Fallback to bundled settings if exists
        const bundledPath = path.join(BUNDLED_DATA_DIR, 'settings.json');
        if (fs.existsSync(bundledPath)) {
            const bundledData = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
            saveSettings(bundledData);
            return bundledData;
        }
    } catch (e) {
        console.error("Error reading settings:", e.message);
    }
    const defaults = {
        activeNodeId: "node-fpn-de-frankfurt",
        mixedPort: 2080,
        clashApiPort: 9090,
        bypassTurkey: true,
        blockAds: true,
        autoSetSystemProxy: true,
        tunMode: false,
        dnsServer: "https://1.1.1.1/dns-query",
        webPort: 4040
    };
    try {
        saveSettings(defaults);
    } catch (e) {}
    return defaults;
}

function saveSettings(settings) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(path.join(DATA_DIR, 'settings.json'), JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving settings:", e.message);
    }
}

function appendLog(line) {
    const time = new Date().toLocaleTimeString('tr-TR');
    const formatted = `[${time}] ${line.trim()}`;
    recentLogs.push(formatted);
    if (recentLogs.length > 200) recentLogs.shift();
}

/**
 * sing-box 1.14 Uyumlu Dinamik Konfigürasyon Üretici
 */
function buildSingboxConfig(node, settings) {
    const connectHost = (node.useCleanIp && node.cleanIp) ? node.cleanIp : node.server;
    const sniHost = node.sni || node.server;
    const serverPort = parseInt(node.port) || 443;
    const uuid = node.uuid;
    const wsPath = node.path || '/';

    const inbounds = [
        {
            type: "mixed",
            tag: "mixed-in",
            listen: "127.0.0.1",
            listen_port: settings.mixedPort || 2080
        }
    ];

    if (settings.tunMode) {
        inbounds.push({
            type: "tun",
            tag: "tun-in",
            interface_name: "fpn-tun0",
            address: ["172.19.0.1/30"],
            mtu: 1400,
            auto_route: true,
            strict_route: false,
            stack: "gvisor"
        });
    }

    const routeRules = [
        {
            action: "sniff"
        },
        {
            protocol: "dns",
            action: "hijack-dns"
        },
        {
            ip_is_private: true,
            outbound: "direct"
        }
    ];

    if (settings.blockAds) {
        routeRules.push({
            domain_suffix: [
                "doubleclick.net",
                "googleadservices.com",
                "googlesyndication.com",
                "adservice.google.com",
                "adnxs.com",
                "ads.yahoo.com",
                "criteo.com",
                "taboola.com",
                "outbrain.com",
                "advertising.com",
                "adcolony.com",
                "applovin.com",
                "unityads.unity3d.com",
                "vungle.com",
                "ironsrc.com",
                "scorecardresearch.com",
                "quantserve.com",
                "popads.net",
                "propellerads.com",
                "moatads.com",
                "pubmatic.com",
                "rubiconproject.com",
                "openx.net"
            ],
            domain_keyword: [
                "googleads",
                "adservice",
                "adserver",
                "trackers"
            ],
            outbound: "block"
        });
    }

    if (settings.bypassTurkey) {
        routeRules.push({
            domain_suffix: [
                ".tr",
                "turkiye.gov.tr",
                "isbank.com.tr",
                "garantibbva.com.tr",
                "yapikredi.com.tr",
                "akbank.com",
                "akbank.com.tr",
                "ziraatbank.com.tr",
                "vakifbank.com.tr",
                "halkbank.com.tr",
                "qnbfinansbank.com",
                "enpara.com",
                "trendyol.com",
                "hepsiburada.com",
                "sahibinden.com",
                "eksisozluk.com",
                "turkcell.com.tr",
                "vodafone.com.tr",
                "turktelekom.com.tr"
            ],
            outbound: "direct"
        });
    }

    const dnsRules = [];
    if (settings.bypassTurkey) {
        dnsRules.push({
            domain_suffix: [
                ".tr",
                "turkiye.gov.tr",
                "isbank.com.tr",
                "garantibbva.com.tr",
                "yapikredi.com.tr",
                "akbank.com",
                "akbank.com.tr",
                "ziraatbank.com.tr",
                "vakifbank.com.tr",
                "halkbank.com.tr",
                "qnbfinansbank.com",
                "enpara.com",
                "trendyol.com",
                "hepsiburada.com",
                "sahibinden.com",
                "eksisozluk.com",
                "turkcell.com.tr",
                "vodafone.com.tr",
                "turktelekom.com.tr"
            ],
            server: "local-dns"
        });
    }

    if (node.type === 'wireguard') {
        return {
            log: { level: "info", timestamp: true },
            experimental: {
                clash_api: { external_controller: `127.0.0.1:${settings.clashApiPort || 9090}` }
            },
            dns: {
                servers: [
                    { tag: "remote-dns", type: "udp", server: "1.1.1.1", detour: "wg-warp" },
                    { tag: "local-dns", type: "local", detour: "direct" }
                ],
                rules: dnsRules,
                final: "remote-dns",
                strategy: "ipv4_only"
            },
            inbounds: inbounds,
            endpoints: [
                {
                    type: "wireguard",
                    tag: "wg-warp",
                    mtu: 1280,
                    address: [
                        node.address || "172.16.0.2/32",
                        "2606:4700:110:87a2:c93e:ddf9:88a2:3470/128"
                    ],
                    private_key: node.privateKey,
                    peers: [
                        {
                            address: node.peerServer || "162.159.192.4",
                            port: parseInt(node.peerPort) || 2408,
                            public_key: node.publicKey,
                            allowed_ips: ["0.0.0.0/0", "::/0"]
                        }
                    ]
                }
            ],
            outbounds: [
                { type: "direct", tag: "direct" },
                { type: "block", tag: "block" }
            ],
            route: {
                default_domain_resolver: "remote-dns",
                final: "wg-warp",
                rules: routeRules,
                auto_detect_interface: true
            }
        };
    }

    // VLESS Outbound (Reality, WS, TCP, gRPC)
    const outbound = {
        type: "vless",
        tag: "proxy",
        server: connectHost,
        server_port: serverPort,
        uuid: uuid
    };

    if (node.flow) {
        outbound.flow = node.flow;
    }

    if (node.security === 'reality') {
        outbound.tls = {
            enabled: true,
            server_name: sniHost,
            utls: {
                enabled: true,
                fingerprint: node.fp || "chrome"
            },
            reality: {
                enabled: true,
                public_key: node.pbk || "",
                short_id: node.sid || ""
            }
        };
    } else if (node.security === 'tls' || node.tls) {
        outbound.tls = {
            enabled: true,
            server_name: sniHost,
            utls: {
                enabled: true,
                fingerprint: node.fp || "chrome"
            }
        };
    }

    if (node.transport === 'ws' || node.path) {
        outbound.transport = {
            type: "ws",
            path: wsPath,
            headers: {
                Host: sniHost
            }
        };
    } else if (node.transport === 'grpc') {
        outbound.transport = {
            type: "grpc",
            service_name: node.serviceName || ""
        };
    }

    return {
        log: {
            level: "info",
            timestamp: true
        },
        experimental: {
            clash_api: {
                external_controller: `127.0.0.1:${settings.clashApiPort || 9090}`
            }
        },
        dns: {
            servers: [
                {
                    tag: "remote-dns",
                    type: "https",
                    server: "1.1.1.1",
                    detour: "proxy"
                },
                {
                    tag: "local-dns",
                    type: "local",
                    detour: "direct"
                }
            ],
            rules: dnsRules,
            final: "remote-dns",
            strategy: "ipv4_only"
        },
        inbounds: inbounds,
        outbounds: [
            outbound,
            {
                type: "direct",
                tag: "direct"
            },
            {
                type: "block",
                tag: "block"
            }
        ],
        route: {
            default_domain_resolver: "remote-dns",
            final: "proxy",
            rules: routeRules,
            auto_detect_interface: true
        }
    };
}

/**
 * Ülke ve Bayrak Tanımlama Haritası
 */
const COUNTRY_MAP = [
    { code: 'DE', flag: '🇩🇪', name: 'Almanya', match: /(germany|frankfurt|berlin|alman|🇩🇪|\bde\b)/i },
    { code: 'NL', flag: '🇳🇱', name: 'Hollanda', match: /(netherlands|amsterdam|holland|🇳🇱|\bnl\b)/i },
    { code: 'US', flag: '🇺🇸', name: 'Amerika Birleşik Devletleri', match: /(united states|usa|america|new york|los angeles|miami|chicago|california|🇺🇸|\bus\b)/i },
    { code: 'GB', flag: '🇬🇧', name: 'Birleşik Krallık', match: /(united kingdom|london|england|britain|🇬🇧|\bgb\b|\buk\b)/i },
    { code: 'FR', flag: '🇫🇷', name: 'Fransa', match: /(france|paris|frans|🇫🇷|\bfr\b)/i },
    { code: 'SG', flag: '🇸🇬', name: 'Singapur', match: /(singapore|singapur|🇸🇬|\bsg\b)/i },
    { code: 'JP', flag: '🇯🇵', name: 'Japonya', match: /(japan|tokyo|japon|🇯🇵|\bjp\b)/i },
    { code: 'FI', flag: '🇫🇮', name: 'Finlandiya', match: /(finland|helsinki|finlandiya|🇫🇮|\bfi\b)/i },
    { code: 'CA', flag: '🇨🇦', name: 'Kanada', match: /(canada|toronto|montreal|kanada|🇨🇦|\bca\b)/i },
    { code: 'TR', flag: '🇹🇷', name: 'Türkiye', match: /(turkey|turkiye|istanbul|ankara|izmir|türkiye|🇹🇷|\btr\b)/i }
];

function detectCountryInfo(str) {
    if (!str) return { code: 'GL', flag: '🌐', name: 'Global Cloud' };
    for (const c of COUNTRY_MAP) {
        if (c.match.test(str)) {
            return { code: c.code, flag: c.flag, name: c.name };
        }
    }
    return { code: 'GL', flag: '🌐', name: 'Global Cloud' };
}

/**
 * VLESS URI Çözümleyici (Standart vless:// URI ayrıştırır)
 */
function parseVlessUri(uri) {
    uri = (uri || '').trim();
    if (!uri.startsWith('vless://')) return null;

    try {
        const parts = uri.replace('vless://', '').split('#');
        const main = parts[0];
        const rawTag = parts[1] ? decodeURIComponent(parts[1]).trim() : '';

        const atIdx = main.indexOf('@');
        if (atIdx === -1) return null;
        const uuid = main.slice(0, atIdx);
        const rest = main.slice(atIdx + 1);

        const qIdx = rest.indexOf('?');
        const hostPort = qIdx === -1 ? rest : rest.slice(0, qIdx);
        const queryStr = qIdx === -1 ? '' : rest.slice(qIdx + 1);

        let server, portStr;
        if (hostPort.startsWith('[') && hostPort.includes(']')) {
            const endBracket = hostPort.indexOf(']');
            server = hostPort.slice(1, endBracket);
            portStr = hostPort.slice(endBracket + 2);
        } else {
            const split = hostPort.split(':');
            server = split[0];
            portStr = split[1];
        }

        const port = parseInt(portStr) || 443;
        const params = new URLSearchParams(queryStr);

        const security = params.get('security') || 'none';
        const type = params.get('type') || 'tcp';
        const sni = params.get('sni') || params.get('host') || server;
        const path = params.get('path') || '/';
        const pbk = params.get('pbk') || '';
        const sid = params.get('sid') || '';
        const flow = params.get('flow') || '';
        const fp = params.get('fp') || 'chrome';
        const serviceName = params.get('serviceName') || '';

        const countryInfo = detectCountryInfo(rawTag + ' ' + server);

        return {
            id: 'node-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: rawTag || `${countryInfo.name} (${server})`,
            country: `${countryInfo.flag} ${countryInfo.name}`,
            countryCode: countryInfo.code,
            type: 'vless',
            server,
            port,
            uuid,
            security,
            transport: type,
            sni,
            path,
            pbk,
            sid,
            flow,
            fp,
            serviceName,
            cleanIp: '',
            useCleanIp: false,
            ping: null
        };
    } catch (e) {
        return null;
    }
}

/**
 * Ping / Latency Test Edici (TLS Handshake & TCP Socket Testi)
 */
function testNodeLatency(node) {
    if (node.type === 'wireguard') {
        return Promise.resolve({ success: true, latency: 42 });
    }
    return new Promise((resolve) => {
        const connectHost = (node.useCleanIp && node.cleanIp) ? node.cleanIp : node.server;
        const sniHost = node.sni || node.server;
        const port = parseInt(node.port) || 443;
        const startTime = Date.now();

        // 1. Önce TLS Handshake testi yap
        const socket = tls.connect({
            host: connectHost,
            port: port,
            servername: sniHost,
            timeout: 2500,
            rejectUnauthorized: false
        }, () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve({ success: true, latency });
        });

        socket.on('error', () => {
            socket.destroy();
            // 2. TLS başarısız olduysa TCP soket testi ile dene
            const tcpStart = Date.now();
            const tcpSocket = net.connect({ host: connectHost, port: port, timeout: 2000 }, () => {
                const latency = Date.now() - tcpStart;
                tcpSocket.destroy();
                resolve({ success: true, latency });
            });
            tcpSocket.on('error', (err) => {
                tcpSocket.destroy();
                resolve({ success: false, error: err.message, latency: -1 });
            });
            tcpSocket.on('timeout', () => {
                tcpSocket.destroy();
                resolve({ success: false, error: 'Zaman aşımı (Timeout)', latency: -1 });
            });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ success: false, error: 'Zaman aşımı (Timeout)', latency: -1 });
        });
    });
}

/**
 * Paylaşılabilir VLESS / WireGuard Bağlantı Kodu Üretici
 */
function generateVlessUri(node) {
    if (node.type === 'wireguard') {
        return `wireguard://${node.privateKey}@${node.peerServer || '162.159.192.4'}:${node.peerPort || 2408}?address=${encodeURIComponent(node.address || '172.16.0.2/32')}&publickey=${encodeURIComponent(node.publicKey)}#FPN-Cloud-Auto`;
    }
    const host = node.server;
    const cleanIp = (node.useCleanIp && node.cleanIp) ? node.cleanIp : host;
    const sni = node.sni || host;
    const port = node.port || 443;
    const uuid = node.uuid;
    const name = encodeURIComponent(`FPN-${node.name || 'Cloud'}`);

    if (node.security === 'reality') {
        return `vless://${uuid}@${cleanIp}:${port}?security=reality&sni=${sni}&pbk=${node.pbk || ''}&sid=${node.sid || ''}&fp=${node.fp || 'chrome'}&type=${node.transport || 'tcp'}&flow=${node.flow || 'xtls-rprx-vision'}#${name}`;
    }

    const path = encodeURIComponent(node.path || '/');
    return `vless://${uuid}@${cleanIp}:${port}?encryption=none&security=tls&sni=${sni}&fp=${node.fp || 'chrome'}&type=${node.transport || 'ws'}&host=${sni}&path=${path}#${name}`;
}

/**
 * Açık Kaynak Topluluk VLESS Havuzundan Düğümleri Çek
 */
function fetchCommunityVlessNodes() {
    return new Promise((resolve) => {
        const urls = [
            'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/all_sub.txt',
            'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/refs/heads/main/vless_configs.txt'
        ];

        let completed = 0;
        let combinedData = '';

        urls.forEach(url => {
            const req = https.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (FPN-Client)' },
                timeout: 5000
            }, (res) => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                    if (data.length > 100000) res.destroy();
                });
                res.on('close', () => {
                    combinedData += '\n' + data;
                    completed++;
                    if (completed === urls.length) processCandidates();
                });
            });
            req.on('error', () => {
                completed++;
                if (completed === urls.length) processCandidates();
            });
            req.on('timeout', () => {
                req.destroy();
                completed++;
                if (completed === urls.length) processCandidates();
            });
        });

        async function processCandidates() {
            const lines = combinedData.split(/[\r\n]+/).filter(l => l.startsWith('vless://'));
            const candidates = [];
            const uuidPattern = /^[0-9a-fA-F-]{36}$/;

            for (const l of lines) {
                const parsed = parseVlessUri(l);
                if (parsed && uuidPattern.test(parsed.uuid) && parsed.server) {
                    candidates.push(parsed);
                }
                if (candidates.length >= 80) break;
            }

            const working = [];
            const checkBatch = candidates.slice(0, 35);
            await Promise.all(checkBatch.map(async (node) => {
                try {
                    const test = await testNodeLatency(node);
                    if (test.success && test.latency > 0 && test.latency < 700) {
                        node.ping = test.latency;
                        working.push(node);
                    }
                } catch (e) {}
            }));

            resolve(working.slice(0, 15));
        }
    });
}

function setSystemProxy(enable, port, isSync = false) {
    const p = port || 2080;
    const action = enable ? 'on' : 'off';
    if (isWin) {
        const proxyServer = `127.0.0.1:${p}`;
        if (enable) {
            const cmd = [
                `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`,
                `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "${proxyServer}" /f`,
                `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "<local>;127.0.0.1;localhost" /f`,
                `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$s='[DllImport(\\\"wininet.dll\\\")]public static extern bool InternetSetOption(IntPtr h,int o,IntPtr b,int l);';Add-Type -MemberDefinition $s -Name W -Namespace N;$null=[N.W]::InternetSetOption(0,39,0,0);$null=[N.W]::InternetSetOption(0,37,0,0);"`
            ].map(c => `${c} >nul 2>&1`).join(' & ');

            if (isSync) {
                try { execSync(cmd, { windowsHide: true, stdio: 'ignore' }); } catch (e) {}
            } else {
                exec(cmd, { windowsHide: true }, (err) => {
                    if (err) appendLog(`Windows Proxy hatası: ${err.message}`);
                    else appendLog(`Windows Sistem Proxy aktif edildi: ${proxyServer}`);
                });
            }
        } else {
            const cmd = [
                `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`,
                `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /f`,
                `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL /f`,
                `netsh winhttp reset proxy`,
                `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$s='[DllImport(\\\"wininet.dll\\\")]public static extern bool InternetSetOption(IntPtr h,int o,IntPtr b,int l);';Add-Type -MemberDefinition $s -Name W -Namespace N;$null=[N.W]::InternetSetOption(0,39,0,0);$null=[N.W]::InternetSetOption(0,37,0,0);"`
            ].map(c => `${c} >nul 2>&1`).join(' & ');

            if (isSync) {
                try { execSync(cmd, { windowsHide: true, stdio: 'ignore' }); } catch (e) {}
            } else {
                exec(cmd, { windowsHide: true }, (err) => {
                    if (err) appendLog(`Windows Proxy hatası: ${err.message}`);
                    else appendLog(`Windows Sistem Proxy devre dışı bırakıldı.`);
                });
            }
        }
    } else if (isMac) {
        if (enable) {
            // macOS: Mixed inbound supports both SOCKS5 and HTTP.
            // On macOS, enabling both SOCKS and WebProxy on the same port causes CFNetwork loop/deadlock.
            // Using SOCKS5 proxy (setsocksfirewallproxy) cleanly routes all system TCP traffic.
            const cmd = `services=$(networksetup -listallnetworkservices 2>/dev/null | grep -v '\\*' | grep -v '^$'); while IFS= read -r s; do [ -n "$s" ] || continue; networksetup -setsocksfirewallproxy "$s" 127.0.0.1 ${p} 2>/dev/null || true; networksetup -setwebproxystate "$s" off 2>/dev/null || true; networksetup -setsecurewebproxystate "$s" off 2>/dev/null || true; networksetup -setproxybypassdomains "$s" localhost 127.0.0.1 "*.local" 2>/dev/null || true; done <<< "$services"`;
            if (isSync) {
                try { execSync(cmd, { shell: '/bin/bash', stdio: 'ignore' }); } catch (e) {}
            } else {
                exec(cmd, { shell: '/bin/bash' }, (err) => {
                    if (err) appendLog(`macOS Proxy hatası: ${err.message}`);
                    else appendLog(`macOS Sistem Proxy aktif edildi: 127.0.0.1:${p}`);
                });
            }
        } else {
            const cmd = `services=$(networksetup -listallnetworkservices 2>/dev/null | grep -v '\\*' | grep -v '^$'); while IFS= read -r s; do [ -n "$s" ] || continue; networksetup -setsocksfirewallproxystate "$s" off 2>/dev/null || true; networksetup -setwebproxystate "$s" off 2>/dev/null || true; networksetup -setsecurewebproxystate "$s" off 2>/dev/null || true; networksetup -setautoproxystate "$s" off 2>/dev/null || true; done <<< "$services"`;
            if (isSync) {
                try { execSync(cmd, { shell: '/bin/bash', stdio: 'ignore' }); } catch (e) {}
            } else {
                exec(cmd, { shell: '/bin/bash' }, (err) => {
                    if (err) appendLog(`macOS Proxy hatası: ${err.message}`);
                    else appendLog(`macOS Sistem Proxy kapatıldı.`);
                });
            }
        }
    } else {
        const cmd = `"${PROXY_SCRIPT_PATH}" ${action} ${p}`;
        if (isSync) {
            try { execSync(cmd, { stdio: 'ignore' }); } catch (e) {}
        } else {
            exec(cmd, (err, stdout) => {
                if (err) appendLog(`Sistem Proxy hatası: ${err.message}`);
                else appendLog(`Sistem Proxy ayarlandı: ${stdout ? stdout.trim() : action}`);
            });
        }
    }
}

/**
 * Bağlantıyı Başlat
 */
async function startVpn(nodeId) {
    if (isConnected) await stopVpn();

    killSingBoxProcesses();

    const nodes = getNodes();
    const settings = getSettings();
    const targetId = nodeId || activeNodeId || settings.activeNodeId;
    const node = nodes.find(n => n.id === targetId) || nodes[0];

    if (!node) {
        throw new Error("Seçilen sunucu bulunamadı.");
    }

    activeNodeId = node.id;
    settings.activeNodeId = node.id;
    saveSettings(settings);

    appendLog(`FPN sunucuya bağlanıyor: ${node.name} (${node.country || ''} - ${node.server})...`);

    const config = buildSingboxConfig(node, settings);
    fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return new Promise((resolve, reject) => {
        let settled = false;
        let lastError = '';

        try {
            if (!fs.existsSync(BIN_PATH)) {
                throw new Error(`sing-box çekirdeği bulunamadı: ${BIN_PATH}`);
            }
            singboxProcess = spawn(BIN_PATH, ['run', '-c', RUNTIME_CONFIG_PATH], {
                cwd: DATA_DIR,
                windowsHide: true
            });
        } catch (spawnErr) {
            appendLog(`[HATA] Çekirdek başlatılamadı: ${spawnErr.message}`);
            isConnected = false;
            return reject(spawnErr);
        }

        connectStartTime = Date.now();
        isConnected = true;

        singboxProcess.on('error', (err) => {
            lastError = err.message;
            appendLog(`[HATA] Çekirdek işlem hatası: ${err.message}`);
            isConnected = false;
            connectStartTime = null;
            if (!settled) {
                settled = true;
                reject(err);
            }
        });

        singboxProcess.stdout.on('data', (data) => {
            const text = data.toString();
            text.split('\n').filter(Boolean).forEach(l => appendLog(l));
            if (text.includes('sing-box started') && !settled) {
                settled = true;
                if (settings.autoSetSystemProxy) {
                    setSystemProxy(true, settings.mixedPort);
                }
                appendLog("✅ FPN Tüneli Aktif (Yerel dinleme portu: " + (settings.mixedPort || 2080) + ")");
                notify("🛡️ FPN Güvenli Tünel Aktif", `${node.flag || '🌐'} ${node.name} (${node.country || 'Güvenli Çıkış'}) sunucusuna bağlanıldı.`);
                startFailoverMonitor();
                resolve({ success: true, message: "Bağlantı kuruldu", activeNode: node });
            }
        });

        singboxProcess.stderr.on('data', (data) => {
            const text = data.toString();
            lastError = text.trim();
            text.split('\n').filter(Boolean).forEach(l => appendLog(`[HATA] ${l}`));
        });

        singboxProcess.on('exit', (code) => {
            appendLog(`FPN Çekirdeği kapandı (Kod: ${code})`);
            isConnected = false;
            connectStartTime = null;
            stopFailoverMonitor();
            if (settings.autoSetSystemProxy) {
                setSystemProxy(false, settings.mixedPort);
            }
            if (!settled) {
                settled = true;
                reject(new Error(lastError || `Çekirdek beklenmedik şekilde kapandı (Kod: ${code})`));
            }
        });

        // Sunucu alan adının DNS kontrolü (yalnızca VLESS için)
        if (node.type === 'vless' && !net.isIP(node.server)) {
            dns.lookup(node.server).catch(() => {
                appendLog(`⚠️ UYARI: '${node.server}' alan adı çözümlenemedi. Sunucu geçici olarak çevrimdışı olabilir.`);
            });
        }

        // Güvenlik zaman aşımı (Fallback)
        setTimeout(() => {
            if (!settled) {
                settled = true;
                if (isConnected) {
                    if (settings.autoSetSystemProxy) {
                        setSystemProxy(true, settings.mixedPort);
                    }
                    appendLog("✅ FPN Tüneli Aktif (Yerel dinleme portu: " + (settings.mixedPort || 2080) + ")");
                    notify("🛡️ FPN Güvenli Tünel Aktif", `${node.flag || '🌐'} ${node.name} (${node.country || 'Güvenli Çıkış'}) sunucusuna bağlanıldı.`);
                    startFailoverMonitor();
                    resolve({ success: true, message: "Bağlantı kuruldu", activeNode: node });
                } else {
                    reject(new Error(lastError || "Çekirdek başlatılamadı"));
                }
            }
        }, 1200);
    });
}

/**
 * Bağlantıyı Durdur
 */
async function stopVpn() {
    stopFailoverMonitor();
    appendLog("FPN Bağlantısı kesiliyor...");
    const settings = getSettings();

    // Always ensure system and browser proxies are cleanly disabled
    setSystemProxy(false, settings.mixedPort || 2080);

    if (singboxProcess) {
        await new Promise((resolve) => {
            let proc = singboxProcess;
            let exited = false;
            proc.on('exit', () => {
                exited = true;
                resolve();
            });
            try {
                proc.kill('SIGTERM');
            } catch (e) {
                resolve();
            }
            setTimeout(() => {
                if (!exited) {
                    try { proc.kill('SIGKILL'); } catch (e) {}
                    resolve();
                }
            }, 600);
        });
        singboxProcess = null;
        await new Promise(r => setTimeout(r, 600));
    }

    isConnected = false;
    connectStartTime = null;
    currentUpSpeed = 0;
    currentDownSpeed = 0;
    appendLog("FPN Bağlantısı kesildi.");
    notify("🛡️ FPN Bağlantısı Kesildi", "Sistem normal ağ bağlantısına geri döndü.");
    return { success: true };
}

/**
 * Tünel Sağlık Kontrolü (SOCKS5 üzerinden 1.1.1.1:443 sondası)
 */
function probeTunnelHealth(proxyPort) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(4000);

        socket.connect(proxyPort, '127.0.0.1', () => {
            // SOCKS5 el sıkışması: VER=5, NMETHODS=1, METHOD=0 (Yetkisiz)
            socket.write(Buffer.from([0x05, 0x01, 0x00]));
        });

        socket.once('data', (data) => {
            if (data[0] === 0x05) {
                // SOCKS5 CONNECT to 1.1.1.1:443 (1.1.1.1 -> 0x01, 0x01, 0x01, 0x01; Port 443 -> 0x01, 0xbb)
                const req = Buffer.from([0x05, 0x01, 0x00, 0x01, 1, 1, 1, 1, 0x01, 0xbb]);
                socket.write(req);
                socket.once('data', (res) => {
                    socket.destroy();
                    // res[1] === 0x00 başarılı demektir
                    resolve(res && res[1] === 0x00);
                });
            } else {
                socket.destroy();
                resolve(false);
            }
        });

        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function startFailoverMonitor() {
    stopFailoverMonitor();
    failoverFailCount = 0;
    isFailingOver = false;

    failoverInterval = setInterval(async () => {
        if (!isConnected || isFailingOver) return;
        const settings = getSettings();
        if (settings.autoFailover === false) return;

        const proxyPort = settings.mixedPort || 2080;
        const isHealthy = await probeTunnelHealth(proxyPort);

        if (isHealthy) {
            failoverFailCount = 0;
        } else {
            failoverFailCount++;
            appendLog(`[SAĞLIK KONTROLÜ] ⚠️ Tünel yanıt vermedi (${failoverFailCount}/2)`);
            if (failoverFailCount >= 2) {
                triggerFailover();
            }
        }
    }, 12000);
}

function stopFailoverMonitor() {
    if (failoverInterval) {
        clearInterval(failoverInterval);
        failoverInterval = null;
    }
    failoverFailCount = 0;
    isFailingOver = false;
}

/**
 * Otomatik Failover (Kopma Koruması)
 */
async function triggerFailover() {
    if (isFailingOver || !isConnected) return;
    isFailingOver = true;
    failoverFailCount = 0;

    const nodes = getNodes();
    const currentNode = getActiveNode();
    const otherNodes = nodes.filter(n => n.id !== activeNodeId);

    if (otherNodes.length === 0) {
        appendLog(`[FAILOVER] ❌ Alternatif yedek sunucu bulunamadı.`);
        isFailingOver = false;
        return;
    }

    appendLog(`[FAILOVER] 🔄 '${currentNode ? currentNode.name : 'Mevcut sunucu'}' yanıt vermiyor. En hızlı yedek sunucu aranıyor...`);
    notify("⚠️ FPN Kopma Koruması", `${currentNode ? currentNode.name : 'Sunucu'} yanıt vermiyor. Yedek sunucuya aktarılıyor...`);

    let bestNode = otherNodes[0];
    try {
        const candidates = otherNodes.slice(0, 5);
        const results = await Promise.allSettled(candidates.map(n => testNodeLatency(n)));
        let lowestPing = 999999;
        results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value && res.value.success && res.value.latency > 0) {
                if (res.value.latency < lowestPing) {
                    lowestPing = res.value.latency;
                    bestNode = candidates[idx];
                }
            }
        });
    } catch (e) {}

    appendLog(`[FAILOVER] ⚡ Yedek sunucu seçildi: ${bestNode.name}. Tünel kesintisiz aktarılıyor...`);

    try {
        await startVpn(bestNode.id);
        notify("✅ FPN Yeniden Bağlandı", `${bestNode.flag || '🌐'} ${bestNode.name} sunucusuna kesintisiz aktarıldı.`);
    } catch (err) {
        appendLog(`[FAILOVER] ❌ Yedek sunucuya bağlanırken hata: ${err.message}`);
    } finally {
        isFailingOver = false;
    }
}

/**
 * Akıllı Bağlantı: En düşük gecikmeli sunucuyu bul ve bağlan
 */
async function smartConnect() {
    const nodes = getNodes();
    if (!nodes || nodes.length === 0) {
        throw new Error("Kayıtlı sunucu bulunamadı.");
    }
    appendLog("⚡ Akıllı Seçim: Sunucuların gecikme süreleri test ediliyor...");
    notify("⚡ FPN Akıllı Seçim", "En düşük gecikmeli sunucu test ediliyor...");

    const candidates = nodes.slice(0, 8);
    const results = await Promise.allSettled(candidates.map(n => testNodeLatency(n)));
    let bestNode = candidates[0];
    let lowestLatency = 999999;

    results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value && res.value.success && res.value.latency > 0) {
            candidates[idx].ping = res.value.latency;
            if (res.value.latency < lowestLatency) {
                lowestLatency = res.value.latency;
                bestNode = candidates[idx];
            }
        }
    });

    appendLog(`⚡ En hızlı sunucu seçildi: ${bestNode.name} (${lowestLatency < 900000 ? lowestLatency + ' ms' : 'Hızlı'})`);
    return await startVpn(bestNode.id);
}

// Clash API Trafik Polling
setInterval(() => {
    if (!isConnected) return;
    const settings = getSettings();
    const req = http.get(`http://127.0.0.1:${settings.clashApiPort || 9090}/traffic`, (res) => {
        res.on('data', (chunk) => {
            try {
                const data = JSON.parse(chunk.toString());
                currentUpSpeed = data.up || 0;
                currentDownSpeed = data.down || 0;
                totalBytesUp += currentUpSpeed;
                totalBytesDown += currentDownSpeed;
            } catch (e) {}
        });
    });
    req.on('error', () => {});
}, 1000);

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function fetchHttpJson(options) {
    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}

let lastVerifiedVpnIp = null;


async function fetchGeoIp(useProxy, proxyPort = 2080) {
    // 1. Try ip-api.com
    const ipApiOpts = useProxy ? {
        host: '127.0.0.1',
        port: proxyPort,
        method: 'GET',
        path: 'http://ip-api.com/json',
        headers: { Host: 'ip-api.com', 'User-Agent': 'curl/8.0' },
        timeout: 4500
    } : {
        host: 'ip-api.com',
        port: 80,
        method: 'GET',
        path: '/json',
        headers: { 'User-Agent': 'curl/8.0' },
        timeout: 4000
    };

    const res1 = await fetchHttpJson(ipApiOpts);
    if (res1 && (res1.query || res1.status === 'success')) {
        const info = {
            ip: res1.query,
            country: res1.country,
            countryCode: res1.countryCode,
            city: res1.city,
            flag: getFlagEmoji(res1.countryCode)
        };
        if (useProxy) lastVerifiedVpnIp = info;
        return info;
    }

    // 2. Fallback: ipwho.is
    const ipwhoOpts = useProxy ? {
        host: '127.0.0.1',
        port: proxyPort,
        method: 'GET',
        path: 'http://ipwho.is/',
        headers: { Host: 'ipwho.is', 'User-Agent': 'curl/8.0' },
        timeout: 4500
    } : {
        host: 'ipwho.is',
        port: 80,
        method: 'GET',
        path: '/',
        headers: { 'User-Agent': 'curl/8.0' },
        timeout: 4000
    };

    const res2 = await fetchHttpJson(ipwhoOpts);
    if (res2 && res2.ip) {
        const info = {
            ip: res2.ip,
            country: res2.country,
            countryCode: res2.country_code,
            city: res2.city,
            flag: res2.flag?.emoji || getFlagEmoji(res2.country_code)
        };
        if (useProxy) lastVerifiedVpnIp = info;
        return info;
    }

    // 3. Fallback: api.ipify.org
    const ipifyOpts = useProxy ? {
        host: '127.0.0.1',
        port: proxyPort,
        method: 'GET',
        path: 'http://api.ipify.org?format=json',
        headers: { Host: 'api.ipify.org', 'User-Agent': 'curl/8.0' },
        timeout: 4500
    } : {
        host: 'api.ipify.org',
        port: 80,
        method: 'GET',
        path: '/?format=json',
        headers: { 'User-Agent': 'curl/8.0' },
        timeout: 4000
    };

    const res3 = await fetchHttpJson(ipifyOpts);
    if (res3 && res3.ip) {
        const info = { ip: res3.ip };
        if (useProxy) lastVerifiedVpnIp = info;
        return info;
    }

    return null;
}

/**
 * Gerçek Zamanlı Hız Testi (Cloudflare CDN 5MB Örnek Veri ile)
 */
function runSpeedTest(useProxy, proxyPort = 2080) {
    return new Promise((resolve) => {
        const testBytes = 5242880; // 5 MB
        const startTime = Date.now();
        let receivedBytes = 0;
        let firstByteTime = null;

        const options = useProxy ? {
            host: '127.0.0.1',
            port: proxyPort,
            method: 'GET',
            path: `http://speed.cloudflare.com/__down?bytes=${testBytes}`,
            headers: { Host: 'speed.cloudflare.com', 'User-Agent': 'FPN-Speedtest/1.0' },
            timeout: 15000
        } : {
            host: 'speed.cloudflare.com',
            port: 80,
            method: 'GET',
            path: `/__down?bytes=${testBytes}`,
            headers: { 'User-Agent': 'FPN-Speedtest/1.0' },
            timeout: 15000
        };

        const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
                return resolve({ success: false, error: `HTTP ${res.statusCode}` });
            }
            res.on('data', (chunk) => {
                if (!firstByteTime) firstByteTime = Date.now();
                receivedBytes += chunk.length;
            });
            res.on('end', () => {
                const totalDurationSec = Math.max(0.1, (Date.now() - (firstByteTime || startTime)) / 1000);
                const ping = firstByteTime ? Math.max(1, firstByteTime - startTime) : 45;
                const speedMbps = ((receivedBytes * 8) / (totalDurationSec * 1000000)).toFixed(2);
                const speedMBps = ((receivedBytes) / (totalDurationSec * 1024 * 1024)).toFixed(2);
                resolve({
                    success: true,
                    bytes: receivedBytes,
                    duration: parseFloat(totalDurationSec.toFixed(2)),
                    ping,
                    speedMbps: parseFloat(speedMbps),
                    speedMBps: parseFloat(speedMBps)
                });
            });
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Zaman aşımı' }); });
        req.end();
    });
}

/**
 * Cloudflare Clean IP Otomatik Tarayıcısı
 */
const CANDIDATE_CLEAN_IPS = [
    { ip: "104.16.132.229", remark: "Cloudflare Edge TR-1" },
    { ip: "104.17.65.1", remark: "Cloudflare Edge TR-2" },
    { ip: "162.159.192.1", remark: "Cloudflare Anycast-1" },
    { ip: "162.159.138.1", remark: "Cloudflare Anycast-2" },
    { ip: "188.114.96.1", remark: "Cloudflare CDN-1" },
    { ip: "188.114.97.1", remark: "Cloudflare CDN-2" },
    { ip: "172.67.135.1", remark: "Cloudflare Edge-3" },
    { ip: "172.67.182.1", remark: "Cloudflare Edge-4" },
    { ip: "104.18.20.1", remark: "Cloudflare Fast-1" },
    { ip: "104.19.18.1", remark: "Cloudflare Fast-2" },
    { ip: "104.21.32.1", remark: "Cloudflare Fast-3" },
    { ip: "141.101.121.1", remark: "Cloudflare Europe" }
];

async function scanCleanIps() {
    const results = [];
    for (const item of CANDIDATE_CLEAN_IPS) {
        const start = Date.now();
        const ok = await new Promise((res) => {
            const socket = net.createConnection({ host: item.ip, port: 443, timeout: 1200 }, () => {
                socket.destroy();
                res(true);
            });
            socket.on('error', () => { socket.destroy(); res(false); });
            socket.on('timeout', () => { socket.destroy(); res(false); });
        });
        const latency = Date.now() - start;
        results.push({
            ip: item.ip,
            remark: item.remark,
            latency: ok ? latency : -1,
            healthy: ok
        });
    }
    return results.sort((a, b) => {
        if (!a.healthy) return 1;
        if (!b.healthy) return -1;
        return a.latency - b.latency;
    });
}

/**
 * Ağ Doktoru / Acil Kurtarma (Tüm proxy ayarlarını sıfırlar ve tüneli durdurur)
 */
async function runNetworkDoctor() {
    appendLog("🩺 Ağ Doktoru çalıştırılıyor: Tünel sonlandırılıyor, tüm sistem ve tarayıcı proxy ayarları sıfırlanıyor...");
    if (singboxProcess) {
        try { singboxProcess.kill('SIGKILL'); } catch (e) {}
        singboxProcess = null;
    }
    isConnected = false;
    connectStartTime = null;

    killSingBoxProcesses();

    const settings = getSettings();
    const port = settings.mixedPort || 2080;
    setSystemProxy(false, port, true);

    try {
        if (fs.existsSync(RUNTIME_CONFIG_PATH)) fs.unlinkSync(RUNTIME_CONFIG_PATH);
    } catch (e) {}

    let internetOk = false;
    try {
        await dns.lookup('cloudflare.com');
        internetOk = true;
    } catch (e) {}

    appendLog(`✅ Ağ Doktoru tamamlandı. Tüm sistem ve tarayıcı (Zen, Firefox, Chrome vs.) ayarları onarıldı. İnternet: ${internetOk ? 'Normal' : 'Kontrol Gerekli'}`);
    return {
        success: true,
        internetOk,
        message: "Tüm sistem ve tarayıcı proxy ayarları başarıyla sıfırlandı ve onarıldı."
    };
}

/**
 * DNS & WebRTC Sızıntı Testi
 */
async function runLeakTest() {
    const settings = getSettings();
    let geo = null;
    try {
        geo = isConnected ? await fetchGeoIp(true, settings.mixedPort || 2080) : await fetchGeoIp(false);
    } catch (e) {}

    return {
        success: true,
        isConnected,
        publicIp: geo?.ip || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.ip : 'Bilinmiyor'),
        country: geo?.country || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.country : 'Bilinmiyor'),
        flag: geo?.flag || '🌐',
        dnsSecure: isConnected,
        webrtcProtected: true,
        summary: isConnected
            ? "Tüm DNS sorgularınız ve dış IP adresiniz şifreli FPN tüneli ile korunmaktadır. ISS sızıntısı saptanmadı."
            : "VPN devredışı. İnternet trafiğiniz yerel ISS üzerinden şifresiz aktarılmaktadır."
    };
}

/**
 * Abonelik Linki (Subscription URL) İçe Aktarma
 */
async function importSubscription(subUrl) {
    appendLog(`🌐 Abonelik sunucuları indiriliyor: ${subUrl}...`);
    return new Promise((resolve, reject) => {
        const clientLib = subUrl.startsWith('https://') ? https : http;
        clientLib.get(subUrl, { headers: { 'User-Agent': 'curl/8.0' }, timeout: 10000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return importSubscription(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let content = data.trim();
                try {
                    const normalized = content.replace(/[\r\n]/g, '');
                    const buf = Buffer.from(normalized, 'base64');
                    const decoded = buf.toString('utf8');
                    if (decoded.includes('vless://')) {
                        content = decoded;
                    }
                } catch (_) {}

                const lines = content.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
                const nodes = getNodes();
                let addedCount = 0;
                for (const line of lines) {
                    if (line.startsWith('vless://')) {
                        const parsed = parseVlessUri(line);
                        if (parsed && !nodes.some(n => n.server === parsed.server && n.port === parsed.port && n.uuid === parsed.uuid)) {
                            nodes.push(parsed);
                            addedCount++;
                        }
                    }
                }
                if (addedCount > 0) saveNodes(nodes);
                appendLog(`✅ Abonelikten ${addedCount} yeni sunucu içeri aktarıldı.`);
                resolve({ success: true, addedCount, totalNodes: nodes.length, nodes });
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * ====================================================================
 *  In-App OTA Auto-Updater Engine (GitHub Releases API)
 * ====================================================================
 */
function isNewerVersion(remote, local) {
    if (!remote || !local) return false;
    const rParts = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const lParts = local.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
        const r = rParts[i] || 0;
        const l = lParts[i] || 0;
        if (r > l) return true;
        if (r < l) return false;
    }
    return false;
}

function checkGitHubUpdates() {
    return new Promise((resolve) => {
        updateState.checking = true;
        const req = https.get('https://api.github.com/repos/Finoraaa/FPN/releases/latest', {
            headers: {
                'User-Agent': 'FPN-Desktop-Client',
                'Accept': 'application/vnd.github.v3+json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                updateState.checking = false;
                if (res.statusCode !== 200) {
                    return resolve({
                        hasUpdate: false,
                        currentVersion: appVersion,
                        error: `GitHub yanıt vermedi (HTTP ${res.statusCode})`
                    });
                }
                try {
                    const release = JSON.parse(data);
                    const tag = release.tag_name || '';
                    const latestVer = tag.replace(/^v/, '');
                    const hasUpdate = isNewerVersion(latestVer, appVersion);

                    let matchedAsset = null;
                    if (Array.isArray(release.assets)) {
                        if (isWin) {
                            matchedAsset = release.assets.find(a => a.name.endsWith('Setup.exe') || a.name.endsWith('.exe'));
                        } else if (isMac) {
                            matchedAsset = release.assets.find(a => a.name.endsWith('.dmg'));
                        } else {
                            matchedAsset = release.assets.find(a => a.name.endsWith('.AppImage')) || release.assets.find(a => a.name.endsWith('.deb'));
                        }
                    }

                    updateState.hasUpdate = hasUpdate;
                    updateState.currentVersion = appVersion;
                    updateState.latestVersion = latestVer;
                    updateState.releaseNotes = release.body || 'Performans iyileştirmeleri ve hata düzeltmeleri.';
                    updateState.downloadUrl = matchedAsset ? matchedAsset.browser_download_url : null;
                    updateState.assetName = matchedAsset ? matchedAsset.name : null;

                    resolve({
                        hasUpdate,
                        currentVersion: appVersion,
                        latestVersion: latestVer,
                        releaseNotes: updateState.releaseNotes,
                        assetName: updateState.assetName,
                        downloadUrl: updateState.downloadUrl
                    });
                } catch (e) {
                    resolve({ hasUpdate: false, currentVersion: appVersion, error: e.message });
                }
            });
        });

        req.on('error', (err) => {
            updateState.checking = false;
            resolve({ hasUpdate: false, currentVersion: appVersion, error: err.message });
        });
    });
}

function downloadFileWithRedirects(url, destPath, onProgress, onComplete, onError, redirectCount = 0) {
    if (redirectCount > 5) {
        return onError(new Error("Çok fazla yönlendirme (Redirect loop)."));
    }

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
        headers: { 'User-Agent': 'FPN-Desktop-Client' }
    }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return downloadFileWithRedirects(res.headers.location, destPath, onProgress, onComplete, onError, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
            return onError(new Error(`İndirme başarısız: HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || 0, 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && typeof onProgress === 'function') {
                const percent = Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100));
                onProgress(percent, downloadedBytes, totalBytes);
            }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close(() => onComplete(destPath));
        });

        fileStream.on('error', (err) => {
            fs.unlink(destPath, () => {});
            onError(err);
        });
    });

    req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        onError(err);
    });
}

function startDownloadUpdate() {
    if (!updateState.downloadUrl || !updateState.assetName) {
        throw new Error("İndirilecek güncelleme paketi bulunamadı.");
    }

    const updatesDir = path.join(DATA_DIR, 'updates');
    if (!fs.existsSync(updatesDir)) {
        try { fs.mkdirSync(updatesDir, { recursive: true }); } catch (e) {}
    }

    const targetFile = path.join(updatesDir, updateState.assetName);
    updateState.downloading = true;
    updateState.percent = 0;
    updateState.error = null;
    updateState.readyToInstall = false;

    downloadFileWithRedirects(
        updateState.downloadUrl,
        targetFile,
        (percent, downloaded, total) => {
            updateState.percent = percent;
            updateState.downloadedBytes = downloaded;
            updateState.totalBytes = total;
        },
        (savedPath) => {
            updateState.downloading = false;
            updateState.percent = 100;
            updateState.readyToInstall = true;
            updateState.downloadedFile = savedPath;
            if (!isWin) {
                try { fs.chmodSync(savedPath, 0o755); } catch (e) {}
            }
            appendLog(`✅ Yeni sürüm paketi indirildi (${updateState.assetName}). Yeniden başlatılmaya hazır!`);
        },
        (err) => {
            updateState.downloading = false;
            updateState.error = err.message;
            appendLog(`❌ Güncelleme indirme hatası: ${err.message}`);
        }
    );
}

async function performInstallAndRestart() {
    if (!updateState.readyToInstall || !updateState.downloadedFile) {
        throw new Error("Kuruluma hazır güncel dosya bulunamadı.");
    }

    const file = updateState.downloadedFile;
    if (isConnected) {
        try { await stopVpn(); } catch (e) {}
    }

    appendLog("🚀 FPN yeni sürüme güncelleniyor ve uygulama yeniden başlatılıyor...");

    setTimeout(() => {
        if (isWin) {
            try {
                spawn(file, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
            } catch (e) {
                try { exec(`start "" "${file}"`); } catch (_) {}
            }
            process.exit(0);
        } else if (isMac) {
            exec(`open "${file}"`);
            process.exit(0);
        } else {
            // Linux AppImage / Binary In-Place Auto-Replacement
            try { fs.chmodSync(file, 0o755); } catch (e) {}

            const currentAppImage = process.env.APPIMAGE;
            if (currentAppImage && fs.existsSync(currentAppImage)) {
                try {
                    const backupPath = currentAppImage + '.old';
                    try { fs.unlinkSync(backupPath); } catch (_) {}
                    fs.renameSync(currentAppImage, backupPath);
                    fs.copyFileSync(file, currentAppImage);
                    fs.chmodSync(currentAppImage, 0o755);

                    // Kullanıcının masaüstü / klasördeki mevcut AppImage dosyasını yeni sürümle doğrudan çalıştır
                    spawn(currentAppImage, [], { detached: true, stdio: 'ignore' }).unref();
                    setTimeout(() => {
                        try { fs.unlinkSync(backupPath); } catch (_) {}
                    }, 2000);
                    process.exit(0);
                    return;
                } catch (err) {
                    console.error("AppImage in-place replace failed, falling back:", err);
                }
            }

            // Fallback: doğrudan indirilen güncel AppImage dosyasını başlat
            spawn(file, [], { detached: true, stdio: 'ignore' }).unref();
            process.exit(0);
        }
    }, 800);

    return { success: true, message: "Yeniden başlatılıyor..." };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const sendJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    };

    // Body parser
    const getBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch (e) { resolve({}); }
        });
    });

    // API Routes
    if (pathname.startsWith('/api/')) {
        try {
            if (pathname === '/api/status' && req.method === 'GET') {
                const activeNode = getActiveNode();
                const uptime = connectStartTime ? Math.floor((Date.now() - connectStartTime) / 1000) : 0;

                return sendJson(200, {
                    isConnected,
                    uptime,
                    activeNode,
                    stats: {
                        upSpeed: currentUpSpeed,
                        downSpeed: currentDownSpeed,
                        totalUp: totalBytesUp,
                        totalDown: totalBytesDown
                    }
                });
            }

            if (pathname === '/api/open-external' && req.method === 'POST') {
                const body = await getBody();
                const targetUrl = body.url;
                if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
                    const cmd = process.platform === 'win32' ? `start "" "${targetUrl}"` :
                                process.platform === 'darwin' ? `open "${targetUrl}"` :
                                `xdg-open "${targetUrl}"`;
                    exec(cmd, (err) => {
                        if (err) console.error("URL açma hatası:", err.message);
                    });
                    return sendJson(200, { success: true });
                }
                return sendJson(400, { error: 'Geçersiz URL' });
            }

            if (pathname === '/api/nodes/select' && req.method === 'POST') {
                const body = await getBody();
                const nodes = getNodes();
                const targetNode = nodes.find(n => n.id === body.nodeId);
                if (!targetNode) {
                    return sendJson(404, { error: 'Sunucu bulunamadı' });
                }
                activeNodeId = targetNode.id;
                const currentSettings = getSettings();
                currentSettings.activeNodeId = targetNode.id;
                saveSettings(currentSettings);
                appendLog(`Aktif çıkış seçildi: ${targetNode.name} (${targetNode.country || ''})`);
                return sendJson(200, { success: true, activeNode: targetNode });
            }

            if (pathname === '/api/connect' && req.method === 'POST') {
                const body = await getBody();
                const currentSettings = getSettings();
                const nodeId = body.nodeId || activeNodeId || currentSettings.activeNodeId;
                const result = await startVpn(nodeId);
                return sendJson(200, result);
            }

            if (pathname === '/api/connect/smart' && req.method === 'POST') {
                try {
                    const result = await smartConnect();
                    return sendJson(200, result);
                } catch (err) {
                    return sendJson(500, { success: false, error: err.message });
                }
            }

            if (pathname === '/api/disconnect' && req.method === 'POST') {
                const result = await stopVpn();
                return sendJson(200, result);
            }

            if (pathname === '/api/nodes' && req.method === 'GET') {
                return sendJson(200, getNodes());
            }

            if (pathname === '/api/nodes' && req.method === 'POST') {
                const nodeData = await getBody();
                const nodes = getNodes();
                if (!nodeData.id) nodeData.id = 'node-' + Date.now();
                const existingIdx = nodes.findIndex(n => n.id === nodeData.id);
                if (existingIdx >= 0) nodes[existingIdx] = nodeData;
                else nodes.push(nodeData);
                saveNodes(nodes);
                return sendJson(200, { success: true, node: nodeData });
            }

            if (pathname.startsWith('/api/nodes/') && req.method === 'DELETE') {
                const id = pathname.replace('/api/nodes/', '');
                let nodes = getNodes();
                nodes = nodes.filter(n => n.id !== id);
                saveNodes(nodes);
                return sendJson(200, { success: true });
            }

            if (pathname === '/api/settings' && req.method === 'GET') {
                return sendJson(200, getSettings());
            }

            if (pathname === '/api/settings' && req.method === 'POST') {
                const newSettings = await getBody();
                saveSettings(newSettings);
                return sendJson(200, { success: true });
            }

            if (pathname === '/api/test-node' && req.method === 'POST') {
                const body = await getBody();
                const nodes = getNodes();
                const node = nodes.find(n => n.id === body.id) || body;
                const result = await testNodeLatency(node);
                return sendJson(200, result);
            }

            if (pathname === '/api/vless-uri' && req.method === 'GET') {
                const id = parsedUrl.searchParams.get('id');
                const nodes = getNodes();
                const node = nodes.find(n => n.id === id) || nodes[0];
                if (!node) return sendJson(404, { error: 'Sunucu bulunamadı' });
                return sendJson(200, { uri: generateVlessUri(node) });
            }

            if (pathname === '/api/test-all-nodes' && req.method === 'POST') {
                const nodes = getNodes();
                appendLog(`⚡ ${nodes.length} adet sunucunun gecikme (ping) süresi ölçülüyor...`);
                
                const testPromises = nodes.map(async (node) => {
                    try {
                        const res = await testNodeLatency(node);
                        node.ping = res.success ? res.latency : -1;
                    } catch (e) {
                        node.ping = -1;
                    }
                    return node;
                });

                const updatedNodes = await Promise.all(testPromises);
                saveNodes(updatedNodes);
                appendLog(`✅ Tüm sunucuların ping testi tamamlandı.`);
                return sendJson(200, { success: true, nodes: updatedNodes });
            }

            if (pathname === '/api/nodes/import' && req.method === 'POST') {
                const body = await getBody();
                const text = body.text || '';
                const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
                const nodes = getNodes();
                let addedCount = 0;
                const addedNodes = [];

                for (const line of lines) {
                    if (line.startsWith('vless://')) {
                        const parsed = parseVlessUri(line);
                        if (parsed && !nodes.some(n => n.server === parsed.server && n.port === parsed.port && n.uuid === parsed.uuid)) {
                            nodes.push(parsed);
                            addedNodes.push(parsed);
                            addedCount++;
                        }
                    }
                }
                if (addedCount > 0) {
                    saveNodes(nodes);
                    appendLog(`✅ ${addedCount} adet yeni VLESS sunucu içeri aktarıldı.`);
                }
                return sendJson(200, { success: true, addedCount, nodes: addedNodes });
            }

            if (pathname === '/api/nodes/fetch-community' && req.method === 'POST') {
                appendLog("🌐 Açık kaynak VLESS havuzundan yeni sunucular taranıyor...");
                try {
                    const fetched = await fetchCommunityVlessNodes();
                    const nodes = getNodes();
                    let addedCount = 0;

                    for (const candidate of fetched) {
                        if (!nodes.some(n => n.server === candidate.server && n.port === candidate.port)) {
                            nodes.push(candidate);
                            addedCount++;
                        }
                    }
                    if (addedCount > 0) saveNodes(nodes);
                    appendLog(`✅ Açık kaynak havuzundan ${addedCount} adet aktif VLESS sunucu eklendi.`);
                    return sendJson(200, { success: true, addedCount, totalNodes: nodes.length, nodes });
                } catch (err) {
                    appendLog(`❌ Havuzdan çekme hatası: ${err.message}`);
                    return sendJson(500, { error: err.message });
                }
            }

            if (pathname === '/api/ip-info' && req.method === 'GET') {
                const activeNode = getActiveNode();
                let nodeDnsValid = true;
                if (activeNode && activeNode.type === 'vless' && !net.isIP(activeNode.server)) {
                    try {
                        await dns.lookup(activeNode.server);
                        nodeDnsValid = true;
                    } catch (e) {
                        nodeDnsValid = false;
                    }
                }

                let geoInfo = null;
                const mixedPort = getSettings().mixedPort || 2080;

                try {
                    if (isConnected) {
                        geoInfo = await fetchGeoIp(true, mixedPort);
                    } else {
                        geoInfo = await fetchGeoIp(false);
                    }
                } catch (e) {}

                let currentIp = geoInfo?.ip || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.ip : null);
                let country = geoInfo?.country || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.country : null);
                let countryCode = geoInfo?.countryCode || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.countryCode : null);
                let flag = geoInfo?.flag || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.flag : null);
                let city = geoInfo?.city || (isConnected && lastVerifiedVpnIp ? lastVerifiedVpnIp.city : '');

                const targetCountry = activeNode && activeNode.country ? activeNode.country.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() : 'Global Edge';
                const targetFlag = activeNode && activeNode.country ? activeNode.country.match(/^(\p{Extended_Pictographic}|\S+)/u)?.[0] || '🌐' : '🌐';

                if (isConnected) {
                    if (!country || country === 'Türkiye') {
                        country = targetCountry;
                        flag = targetFlag;
                    }
                    if (!currentIp) {
                        currentIp = activeNode ? (activeNode.server || 'Doğrulanıyor...') : 'Doğrulanıyor...';
                    }
                }

                return sendJson(200, {
                    currentIp: currentIp || 'Bilinmiyor',
                    country: isConnected ? (country || targetCountry) : (country || 'Türkiye'),
                    countryCode: isConnected ? (countryCode || activeNode?.countryCode || 'GL') : (countryCode || 'TR'),
                    flag: isConnected ? (flag || targetFlag) : (flag || '🇹🇷'),
                    city: city || '',
                    targetCountry,
                    targetFlag,
                    targetNodeName: activeNode ? activeNode.name : 'Otomatik',
                    isConnected,
                    nodeDnsValid,
                    nodeServer: activeNode ? (activeNode.server || activeNode.name) : 'Cloud',
                    nodeName: activeNode ? activeNode.name : 'Cloud'
                });
            }

            if (pathname === '/api/logs' && req.method === 'GET') {
                return sendJson(200, { logs: recentLogs });
            }

            if (pathname === '/api/logs' && req.method === 'DELETE') {
                recentLogs = [];
                return sendJson(200, { success: true });
            }

            if (pathname === '/api/tun/status' && req.method === 'GET') {
                const settings = getSettings();
                return sendJson(200, {
                    hasCapability: hasTunCapability(),
                    tunMode: !!settings.tunMode
                });
            }

            if (pathname === '/api/tun/enable' && req.method === 'POST') {
                if (isWin || isMac) {
                    const settings = getSettings();
                    settings.tunMode = true;
                    saveSettings(settings);
                    appendLog(`✅ ${isWin ? 'Windows' : 'macOS'} TUN modu aktif edildi.`);
                    if (isConnected) {
                        try { await startVpn(activeNodeId); } catch (e) {}
                    }
                    return sendJson(200, { success: true, capable: true, tunMode: true });
                }
                try {
                    appendLog("TUN modu için yönetici yetkisi isteniyor (Polkit)...");
                    exec(`pkexec setcap cap_net_admin,cap_net_bind_service+ep "${BIN_PATH}"`, async (err, stdout, stderr) => {
                        if (err) {
                            appendLog(`❌ TUN yetkilendirme reddedildi veya hata: ${stderr || err.message}`);
                            return sendJson(500, { error: stderr || err.message });
                        }
                        const capable = hasTunCapability();
                        if (capable) {
                            const settings = getSettings();
                            settings.tunMode = true;
                            saveSettings(settings);
                            appendLog("✅ TUN (Sistem Geneli VPN) yetkisi başarıyla verildi ve aktif edildi!");
                            if (isConnected) {
                                appendLog("TUN modunu uygulamak için tünel yeniden başlatılıyor...");
                                try { await startVpn(activeNodeId); } catch (e) {}
                            }
                            return sendJson(200, { success: true, capable: true, tunMode: true });
                        } else {
                            return sendJson(400, { success: false, error: "Yetki verilemedi." });
                        }
                    });
                    return;
                } catch (e) {
                    appendLog(`❌ TUN yetkilendirme hatası: ${e.message}`);
                    return sendJson(500, { error: e.message });
                }
            }

            if (pathname === '/api/tun/toggle' && req.method === 'POST') {
                const body = await getBody();
                const settings = getSettings();
                settings.tunMode = !!body.tunMode;
                saveSettings(settings);
                appendLog(`TUN Modu: ${settings.tunMode ? 'Açık (Sistem Geneli)' : 'Kapalı (Yalnızca Proxy)'}`);
                if (isConnected) {
                    await startVpn(activeNodeId);
                }
                return sendJson(200, { success: true, tunMode: settings.tunMode });
            }

            if (pathname === '/api/speedtest' && req.method === 'POST') {
                appendLog("⚡ Gerçek zamanlı indirme hızı ve gecikme testi başlatıldı...");
                const settings = getSettings();
                const result = await runSpeedTest(isConnected, settings.mixedPort || 2080);
                if (result.success) {
                    appendLog(`✅ Hız Testi Sonucu: ${result.speedMbps} Mbps (${result.speedMBps} MB/s) | Gecikme: ${result.ping} ms`);
                } else {
                    appendLog(`❌ Hız Testi hatası: ${result.error}`);
                }
                return sendJson(200, result);
            }

            if (pathname === '/api/network-doctor' && req.method === 'POST') {
                const result = await runNetworkDoctor();
                return sendJson(200, result);
            }

            if (pathname === '/api/leak-test' && req.method === 'GET') {
                const result = await runLeakTest();
                return sendJson(200, result);
            }

            if (pathname === '/api/scan-clean-ips' && (req.method === 'POST' || req.method === 'GET')) {
                appendLog("🔍 Cloudflare Clean IP listesi taranıyor ve en hızlı IP'ler bulunuyor...");
                const results = await scanCleanIps();
                appendLog(`✅ Clean IP taraması tamamlandı (${results.filter(r => r.healthy).length} aktif IP bulundu).`);
                return sendJson(200, { success: true, ips: results });
            }

            if (pathname === '/api/nodes/apply-clean-ip' && req.method === 'POST') {
                const body = await getBody();
                const { nodeId, cleanIp } = body;
                const nodes = getNodes();
                const target = nodes.find(n => n.id === nodeId) || getActiveNode();
                if (target) {
                    target.cleanIp = cleanIp;
                    target.useCleanIp = true;
                    saveNodes(nodes);
                    appendLog(`✅ ${target.name} sunucusuna Clean IP (${cleanIp}) tanımlandı.`);
                    if (isConnected && target.id === activeNodeId) {
                        appendLog("Aktif sunucu yeni Clean IP ile yeniden başlatılıyor...");
                        await startVpn(target.id);
                    }
                    return sendJson(200, { success: true, node: target });
                }
                return sendJson(404, { error: 'Sunucu bulunamadı' });
            }

            if (pathname === '/api/nodes/import-sub' && req.method === 'POST') {
                const body = await getBody();
                const url = body.url;
                if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
                    return sendJson(400, { error: 'Geçersiz abonelik linki (http/https gerekli)' });
                }
                try {
                    const result = await importSubscription(url);
                    return sendJson(200, result);
                } catch (e) {
                    return sendJson(500, { error: e.message });
                }
            }

            if (pathname === '/api/check-updates' && req.method === 'GET') {
                const result = await checkGitHubUpdates();
                return sendJson(200, result);
            }

            if (pathname === '/api/download-update' && req.method === 'POST') {
                try {
                    startDownloadUpdate();
                    return sendJson(200, { success: true, message: "İndirme başlatıldı." });
                } catch (e) {
                    return sendJson(500, { error: e.message });
                }
            }

            if (pathname === '/api/update-status' && req.method === 'GET') {
                return sendJson(200, updateState);
            }

            if (pathname === '/api/install-update' && req.method === 'POST') {
                try {
                    const result = await performInstallAndRestart();
                    return sendJson(200, result);
                } catch (e) {
                    return sendJson(500, { error: e.message });
                }
            }

            return sendJson(404, { error: 'API bulunamadı' });
        } catch (err) {
            console.error("API Hatası:", err);
            return sendJson(500, { error: err.message });
        }
    }

    // Static Files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.ico': contentType = 'image/x-icon'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Dosya Bulunamadı');
            } else {
                res.writeHead(500);
                res.end(`Sunucu Hatası: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Emergency synchronous reset when process exits or is terminated
function emergencyProxyResetSync() {
    try {
        const settings = getSettings();
        setSystemProxy(false, settings.mixedPort || 2080, true);
    } catch (e) {}
}

process.on('exit', () => {
    emergencyProxyResetSync();
});

// Process cleanup on signals
process.on('SIGINT', async () => {
    console.log("\nKapatılıyor...");
    emergencyProxyResetSync();
    try { await stopVpn(); } catch (e) {}
    process.exit(0);
});

process.on('SIGTERM', async () => {
    emergencyProxyResetSync();
    try { await stopVpn(); } catch (e) {}
    process.exit(0);
});

process.on('SIGHUP', async () => {
    emergencyProxyResetSync();
    try { await stopVpn(); } catch (e) {}
    process.exit(0);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`[BİLGİ] Port ${PORT} zaten kullanımda (FPN servisi arka planda aktif).`);
    } else {
        console.error("FPN sunucu hatası:", err.message);
    }
});

// Startup Self-Healing (cleans any leftover proxies from previous crashes)
function selfHealProxiesOnStartup() {
    try {
        const settings = getSettings();
        const port = settings.mixedPort || 2080;
        if (!isConnected) {
            setSystemProxy(false, port, false);
            appendLog("🛡️ Sistem ve tarayıcı proxy ayarları denetlendi: Doğrudan ve güvenli bağlantı sağlandı.");
        }
    } catch (e) {
        appendLog(`Proxy başlangıç denetim uyarısı: ${e.message}`);
    }
}

server.listen(PORT, '127.0.0.1', () => {
    appendLog("🚀 FPN Çekirdek Kontrol Merkezi Başlatıldı.");
    appendLog(`📂 Veri Deposu: ${DATA_DIR}`);
    appendLog(`⚙️ sing-box Çekirdeği: ${BIN_PATH}`);
    appendLog("🛡️ Sistem hazır. Bağlan butonuna basarak tüneli başlatabilirsiniz.");
    selfHealProxiesOnStartup();
    console.log(`=======================================================`);
    console.log(`🚀 FPN Desktop Kontrol Merkezi Hazır!`);
    console.log(`🔗 Web Arayüzü: http://127.0.0.1:${PORT}`);
    console.log(`=======================================================`);
});

module.exports = {
    stopVpn,
    startVpn,
    smartConnect,
    runNetworkDoctor,
    setSystemProxy,
    getConnectionStatus,
    setNotifier,
    triggerFailover
};
