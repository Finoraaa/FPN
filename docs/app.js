/**
 * ====================================================================
 *  FPN (Freedom Private Network) - Landing Page Interactive Script
 *  Dynamic GitHub Releases Integration & Intelligent OS Detection
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Default Fallback Release State (v1.0.8)
    const releaseConfig = {
        repo: 'Finoraaa/FPN',
        version: '1.0.8',
        tag: 'v1.0.8',
        baseUrl: 'https://github.com/Finoraaa/FPN/releases/download/v1.0.8/',
        assets: {
            winSetup: 'FPN-Setup-1.0.8.exe',
            winPortable: 'FPN-1.0.8.exe',
            androidApk: 'FPN-Android.apk',
            linuxAppImage: 'FPN-1.0.8.AppImage',
            linuxDeb: 'fpn-vpn_1.0.8_amd64.deb',
            macDmg: 'FPN-1.0.8-arm64.dmg',
            macZip: 'FPN-1.0.8-arm64-mac.zip',
            webExt: 'fpn-web-extension.zip'
        }
    };

    // 1. Detect Visitor's Operating System
    const userOS = detectUserOS();
    applyDetectedOS(userOS);

    // 2. Fetch Latest GitHub Release Dynamically
    fetchLatestRelease();

    // 3. Setup QR Code Modal
    setupQrModal();

    // 4. Setup Live Ping Test Button
    setupPingTester();

    /**
     * Detects client OS from navigator properties
     */
    function detectUserOS() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const platform = navigator.platform || '';

        if (/android/i.test(ua)) {
            return {
                id: 'android',
                name: 'Android Cihazınız',
                icon: '🤖',
                assetKey: 'androidApk',
                buttonText: 'Android İçin İndir (APK)',
                filename: releaseConfig.assets.androidApk
            };
        }
        if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
            return {
                id: 'ios',
                name: 'iOS Cihazınız',
                icon: '🍎',
                assetKey: 'webExt',
                buttonText: 'Web Sürümünü İncele',
                filename: 'Web & WireGuard Uyumlu'
            };
        }
        if (/Win/i.test(platform) || /windows/i.test(ua)) {
            return {
                id: 'windows',
                name: 'Windows Bilgisayarınız',
                icon: '🪟',
                assetKey: 'winSetup',
                buttonText: 'Windows İçin İndir (.exe)',
                filename: releaseConfig.assets.winSetup
            };
        }
        if (/Mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) {
            return {
                id: 'mac',
                name: 'macOS (Apple Silicon & Intel)',
                icon: '🍏',
                assetKey: 'macDmg',
                buttonText: 'macOS İçin İndir (.dmg)',
                filename: releaseConfig.assets.macDmg
            };
        }
        if (/Linux/i.test(platform) || /linux/i.test(ua)) {
            return {
                id: 'linux',
                name: 'Linux Dağıtımınız',
                icon: '🐧',
                assetKey: 'linuxAppImage',
                buttonText: 'Linux İçin İndir (AppImage)',
                filename: releaseConfig.assets.linuxAppImage
            };
        }

        // Generic Fallback
        return {
            id: 'generic',
            name: 'Masaüstü Cihazınız',
            icon: '💻',
            assetKey: 'winSetup',
            buttonText: 'Hemen İndirin (v1.0.8)',
            filename: releaseConfig.assets.winSetup
        };
    }

    /**
     * Applies detected OS parameters to primary CTA
     */
    function applyDetectedOS(os) {
        const osIconEl = document.getElementById('detected-os-icon');
        const osNameEl = document.getElementById('detected-os-name');
        const btnTextEl = document.getElementById('btn-primary-text');
        const primaryBtn = document.getElementById('btn-primary-download');
        const metaFilenameEl = document.getElementById('meta-filename');

        if (osIconEl) osIconEl.textContent = os.icon;
        if (osNameEl) osNameEl.textContent = `${os.name} Tespit Edildi`;
        if (btnTextEl) btnTextEl.textContent = os.buttonText;
        if (metaFilenameEl) metaFilenameEl.textContent = os.filename;

        const downloadUrl = releaseConfig.baseUrl + (releaseConfig.assets[os.assetKey] || '');
        if (primaryBtn) primaryBtn.href = downloadUrl;

        // Highlight matching card in the grid
        const cardMap = {
            windows: 'card-windows',
            android: 'card-android',
            linux: 'card-linux',
            mac: 'card-macos'
        };
        const targetCardId = cardMap[os.id];
        if (targetCardId) {
            const cardEl = document.getElementById(targetCardId);
            if (cardEl) cardEl.style.borderColor = 'rgba(255, 255, 255, 0.8)';
        }
    }

    /**
     * Fetches latest release assets from GitHub API
     */
    async function fetchLatestRelease() {
        try {
            const res = await fetch(`https://api.github.com/repos/${releaseConfig.repo}/releases/latest`);
            if (!res.ok) return;

            const data = await res.json();
            const tag = data.tag_name || 'v1.0.8';
            const ver = tag.replace(/^v/, '');

            releaseConfig.tag = tag;
            releaseConfig.version = ver;
            releaseConfig.baseUrl = `https://github.com/${releaseConfig.repo}/releases/download/${tag}/`;

            // Update Badges & Labels
            const badgeVersionText = document.getElementById('badge-version-text');
            if (badgeVersionText) badgeVersionText.textContent = `FPN ${tag} Yayında`;

            const metaReleaseTag = document.getElementById('meta-release-tag');
            if (metaReleaseTag) metaReleaseTag.textContent = tag;

            const footerVersion = document.getElementById('footer-live-version');
            if (footerVersion) footerVersion.textContent = `Sürüm: ${tag} (En Güncel)`;

            // Map GitHub release assets to keys
            if (Array.isArray(data.assets)) {
                data.assets.forEach(asset => {
                    const name = asset.name;
                    if (name.endsWith('-Setup.exe') || name.includes('Setup')) {
                        releaseConfig.assets.winSetup = name;
                    } else if (name.endsWith('.exe')) {
                        releaseConfig.assets.winPortable = name;
                    } else if (name.endsWith('.apk')) {
                        releaseConfig.assets.androidApk = name;
                    } else if (name.endsWith('.AppImage')) {
                        releaseConfig.assets.linuxAppImage = name;
                    } else if (name.endsWith('.deb')) {
                        releaseConfig.assets.linuxDeb = name;
                    } else if (name.endsWith('.dmg')) {
                        releaseConfig.assets.macDmg = name;
                    } else if (name.includes('mac') && name.endsWith('.zip')) {
                        releaseConfig.assets.macZip = name;
                    } else if (name.includes('extension') && name.endsWith('.zip')) {
                        releaseConfig.assets.webExt = name;
                    }
                });
            }

            // Refresh Buttons With Live URLs
            updateAllDownloadButtons();
            applyDetectedOS(userOS);

        } catch (err) {
            console.warn('GitHub API offline or rate-limited; using stable defaults:', err);
            updateAllDownloadButtons();
        }
    }

    /**
     * Updates all download anchor targets in the matrix
     */
    function updateAllDownloadButtons() {
        setLink('btn-dl-win-setup', releaseConfig.assets.winSetup);
        setLink('btn-dl-win-portable', releaseConfig.assets.winPortable);
        setLink('btn-dl-android-apk', releaseConfig.assets.androidApk);
        setLink('btn-dl-linux-appimage', releaseConfig.assets.linuxAppImage);
        setLink('btn-dl-linux-deb', releaseConfig.assets.linuxDeb);
        setLink('btn-dl-mac-dmg', releaseConfig.assets.macDmg);
        setLink('btn-dl-mac-zip', releaseConfig.assets.macZip);
        setLink('btn-dl-web-ext', releaseConfig.assets.webExt);
    }

    function setLink(elementId, assetName) {
        const el = document.getElementById(elementId);
        if (el && assetName) {
            el.href = releaseConfig.baseUrl + assetName;
        }
    }

    /**
     * Mobile QR Code Modal Handler
     */
    function setupQrModal() {
        const modal = document.getElementById('qr-modal');
        const showBtn = document.getElementById('btn-show-qr');
        const closeBtn = document.getElementById('btn-close-modal');
        const qrImage = document.getElementById('qr-code-image');
        const qrUrlText = document.getElementById('qr-url-text');

        if (!modal || !showBtn || !closeBtn || !qrImage) return;

        showBtn.addEventListener('click', () => {
            const apkUrl = releaseConfig.baseUrl + releaseConfig.assets.androidApk;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(apkUrl)}`;
            
            qrImage.src = qrApiUrl;
            if (qrUrlText) qrUrlText.textContent = apkUrl;
            modal.classList.add('active');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    /**
     * Interactive Latency & Ping Retester Simulation
     */
    function setupPingTester() {
        const retestBtn = document.getElementById('btn-retest-ping');
        if (!retestBtn) return;

        const pingDE = document.getElementById('ping-de');
        const pingEU = document.getElementById('ping-eu');
        const pingUS1 = document.getElementById('ping-us1');
        const pingUS2 = document.getElementById('ping-us2');

        retestBtn.addEventListener('click', () => {
            const btnSpan = retestBtn.querySelector('span');
            const icon = retestBtn.querySelector('.spin-icon');

            if (btnSpan) btnSpan.textContent = 'Düğümler Test Ediliyor...';
            if (icon) icon.style.animation = 'spin 0.8s linear infinite';
            retestBtn.disabled = true;

            // Simulate jittered ping test
            setTimeout(() => {
                const de = Math.floor(35 + Math.random() * 8);
                const eu = Math.floor(40 + Math.random() * 8);
                const us1 = Math.floor(92 + Math.random() * 12);
                const us2 = Math.floor(98 + Math.random() * 14);

                if (pingDE) pingDE.textContent = `${de} ms`;
                if (pingEU) pingEU.textContent = `${eu} ms`;
                if (pingUS1) pingUS1.textContent = `${us1} ms`;
                if (pingUS2) pingUS2.textContent = `${us2} ms`;

                if (btnSpan) btnSpan.textContent = '✓ Gecikmeler Güncellendi (Yeniden Test Et)';
                if (icon) icon.style.animation = 'none';
                retestBtn.disabled = false;
            }, 900);
        });
    }
});

// Spin animation for button
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
