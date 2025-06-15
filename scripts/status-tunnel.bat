@echo off
setlocal enabledelayedexpansion

REM Cloudflare Tunnel状態確認スクリプト (Windows)

echo === Cloudflare Tunnel 状態確認 ===
echo.

REM Docker Composeサービス状態確認
echo 📋 Docker Composeサービス状態:
docker-compose ps cloudflare-tunnel

echo.
echo 📊 コンテナログ (最新10行):
docker-compose logs --tail=10 cloudflare-tunnel

echo.
echo 🔗 トンネル接続状態:
docker-compose exec cloudflare-tunnel wget --spider -q http://localhost:8081/metrics >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ メトリクスエンドポイントにアクセス可能
    echo    ヘルスチェック: 正常
) else (
    echo ❌ メトリクスエンドポイントにアクセス不可
    echo    ヘルスチェック: 異常
)

REM 環境変数確認
echo.
echo 🔧 設定確認:
if exist .env (
    echo ✅ .envファイル: 存在
    findstr /C:"TUNNEL_TOKEN=" .env >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✅ TUNNEL_TOKEN: 設定済み
    ) else (
        echo ❌ TUNNEL_TOKEN: 未設定
    )
) else (
    echo ❌ .envファイル: 存在しません
)

pause
