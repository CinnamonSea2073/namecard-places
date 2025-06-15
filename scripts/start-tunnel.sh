#!/bin/bash

# Cloudflare Tunnel 開始スクリプト
# 設定済みのトンネルを開始します

set -e

# 設定可能な変数
TUNNEL_NAME="namecard-places-tunnel"
CONFIG_FILE="cloudflare-tunnel.yml"

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

# 前提条件をチェック
check_prerequisites() {
    # cloudflaredがインストールされているかチェック
    if ! command -v cloudflared &> /dev/null; then
        print_error "cloudflaredがインストールされていません。"
        print_info "セットアップスクリプトを実行してください: ./scripts/setup-cloudflare-tunnel.sh"
        exit 1
    fi

    # 設定ファイルが存在するかチェック
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "設定ファイル '$CONFIG_FILE' が見つかりません。"
        print_info "セットアップスクリプトを実行してください: ./scripts/setup-cloudflare-tunnel.sh"
        exit 1
    fi

    print_success "前提条件のチェックが完了しました"
}

# 開発サーバーの状態をチェック
check_dev_servers() {
    print_info "開発サーバーの状態をチェックします..."
    
    # フロントエンド（port 5173）
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        print_success "フロントエンド開発サーバーが起動しています (port 5173)"
    else
        print_warning "フロントエンド開発サーバーが起動していません (port 5173)"
        print_info "起動方法: npm run dev"
    fi
    
    # バックエンド（port 8000）
    if curl -s http://localhost:8000 > /dev/null 2>&1; then
        print_success "バックエンド開発サーバーが起動しています (port 8000)"
    else
        print_warning "バックエンド開発サーバーが起動していません (port 8000)"
        print_info "起動方法: python backend/main.py"
    fi
}

# 設定情報を表示
show_config() {
    print_info "=== トンネル設定情報 ==="
    
    # 設定ファイルからホスト名を抽出
    if command -v yq &> /dev/null; then
        # yqが利用可能な場合
        FRONTEND_HOST=$(yq '.ingress[0].hostname' "$CONFIG_FILE" 2>/dev/null || echo "設定を読み取れませんでした")
        API_HOST=$(yq '.ingress[1].hostname' "$CONFIG_FILE" 2>/dev/null || echo "設定を読み取れませんでした")
    else
        # yqが利用できない場合、grepで抽出
        FRONTEND_HOST=$(grep -A 10 "ingress:" "$CONFIG_FILE" | grep "hostname:" | head -1 | sed 's/.*hostname: //' | tr -d ' ' || echo "設定を読み取れませんでした")
        API_HOST=$(grep -A 10 "ingress:" "$CONFIG_FILE" | grep "hostname:" | tail -1 | sed 's/.*hostname: //' | tr -d ' ' || echo "設定を読み取れませんでした")
    fi
    
    echo "フロントエンド: https://$FRONTEND_HOST"
    echo "API: https://$API_HOST"
    echo "設定ファイル: $CONFIG_FILE"
    echo ""
}

# トンネルを開始
start_tunnel() {
    print_info "Cloudflareトンネルを開始します..."
    print_warning "停止するには Ctrl+C を押してください"
    echo ""
    
    # トンネルを実行
    cloudflared tunnel --config "$CONFIG_FILE" run "$TUNNEL_NAME"
}

# メイン処理
main() {
    print_info "=== Cloudflare Tunnel 開始 ==="
    
    check_prerequisites
    check_dev_servers
    show_config
    start_tunnel
}

# スクリプトが直接実行された場合のみメイン処理を実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
