#!/usr/bin/env bash
# ====================================================================
#  FPN System & Browser Proxy Controller (v1.0.9)
#  Bulletproof Cross-Desktop & Cross-Browser Proxy Automation
#  Supports: GNOME, KDE Plasma 5/6, XFCE/MATE, Flatpak, Zen Browser,
#            Firefox, Floorp, LibreWolf, Waterfox & Chromium Browsers
# ====================================================================

ACTION="${1:-status}"
PORT="${2:-2080}"
HOST="127.0.0.1"

# 1. GNOME / Cinnamon / MATE GSettings Proxy
set_gnome_on() {
    if command -v gsettings >/dev/null 2>&1; then
        gsettings set org.gnome.system.proxy mode 'manual' 2>/dev/null || true
        gsettings set org.gnome.system.proxy ignore-hosts "['localhost', '127.0.0.0/8', '::1', '10.0.0.0/8', '192.168.0.0/16', '172.16.0.0/12', '*.local']" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.socks host "$HOST" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.socks port "$PORT" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.http host "$HOST" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.http port "$PORT" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.https host "$HOST" 2>/dev/null || true
        gsettings set org.gnome.system.proxy.https port "$PORT" 2>/dev/null || true
    fi
}

set_gnome_off() {
    if command -v gsettings >/dev/null 2>&1; then
        gsettings set org.gnome.system.proxy mode 'none' 2>/dev/null || true
        gsettings reset org.gnome.system.proxy ignore-hosts 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.socks host 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.socks port 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.http host 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.http port 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.https host 2>/dev/null || true
        gsettings reset org.gnome.system.proxy.https port 2>/dev/null || true
    fi
}

# 2. KDE Plasma 5 / 6 KIO Proxy
set_kde_on() {
    if command -v kwriteconfig6 >/dev/null 2>&1; then
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "ProxyType" 1 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "NoProxyFor" "localhost,127.0.0.1,::1,10.0.0.0/8,192.168.0.0/16,*.local" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "socksProxy" "socks5://$HOST:$PORT" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "httpProxy" "http://$HOST:$PORT" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "httpsProxy" "http://$HOST:$PORT" 2>/dev/null || true
        qdbus6 org.kde.kded6 /kded org.kde.kded6.reconfigure 2>/dev/null || true
        dbus-send --type=signal / org.kde.KIO.ReparseConfiguration 2>/dev/null || true
    elif command -v kwriteconfig5 >/dev/null 2>&1; then
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "ProxyType" 1 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "NoProxyFor" "localhost,127.0.0.1,::1,10.0.0.0/8,192.168.0.0/16,*.local" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "socksProxy" "socks5://$HOST:$PORT" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "httpProxy" "http://$HOST:$PORT" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "httpsProxy" "http://$HOST:$PORT" 2>/dev/null || true
        qdbus org.kde.kded5 /kded org.kde.kded5.reconfigure 2>/dev/null || true
        dbus-send --type=signal / org.kde.KIO.ReparseConfiguration 2>/dev/null || true
    fi
}

set_kde_off() {
    if command -v kwriteconfig6 >/dev/null 2>&1; then
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "ProxyType" 0 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "NoProxyFor" "" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "socksProxy" "" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "httpProxy" "" 2>/dev/null || true
        kwriteconfig6 --file kioslaverc --group "Proxy Settings" --key "httpsProxy" "" 2>/dev/null || true
        qdbus6 org.kde.kded6 /kded org.kde.kded6.reconfigure 2>/dev/null || true
        dbus-send --type=signal / org.kde.KIO.ReparseConfiguration 2>/dev/null || true
    elif command -v kwriteconfig5 >/dev/null 2>&1; then
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "ProxyType" 0 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "NoProxyFor" "" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "socksProxy" "" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "httpProxy" "" 2>/dev/null || true
        kwriteconfig5 --file kioslaverc --group "Proxy Settings" --key "httpsProxy" "" 2>/dev/null || true
        qdbus org.kde.kded5 /kded org.kde.kded5.reconfigure 2>/dev/null || true
        dbus-send --type=signal / org.kde.KIO.ReparseConfiguration 2>/dev/null || true
    fi
}

# 3. Flatpak Overrides Cleanup
# Flatpak overrides must NOT be used for dynamic proxy routing because:
#  - Running Flatpak instances do not pick up runtime override changes.
#  - Any instance launched during proxy stays permanently poisoned to 127.0.0.1.
# System proxies (GNOME GSettings, KDE kioslaverc) and TUN mode are the clean solutions.
set_flatpak_on() {
    # Do not write disk overrides to avoid poisoning running/restarting Flatpak apps
    :
}

set_flatpak_off() {
    if command -v flatpak >/dev/null 2>&1; then
        for app in "${FLATPAK_APPS[@]}"; do
            flatpak override --user --unset-env=http_proxy --unset-env=https_proxy --unset-env=all_proxy "$app" 2>/dev/null || true
        done
        for ovr in "$HOME/.local/share/flatpak/overrides/"*; do
            if [ -f "$ovr" ]; then
                sed -i '/unset-environment=.*proxy/d' "$ovr" 2>/dev/null || true
                sed -i '/^http_proxy=/d; /^https_proxy=/d; /^all_proxy=/d' "$ovr" 2>/dev/null || true
            fi
        done
    fi
}

# 4. Browser Profile Self-Healing & Sanity Maintenance
# (Zen Browser, Firefox, Floorp, LibreWolf, Waterfox)
# RULE: Reset any stuck proxy in Gecko profiles to 0 (No proxy / Direct Connection).
# This ensures that browsers NEVER get stuck waiting for 127.0.0.1:2080.
heal_and_clean_gecko_profiles() {
    local search_paths=(
        "$HOME/.var/app/app.zen_browser.zen/.zen"
        "$HOME/.zen"
        "$HOME/.mozilla/firefox"
        "$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox"
        "$HOME/.librewolf"
        "$HOME/.var/app/io.gitlab.librewolf-community/.librewolf"
        "$HOME/.floorp"
        "$HOME/.var/app/one.ablaze.floorp/.floorp"
        "$HOME/.waterfox"
        "$HOME/.var/app/net.waterfox.waterfox/.waterfox"
    )

    local profile_dirs=()
    for sp in "${search_paths[@]}"; do
        if [ -d "$sp" ]; then
            while IFS= read -r -d '' p; do
                profile_dirs+=("$p")
            done < <(find "$sp" -maxdepth 1 -type d -name "*.*" -print0 2>/dev/null)
        fi
    done

    for pdir in "${profile_dirs[@]}"; do
        local ujs="$pdir/user.js"
        local pjs="$pdir/prefs.js"

        # 1. Enforce user.js direct connection shield so browser always starts clean
        cat << 'EOF' > "$ujs"
// FPN Safe Direct Connection
user_pref("network.proxy.type", 0);
user_pref("network.proxy.http", "");
user_pref("network.proxy.http_port", 0);
user_pref("network.proxy.ssl", "");
user_pref("network.proxy.ssl_port", 0);
user_pref("network.proxy.socks", "");
user_pref("network.proxy.socks_port", 0);
user_pref("network.proxy.socks_remote_dns", false);
EOF

        # 2. Heal prefs.js: strip any stuck 127.0.0.1 proxies and enforce type 0
        if [ -f "$pjs" ]; then
            sed -i '/user_pref("network\.proxy\./d' "$pjs" 2>/dev/null || true
            echo 'user_pref("network.proxy.type", 0);' >> "$pjs"
        fi
    done
}

case "$ACTION" in
    on|enable)
        set_gnome_on
        set_kde_on
        set_flatpak_on
        # Clean any corrupted user.js from older buggy versions so browsers follow system proxy
        heal_and_clean_gecko_profiles
        echo "PROXY_ENABLED"
        ;;
    off|disable|clean|repair)
        set_gnome_off
        set_kde_off
        set_flatpak_off
        heal_and_clean_gecko_profiles
        echo "PROXY_DISABLED"
        ;;
    status)
        echo "READY"
        ;;
    *)
        echo "Usage: $0 [on|off|clean|repair|status] [port]"
        exit 1
        ;;
esac
