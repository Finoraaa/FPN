/**
 * ====================================================================
 *  FPN (Freedom Private Network) - Masaüstü Uygulaması (Electron Core)
 *  Gelişmiş Sistem Tepsisi (System Tray) & Arka Plan Desteği
 * ====================================================================
 */

const { app, BrowserWindow, Menu, Tray, session, shell, nativeImage, globalShortcut, Notification } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// Electron'un yerel localhost trafiğini sistem proxy'sinden muaf tutmasını sağla
app.commandLine.appendSwitch('proxy-bypass-list', '<local>;127.0.0.1;localhost');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Tek örnek kilidi (Uygulamanın iki kez açılmasını engeller)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

let backendService = null;

function showDesktopNotification(title, body) {
    try {
        const iconPath = path.join(__dirname, 'client', 'public', 'img', 'icon.png');
        if (Notification.isSupported()) {
            new Notification({
                title: title,
                body: body,
                icon: iconPath
            }).show();
        } else {
            exec(`notify-send -i "${iconPath}" "${title.replace(/"/g, '\\"')}" "${body.replace(/"/g, '\\"')}" 2>/dev/null || true`);
        }
    } catch (e) {
        try {
            const iconPath = path.join(__dirname, 'client', 'public', 'img', 'icon.png');
            exec(`notify-send -i "${iconPath}" "${title.replace(/"/g, '\\"')}" "${body.replace(/"/g, '\\"')}" 2>/dev/null || true`);
        } catch (ex) {}
    }
}

async function toggleVpnConnection() {
    try {
        if (!backendService) return;
        const status = backendService.getConnectionStatus ? backendService.getConnectionStatus() : null;
        if (status && status.isConnected) {
            await backendService.stopVpn();
        } else {
            if (typeof backendService.smartConnect === 'function') {
                await backendService.smartConnect();
            } else {
                await backendService.startVpn();
            }
        }
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript('if (typeof fetchStatus === "function") fetchStatus();');
        }
    } catch (err) {
        showDesktopNotification("❌ FPN Bağlantı Hatası", err.message);
    }
}

function startBackend() {
    try {
        backendService = require(path.join(__dirname, 'client', 'server.js'));
        if (backendService && typeof backendService.setNotifier === 'function') {
            backendService.setNotifier((title, body) => {
                showDesktopNotification(title, body);
            });
        }
    } catch (e) {
        console.log("Arka uç servisi hazır veya zaten çalışıyor:", e.message);
    }
}

function createTray() {
    try {
        const iconPath = path.join(__dirname, 'client', 'public', 'img', 'icon.png');
        const icon = nativeImage.createFromPath(iconPath);
        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: '🛡️ FPN - Freedom Private Network',
                enabled: false
            },
            { type: 'separator' },
            {
                label: '⚡ VPN Aç / Kapat (Ctrl+Alt+V)',
                click: async () => {
                    await toggleVpnConnection();
                }
            },
            {
                label: 'Arayüzü Göster / Gizle',
                click: () => {
                    if (mainWindow.isVisible()) {
                        mainWindow.hide();
                    } else {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Tamamen Kapat (Çıkış)',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('FPN - Freedom Private Network (Kısayol: Ctrl+Alt+V)');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } catch (err) {
        console.log("Tray başlatma uyarısı:", err.message);
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'client', 'public', 'img', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1140,
        height: 800,
        minWidth: 940,
        minHeight: 640,
        title: 'FPN - Freedom Private Network',
        icon: iconPath,
        backgroundColor: '#09090b',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    // Menü çubuğunu temizle
    Menu.setApplicationMenu(null);

    // Oturum proxy ayarını localhost için direct olarak zorla
    session.defaultSession.setProxy({
        proxyBypassRules: '<local>,127.0.0.1,localhost'
    });

    // Doğrudan yerel dosya olarak aç
    const indexPath = path.join(__dirname, 'client', 'public', 'index.html');
    mainWindow.loadFile(indexPath);

    // Dış bağlantıları varsayılan web tarayıcısında aç
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // Pencere kapatıldığında arka planda tepside tut
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startBackend();
    createWindow();
    createTray();

    try {
        globalShortcut.register('CommandOrControl+Alt+V', async () => {
            await toggleVpnConnection();
        });
    } catch (e) {
        console.log("Global kısayol kaydı uyarısı:", e.message);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
});

let isCleaningUp = false;

app.on('will-quit', () => {
    try {
        globalShortcut.unregisterAll();
    } catch (e) {}
});

app.on('before-quit', async (event) => {
    if (isCleaningUp) return;
    if (backendService && typeof backendService.stopVpn === 'function') {
        event.preventDefault();
        isCleaningUp = true;
        isQuitting = true;
        try {
            await backendService.stopVpn();
        } catch (e) {}
        app.quit();
    } else {
        isQuitting = true;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) {
        app.quit();
    }
});
