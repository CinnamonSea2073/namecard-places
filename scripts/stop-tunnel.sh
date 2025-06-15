#!/bin/bash

# Cloudflare Tunnel停止スクリプト (Linux/macOS)

set -e

echo "Cloudflare Tunnelを停止しています..."

# Docker Composeでトンネルサービスを停止
docker-compose stop cloudflare-tunnel

echo "✅ Cloudflare Tunnelが停止されました"

# 必要に応じてコンテナも削除
read -p "コンテナも削除しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose rm -f cloudflare-tunnel
    echo "✅ Cloudflare Tunnelコンテナが削除されました"
fi
