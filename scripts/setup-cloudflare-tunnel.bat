@echo off
setlocal enabledelayedexpansion

REM Cloudflare Tunnel セットアップスクリプト (Windows版)
REM このスクリプトはCloudflareトンネルを設定し、サイトを公開するためのものです

echo 🌐 Cloudflare Tunnel セットアップを開始します...

REM 設定可能な変数
set TUNNEL_NAME=namecard-places-tunnel
if "%DOMAIN%"=="" set DOMAIN=your-domain.com
if "%FRONTEND_SUBDOMAIN%"=="" set FRONTEND_SUBDOMAIN=namecard-places
if "%API_SUBDOMAIN%"=="" set API_SUBDOMAIN=api.namecard-places

REM cloudflaredがインストールされているかチェック
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ cloudflaredがインストールされていません。
    echo ℹ️  以下のコマンドでインストールしてください：
    echo winget install --id Cloudflare.cloudflared
    exit /b 1
)
echo ✅ cloudflaredが見つかりました

REM Cloudflareにログイン
echo ℹ️  Cloudflareにログインします...
cloudflared tunnel login
if %errorlevel% neq 0 (
    echo ❌ Cloudflareへのログインに失敗しました
    exit /b 1
)
echo ✅ Cloudflareへのログインが完了しました

REM トンネルを作成
echo ℹ️  トンネル '%TUNNEL_NAME%' を作成します...
cloudflared tunnel list | findstr "%TUNNEL_NAME%" >nul 2>nul
if %errorlevel% equ 0 (
    echo ⚠️  トンネル '%TUNNEL_NAME%' は既に存在します
    for /f "tokens=1" %%i in ('cloudflared tunnel list ^| findstr "%TUNNEL_NAME%"') do set TUNNEL_ID=%%i
) else (
    cloudflared tunnel create "%TUNNEL_NAME%"
    if %errorlevel% neq 0 (
        echo ❌ トンネルの作成に失敗しました
        exit /b 1
    )
    for /f "tokens=1" %%i in ('cloudflared tunnel list ^| findstr "%TUNNEL_NAME%"') do set TUNNEL_ID=%%i
    echo ✅ トンネル '%TUNNEL_NAME%' を作成しました (ID: !TUNNEL_ID!)
)

REM DNSレコードを作成
echo ℹ️  DNSレコードを作成します...
cloudflared tunnel route dns "%TUNNEL_NAME%" "%FRONTEND_SUBDOMAIN%.%DOMAIN%"
cloudflared tunnel route dns "%TUNNEL_NAME%" "%API_SUBDOMAIN%.%DOMAIN%"
echo ✅ DNSレコードの設定が完了しました

REM 設定ファイルを更新
echo ℹ️  設定ファイルを更新します...
(
    echo tunnel: !TUNNEL_ID!
    echo credentials-file: %USERPROFILE%\.cloudflared\!TUNNEL_ID!.json
    echo.
    echo ingress:
    echo   - hostname: %FRONTEND_SUBDOMAIN%.%DOMAIN%
    echo     service: http://localhost:5173
    echo   - hostname: %API_SUBDOMAIN%.%DOMAIN%
    echo     service: http://localhost:8000
    echo   - service: http_status:404
    echo.
    echo originRequest:
    echo   connectTimeout: 30s
    echo   tlsTimeout: 30s
    echo   tcpKeepAlive: 30s
    echo   keepAliveConnections: 100
    echo   keepAliveTimeout: 1m30s
    echo.
    echo loglevel: info
    echo transport-loglevel: warn
) > cloudflare-tunnel.yml

echo ✅ 設定ファイルを更新しました

echo.
echo 🎉 セットアップが完了しました！
echo ℹ️  次のステップ：
echo 1. 開発サーバーを起動: npm run dev
echo 2. バックエンドを起動: python backend/main.py
echo 3. トンネルを開始: scripts\start-tunnel.bat
echo.
echo フロントエンド: https://%FRONTEND_SUBDOMAIN%.%DOMAIN%
echo API: https://%API_SUBDOMAIN%.%DOMAIN%
echo.

set /p REPLY="今すぐトンネルを開始しますか？ (y/N): "
if /i "%REPLY%"=="y" (
    echo ℹ️  トンネルを開始します...
    cloudflared tunnel --config cloudflare-tunnel.yml run "%TUNNEL_NAME%"
) else (
    echo ℹ️  後でトンネルを開始するには: scripts\start-tunnel.bat
)

endlocal
