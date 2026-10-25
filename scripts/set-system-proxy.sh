#!/usr/bin/env bash
# ====================================================================
#  FPN System & Browser Proxy Controller (v1.1.0)
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
        for schema in "org.gnome.system.proxy" "org.cinnamon.system.proxy" "org.mate.system.proxy"; do
            if gsettings list-schemas 2>/dev/null | grep -qx "$schema"; then
                gsettings set "$schema" mode 'manual' 2>/dev/null || true
                gsettings set "$schema" ignore-hosts "['localhost', '127.0.0.0/8', '::1', '10.0.0.0/8', '192.168.0.0/16', '172.16.0.0/12', '*.local']" 2>/dev/null || true
                gsettings set "$schema.socks" host "$HOST" 2>/dev/null || true
                gsettings set "$schema.socks" port "$PORT" 2>/dev/null || true
                gsettings set "$schema.http" host "$HOST" 2>/dev/null || true
                gsettings set "$schema.http" port "$PORT" 2>/dev/null || true
                gsettings set "$schema.https" host "$HOST" 2>/dev/null || true
                gsettings set "$schema.https" port "$PORT" 2>/dev/null || true
            fi
        done
    fi
}

set_gnome_off() {
    if command -v gsettings >/dev/null 2>&1; then
        for schema in "org.gnome.system.proxy" "org.cinnamon.system.proxy" "org.mate.system.proxy"; do
            if gsettings list-schemas 2>/dev/null | grep -qx "$schema"; then
                gsettings set "$schema" mode 'none' 2>/dev/null || true
                gsettings reset "$schema" ignore-hosts 2>/dev/null || true
                gsettings reset "$schema.socks" host 2>/dev/null || true
                gsettings reset "$schema.socks" port 2>/dev/null || true
                gsettings reset "$schema.http" host 2>/dev/null || true
                gsettings reset "$schema.http" port 2>/dev/null || true
                gsettings reset "$schema.https" host 2>/dev/null || true
                gsettings reset "$schema.https" port 2>/dev/null || true
            fi
        done
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
set_flatpak_on() {
    :
}

set_flatpak_off() {
    if command -v flatpak >/dev/null 2>&1; then
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
# Type 5 = Use System Proxy Settings (standard in modern Firefox).
# When system proxy is ON, browsers follow FPN; when OFF, browsers connect directly.
sync_gecko_profiles() {
    local target_type="${1:-5}" # default 5 (system proxy)
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

        # Enforce type 5 (system proxy) and remote DNS
        cat << EOF > "$ujs"
// FPN System Proxy Synchronization
user_pref("network.proxy.type", ${target_type});
user_pref("network.proxy.socks_remote_dns", true);
EOF

        if [ -f "$pjs" ]; then
            sed -i '/user_pref("network\.proxy\./d' "$pjs" 2>/dev/null || true
            echo "user_pref(\"network.proxy.type\", ${target_type});" >> "$pjs"
        fi
    done
}

case "$ACTION" in
    on|enable)
        set_gnome_on
        set_kde_on
        set_flatpak_on
        sync_gecko_profiles 5
        echo "PROXY_ENABLED"
        ;;
    off|disable|clean|repair)
        set_gnome_off
        set_kde_off
        set_flatpak_off
        sync_gecko_profiles 5
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
