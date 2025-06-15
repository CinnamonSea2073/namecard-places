@echo off
setlocal enabledelayedexpansion

REM Cloudflare Tunnel 開始スクリプト (Windows版)
REM 設定済みのトンネルを開始します

set TUNNEL_NAME=namecard-places-tunnel
set CONFIG_FILE=cloudflare-tunnel.yml

REM cloudflaredがインストールされているかチェック
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ cloudflaredがインストールされていません。
    echo ℹ️  セットアップスクリプトを実行してください: scripts\setup-cloudflare-tunnel.bat
    exit /b 1
)

REM 設定ファイルが存在するかチェック
if not exist "%CONFIG_FILE%" (
    echo ❌ 設定ファイル '%CONFIG_FILE%' が見つかりません。
    echo ℹ️  セットアップスクリプトを実行してください: scripts\setup-cloudflare-tunnel.bat
    exit /b 1
)

echo ✅ 前提条件のチェックが完了しました

REM 開発サーバーの状態をチェック
echo ℹ️  開発サーバーの状態をチェックします...

REM フロントエンド（port 5173）
curl -s http://localhost:5173 >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ フロントエンド開発サーバーが起動しています (port 5173)
) else (
    echo ⚠️  フロントエンド開発サーバーが起動していません (port 5173)
    echo ℹ️  起動方法: npm run dev
)

REM バックエンド（port 8000）
curl -s http://localhost:8000 >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ バックエンド開発サーバーが起動しています (port 8000)
) else (
    echo ⚠️  バックエンド開発サーバーが起動していません (port 8000)
    echo ℹ️  起動方法: python backend/main.py
)

REM 設定情報を表示
echo.
echo === トンネル設定情報 ===

REM 設定ファイルからホスト名を抽出（簡易版）
for /f "tokens=2 delims=: " %%i in ('findstr "hostname:" "%CONFIG_FILE%" ^| findstr /n "hostname"') do (
    if "!count!"=="" (
        set FRONTEND_HOST=%%i
        set count=1
    ) else (
        set API_HOST=%%i
    )
)

echo フロントエンド: https://!FRONTEND_HOST!
echo API: https://!API_HOST!
echo 設定ファイル: %CONFIG_FILE%
echo.

REM トンネルを開始
echo ℹ️  Cloudflareトンネルを開始します...
echo ⚠️  停止するには Ctrl+C を押してください
echo.

cloudflared tunnel --config "%CONFIG_FILE%" run "%TUNNEL_NAME%"

endlocal
