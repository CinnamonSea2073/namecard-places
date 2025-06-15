#!/bin/bash

# Cloudflare Tunnel セットアップスクリプト
# このスクリプトはCloudflareトンネルを設定し、サイトを公開するためのものです

set -e

echo "🌐 Cloudflare Tunnel セットアップを開始します..."

# 設定可能な変数
TUNNEL_NAME="namecard-places-tunnel"
DOMAIN=${DOMAIN:-"your-domain.com"}
FRONTEND_SUBDOMAIN=${FRONTEND_SUBDOMAIN:-"namecard-places"}
API_SUBDOMAIN=${API_SUBDOMAIN:-"api.namecard-places"}

# 色付きの出力関数
print_info() {
    echo -e "\033[34mℹ️  $1\033[0m"
}

print_success() {
    echo -e "\033[32m✅ $1\033[0m"
}

print_warning() {
    echo -e "\033[33m⚠️  $1\033[0m"
}

print_error() {
    echo -e "\033[31m❌ $1\033[0m"
}

# cloudflaredがインストールされているかチェック
check_cloudflared() {
    if ! command -v cloudflared &> /dev/null; then
        print_error "cloudflaredがインストールされていません。"
        print_info "以下のコマンドでインストールしてください："
        echo "Windows: winget install --id Cloudflare.cloudflared"
        echo "macOS: brew install cloudflare/cloudflare/cloudflared"
        echo "Linux: curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb"
        exit 1
    fi
    print_success "cloudflaredが見つかりました"
}

# Cloudflareにログイン
login_cloudflare() {
    print_info "Cloudflareにログインします..."
    cloudflared tunnel login
    print_success "Cloudflareへのログインが完了しました"
}

# トンネルを作成
create_tunnel() {
    print_info "トンネル '$TUNNEL_NAME' を作成します..."
    
    # 既存のトンネルをチェック
    if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        print_warning "トンネル '$TUNNEL_NAME' は既に存在します"
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    else
        cloudflared tunnel create "$TUNNEL_NAME"
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
        print_success "トンネル '$TUNNEL_NAME' を作成しました (ID: $TUNNEL_ID)"
    fi
}

# DNSレコードを作成
create_dns_records() {
    print_info "DNSレコードを作成します..."
    
    # フロントエンド用DNSレコード
    cloudflared tunnel route dns "$TUNNEL_NAME" "$FRONTEND_SUBDOMAIN.$DOMAIN" || print_warning "フロントエンド用DNSレコードの作成に失敗しました（既に存在する可能性があります）"
    
    # API用DNSレコード
    cloudflared tunnel route dns "$TUNNEL_NAME" "$API_SUBDOMAIN.$DOMAIN" || print_warning "API用DNSレコードの作成に失敗しました（既に存在する可能性があります）"
    
    print_success "DNSレコードの設定が完了しました"
}

# 設定ファイルを更新
update_config() {
    print_info "設定ファイルを更新します..."
    
    # cloudflare-tunnel.ymlを更新
    cat > cloudflare-tunnel.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $FRONTEND_SUBDOMAIN.$DOMAIN
    service: http://localhost:5173
  - hostname: $API_SUBDOMAIN.$DOMAIN
    service: http://localhost:8000
  - service: http_status:404

originRequest:
  connectTimeout: 30s
  tlsTimeout: 30s
  tcpKeepAlive: 30s
  keepAliveConnections: 100
  keepAliveTimeout: 1m30s

loglevel: info
transport-loglevel: warn
EOF

    print_success "設定ファイルを更新しました"
}

# トンネルを開始する関数
start_tunnel() {
    print_info "トンネルを開始します..."
    print_info "フロントエンド: https://$FRONTEND_SUBDOMAIN.$DOMAIN"
    print_info "API: https://$API_SUBDOMAIN.$DOMAIN"
    print_warning "開発サーバーが起動していることを確認してください："
    print_warning "- フロントエンド: npm run dev (port 5173)"
    print_warning "- バックエンド: python backend/main.py (port 8000)"
    
    cloudflared tunnel --config cloudflare-tunnel.yml run "$TUNNEL_NAME"
}

# メイン処理
main() {
    print_info "=== Cloudflare Tunnel セットアップ ==="
    
    check_cloudflared
    login_cloudflare
    create_tunnel
    create_dns_records
    update_config
    
    print_success "🎉 セットアップが完了しました！"
    print_info "次のステップ："
    print_info "1. 開発サーバーを起動: npm run dev"
    print_info "2. バックエンドを起動: python backend/main.py"
    print_info "3. トンネルを開始: ./scripts/start-tunnel.sh"
    
    echo ""
    read -p "今すぐトンネルを開始しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_tunnel
    else
        print_info "後でトンネルを開始するには: ./scripts/start-tunnel.sh"
    fi
}

# スクリプトが直接実行された場合のみメイン処理を実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
