#!/usr/bin/env bash
# ====================================================================
#  FPN System & Browser Proxy Controller
#  Supports: GNOME, KDE 5/6, Zen Browser (Flatpak & Native), Firefox
# ====================================================================

ACTION="${1:-status}"
PORT="${2:-2080}"
HOST="127.0.0.1"

# 1. GNOME GSettings Proxy
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

# 3. Flatpak Overrides for Zen Browser, Firefox & Chromium-based Browsers
FLATPAK_APPS=(
    "app.zen_browser.zen"
    "org.mozilla.firefox"
    "io.gitlab.librewolf-community"
    "one.ablaze.floorp"
    "com.brave.Browser"
    "com.google.Chrome"
    "org.chromium.Chromium"
    "com.microsoft.Edge"
)

set_flatpak_on() {
    if command -v flatpak >/dev/null 2>&1; then
        for app in "${FLATPAK_APPS[@]}"; do
            flatpak override --user --env=http_proxy="http://$HOST:$PORT" --env=https_proxy="http://$HOST:$PORT" --env=all_proxy="socks5://$HOST:$PORT" "$app" 2>/dev/null || true
        done
    fi
}

set_flatpak_off() {
    if command -v flatpak >/dev/null 2>&1; then
        for app in "${FLATPAK_APPS[@]}"; do
            flatpak override --user --unset-env=http_proxy --unset-env=https_proxy --unset-env=all_proxy "$app" 2>/dev/null || true
        done
        for ovr in "$HOME/.local/share/flatpak/overrides/"*; do
            if [ -f "$ovr" ]; then
                sed -i '/^http_proxy=$/d; /^https_proxy=$/d; /^all_proxy=$/d' "$ovr" 2>/dev/null || true
            fi
        done
    fi
}

# 4. Firefox, Zen Browser & Gecko Profile user.js & prefs.js
apply_browser_user_js() {
    local enable="$1"
    local profile_dirs=()

    # Browser profile base directories (both native and Flatpak)
    local search_paths=(
        "$HOME/.var/app/app.zen_browser.zen/.zen"
        "$HOME/.zen"
        "$HOME/.mozilla/firefox"
        "$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox"
        "$HOME/.librewolf"
        "$HOME/.var/app/io.gitlab.librewolf-community/.librewolf"
        "$HOME/.floorp"
        "$HOME/.var/app/one.ablaze.floorp/.floorp"
    )

    for sp in "${search_paths[@]}"; do
        if [ -d "$sp" ]; then
            while IFS= read -r -d '' p; do
                profile_dirs+=("$p")
            done < <(find "$sp" -maxdepth 1 -type d -name "*.*" -print0 2>/dev/null)
        fi
    done

    for pdir in "${profile_dirs[@]}"; do
        local ujs="$pdir/user.js"
        if [ "$enable" = "on" ]; then
            # Clean old FPN block if present
            if [ -f "$ujs" ]; then
                sed -i '/\/\/ --- FPN PROXY CONFIG START ---/,/\/\/ --- FPN PROXY CONFIG END ---/d' "$ujs" 2>/dev/null || true
            fi
            cat <<EOF >> "$ujs"
// --- FPN PROXY CONFIG START ---
user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "$HOST");
user_pref("network.proxy.http_port", $PORT);
user_pref("network.proxy.ssl", "$HOST");
user_pref("network.proxy.ssl_port", $PORT);
user_pref("network.proxy.socks", "$HOST");
user_pref("network.proxy.socks_port", $PORT);
user_pref("network.proxy.socks_version", 5);
user_pref("network.proxy.socks_remote_dns", true);
// --- FPN PROXY CONFIG END ---
EOF
        else
            # Remove FPN block cleanly without wiping other custom settings
            if [ -f "$ujs" ]; then
                sed -i '/\/\/ --- FPN PROXY CONFIG START ---/,/\/\/ --- FPN PROXY CONFIG END ---/d' "$ujs" 2>/dev/null || true
                # Remove file if empty or only contains whitespace
                if ! grep -q '[^[:space:]]' "$ujs" 2>/dev/null; then
                    rm -f "$ujs" 2>/dev/null || true
                fi
            fi
            # Clean prefs.js so manual proxy reverts to system proxy (5)
            if [ -f "$pdir/prefs.js" ]; then
                sed -i 's/user_pref("network\.proxy\.type", 1);/user_pref("network\.proxy\.type", 5);/g' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.http"/d' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.http_port"/d' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.ssl"/d' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.ssl_port"/d' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.socks"/d' "$pdir/prefs.js" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.socks_port"/d' "$pdir/prefs.js" 2>/dev/null || true
            fi
        fi
    done
}

case "$ACTION" in
    on|enable)
        set_gnome_on
        set_kde_on
        set_flatpak_on
        apply_browser_user_js "on"
        echo "PROXY_ENABLED"
        ;;
    off|disable)
        set_gnome_off
        set_kde_off
        set_flatpak_off
        apply_browser_user_js "off"
        echo "PROXY_DISABLED"
        ;;
    status)
        echo "READY"
        ;;
    *)
        echo "Usage: $0 [on|off|status] [port]"
        exit 1
        ;;
esac
