#!/bin/bash

# Cloudflare Tunnel状態確認スクリプト (Linux/macOS)

set -e

echo "=== Cloudflare Tunnel 状態確認 ==="
echo

# Docker Composeサービス状態確認
echo "📋 Docker Composeサービス状態:"
docker-compose ps cloudflare-tunnel

echo
echo "📊 コンテナログ (最新10行):"
docker-compose logs --tail=10 cloudflare-tunnel

echo
echo "🔗 トンネル接続状態:"
if docker-compose exec cloudflare-tunnel wget --spider -q http://localhost:8081/metrics 2>/dev/null; then
    echo "✅ メトリクスエンドポイントにアクセス可能"
    echo "   ヘルスチェック: 正常"
else
    echo "❌ メトリクスエンドポイントにアクセス不可"
    echo "   ヘルスチェック: 異常"
fi

# 環境変数確認
echo
echo "🔧 設定確認:"
if [ -f .env ]; then
    echo "✅ .envファイル: 存在"
    if grep -q "TUNNEL_TOKEN=" .env; then
        echo "✅ TUNNEL_TOKEN: 設定済み"
    else
        echo "❌ TUNNEL_TOKEN: 未設定"
    fi
else
    echo "❌ .envファイル: 存在しません"
fi
