#!/usr/bin/env bash
# ====================================================================
#  FPN (Freedom Private Network) - Masaüstü Uygulaması Başlatıcı
# ====================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$DIR/bin/sing-box"
ELECTRON_BIN="$DIR/node_modules/.bin/electron"

echo "======================================================="
echo "🛡️  FPN Masaüstü Uygulaması Açılıyor..."
echo "======================================================="

# sing-box çekirdek kontrolü
if [ ! -f "$BIN_PATH" ]; then
    echo "⚠️  sing-box çekirdeği hazırlanıyor..."
    mkdir -p "$DIR/bin"
    curl -L -o "$DIR/bin/sing-box.tar.gz" "https://github.com/SagerNet/sing-box/releases/download/v1.14.3/sing-box-1.14.3-linux-amd64.tar.gz"
    tar -xzf "$DIR/bin/sing-box.tar.gz" -C "$DIR/bin"
    mv "$DIR/bin/sing-box-1.14.3-linux-amd64/sing-box" "$DIR/bin/sing-box"
    rm -rf "$DIR/bin/sing-box-1.14.3-linux-amd64" "$DIR/bin/sing-box.tar.gz"
    chmod +x "$DIR/bin/sing-box"
fi

# Masaüstü uygulaması (Electron) olarak çalıştır
if [ -f "$ELECTRON_BIN" ]; then
    exec "$ELECTRON_BIN" "$DIR" "$@"
else
    # Electron henüz inmemişse npm start ile dene veya arka uç başlat
    exec npx electron "$DIR" "$@"
fi
