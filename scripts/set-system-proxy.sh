#!/usr/bin/env bash
# ====================================================================
#  FPN System & Browser Proxy Controller (v1.0.8)
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

# 3. Flatpak Overrides for Browsers
FLATPAK_APPS=(
    "app.zen_browser.zen"
    "org.mozilla.firefox"
    "io.gitlab.librewolf-community"
    "one.ablaze.floorp"
    "net.waterfox.waterfox"
    "com.brave.Browser"
    "com.google.Chrome"
    "org.chromium.Chromium"
    "com.microsoft.Edge"
    "com.opera.Opera"
    "com.vivaldi.Vivaldi"
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
                sed -i '/^http_proxy=/d; /^https_proxy=/d; /^all_proxy=/d' "$ovr" 2>/dev/null || true
            fi
        done
    fi
}

# 4. Browser Profile Self-Healing & Sanity Maintenance
# (Zen Browser, Firefox, Floorp, LibreWolf, Waterfox)
# RULE: Never hardcode `network.proxy.type = 1` into user profile files.
# All Gecko browsers must remain on `type = 5` (Use System Proxy Settings)
# so they dynamically obey GNOME/KDE/Flatpak proxies without bricking when FPN stops.
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

        # 1. Clean user.js: remove any leftover FPN blocks or manual 127.0.0.1 proxies
        if [ -f "$ujs" ]; then
            sed -i '/\/\/ --- FPN PROXY CONFIG START ---/,/\/\/ --- FPN PROXY CONFIG END ---/d' "$ujs" 2>/dev/null || true
            sed -i '/\/\/ FPN Proxy Reset/,+10d' "$ujs" 2>/dev/null || true
            sed -i '/user_pref("network\.proxy\./d' "$ujs" 2>/dev/null || true
            # Delete user.js if empty or only whitespace
            if ! grep -q '[^[:space:]]' "$ujs" 2>/dev/null; then
                rm -f "$ujs" 2>/dev/null || true
            fi
        fi

        # 2. Heal prefs.js: reset stuck manual proxy to System Proxy (5)
        if [ -f "$pjs" ]; then
            # If prefs.js is pointing to localhost / 127.0.0.1 proxy, revert to system proxy (5)
            if grep -q '127\.0\.0\.1' "$pjs" 2>/dev/null || grep -q '"network\.proxy\.type", 1' "$pjs" 2>/dev/null; then
                sed -i 's/user_pref("network\.proxy\.type", [0-9]);/user_pref("network\.proxy\.type", 5);/g' "$pjs" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.http/d' "$pjs" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.ssl/d' "$pjs" 2>/dev/null || true
                sed -i '/user_pref("network\.proxy\.socks/d' "$pjs" 2>/dev/null || true
            fi
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
