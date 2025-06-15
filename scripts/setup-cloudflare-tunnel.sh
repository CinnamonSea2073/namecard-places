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

# セットアップ方式の選択
setup_method_selection() {
    echo ""
    print_info "セットアップ方式を選択してください："
    echo "1. コネクタトークン方式（推奨・簡単）"
    echo "2. 従来の認証ファイル方式（高度）"
    echo ""
    read -p "選択してください (1 または 2): " SETUP_METHOD
    
    case $SETUP_METHOD in
        1)
            print_info "コネクタトークン方式でセットアップします"
            setup_connector_token
            ;;
        2)
            print_info "従来の認証ファイル方式でセットアップします"
            setup_traditional
            ;;
        *)
            print_error "無効な選択です。1 または 2 を選択してください。"
            setup_method_selection
            ;;
    esac
}

# コネクタトークン方式のセットアップ
setup_connector_token() {
    echo ""
    print_info "=== コネクタトークン方式のセットアップ ==="
    echo ""
    
    print_info "以下の手順でCloudflareダッシュボードから設定を行ってください："
    echo ""
    echo "1. https://dash.cloudflare.com/ にアクセス"
    echo "2. 左サイドバーの「Zero Trust」をクリック"
    echo "3. 「Networks」→「Tunnels」をクリック"
    echo "4. 「Create a tunnel」をクリック"
    echo "5. 「Cloudflared」を選択して「Next」"
    echo "6. トンネル名を入力（例：namecard-places-tunnel）"
    echo "7. 「Save tunnel」をクリック"
    echo "8. 「Install and run a connector」ページで："
    echo "   - Docker形式のコマンドが表示されます"
    echo "   - '--token' オプションの後にある長いトークン文字列をコピー"
    echo ""
    
    read -p "コネクタトークンを取得しましたか？ (y/n): " TOKEN_READY
    
    if [[ $TOKEN_READY != "y" && $TOKEN_READY != "Y" ]]; then
        print_warning "トークンを取得してから再度実行してください"
        exit 1
    fi
    
    echo ""
    print_info "コネクタトークンを入力してください："
    read -s -p "TUNNEL_TOKEN: " TUNNEL_TOKEN
    echo ""
    
    if [ -z "$TUNNEL_TOKEN" ]; then
        print_error "トークンが入力されていません"
        exit 1
    fi
    
    # .envファイルの作成/更新
    if [ -f ".env" ]; then
        print_info "既存の.envファイルを更新します"
        # 既存のTUNNEL_TOKENを更新または追加
        if grep -q "TUNNEL_TOKEN=" .env; then
            sed -i "s/TUNNEL_TOKEN=.*/TUNNEL_TOKEN=$TUNNEL_TOKEN/" .env
        else
            echo "TUNNEL_TOKEN=$TUNNEL_TOKEN" >> .env
        fi
    else
        print_info ".envファイルを作成します"
        cp .env.example .env
        sed -i "s/# TUNNEL_TOKEN=.*/TUNNEL_TOKEN=$TUNNEL_TOKEN/" .env
    fi
    
    print_success "環境変数ファイル(.env)にトークンを設定しました"
    
    # ドメイン設定
    setup_domain_config
    
    # Cloudflareダッシュボードでの追加設定説明
    echo ""
    print_info "=== Cloudflareダッシュボードでのドメイン設定 ==="
    echo ""
    echo "Cloudflareダッシュボードで以下のPublic hostname設定を追加してください："
    echo ""
    echo "1. 最初のホスト名："
    echo "   - Subdomain: $FRONTEND_SUBDOMAIN"
    echo "   - Domain: $DOMAIN"
    echo "   - Path: (空白)"
    echo "   - Service Type: HTTP"
    echo "   - URL: frontend:3000"
    echo ""
    echo "2. 二番目のホスト名："
    echo "   - Subdomain: $API_SUBDOMAIN"
    echo "   - Domain: $DOMAIN"  
    echo "   - Path: (空白)"
    echo "   - Service Type: HTTP"
    echo "   - URL: backend:8000"
    echo ""
    
    print_success "コネクタトークン方式のセットアップが完了しました！"
    echo ""
    echo "次のステップ："
    echo "1. Cloudflareダッシュボードで上記のホスト名設定を追加"
    echo "2. docker-compose up でアプリケーションを起動"
    echo "3. https://$FRONTEND_SUBDOMAIN.$DOMAIN でアクセス確認"
}

# ドメイン設定のヘルパー関数
setup_domain_config() {
    echo ""
    print_info "ドメイン設定を行います"
    
    read -p "ドメイン名を入力してください (例: example.com): " INPUT_DOMAIN
    if [ ! -z "$INPUT_DOMAIN" ]; then
        DOMAIN="$INPUT_DOMAIN"
    fi
    
    read -p "フロントエンド用サブドメインを入力してください (デフォルト: namecard-places): " INPUT_FRONTEND
    if [ ! -z "$INPUT_FRONTEND" ]; then
        FRONTEND_SUBDOMAIN="$INPUT_FRONTEND"
    fi
    
    read -p "API用サブドメインを入力してください (デフォルト: api.namecard-places): " INPUT_API
    if [ ! -z "$INPUT_API" ]; then
        API_SUBDOMAIN="$INPUT_API"
    fi
    
    print_info "設定されたドメイン："
    echo "  フロントエンド: https://$FRONTEND_SUBDOMAIN.$DOMAIN"
    echo "  API: https://$API_SUBDOMAIN.$DOMAIN"
}

# 従来の認証ファイル方式のセットアップ
setup_traditional() {
    echo ""
    print_info "=== 従来の認証ファイル方式のセットアップ ==="
    echo ""
    
    check_cloudflared
    
    # ドメイン設定
    setup_domain_config
    
    login_cloudflare
    create_tunnel
    create_dns_records
    update_config
    
    print_success "従来方式のセットアップが完了しました！"
    echo ""
    echo "次のステップ："
    echo "1. docker-compose up でアプリケーションを起動"
    echo "2. https://$FRONTEND_SUBDOMAIN.$DOMAIN でアクセス確認"
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
    service: http://frontend:3000
  - hostname: $API_SUBDOMAIN.$DOMAIN
    service: http://backend:8000
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
    
    # セットアップ方式を選択
    setup_method_selection
}

# スクリプトが直接実行された場合のみメイン処理を実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
