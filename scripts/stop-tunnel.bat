@echo off
setlocal enabledelayedexpansion

REM Cloudflare Tunnel停止スクリプト (Windows)

echo Cloudflare Tunnelを停止しています...

REM Docker Composeでトンネルサービスを停止
docker-compose stop cloudflare-tunnel

if !errorlevel! neq 0 (
    echo ❌ Cloudflare Tunnelの停止に失敗しました
    pause
    exit /b 1
)

echo ✅ Cloudflare Tunnelが停止されました

REM 必要に応じてコンテナも削除
set /p choice="コンテナも削除しますか？ (y/N): "
if /i "!choice!"=="y" (
    docker-compose rm -f cloudflare-tunnel
    echo ✅ Cloudflare Tunnelコンテナが削除されました
)

pause
