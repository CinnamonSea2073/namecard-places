<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# 名刺交換場所記録サイト - Copilot指示

このプロジェクトは、名刺を渡した場所を地図上に記録できるWebアプリケーションです。

## 技術スタック
- フロントエンド: Vue 3 + TailwindCSS + OpenLayers（地図）
- バックエンド: FastAPI (Python)
- データベース: SQLite
- コンテナ化: Docker Compose

## 主要機能
1. QRコードを使った名刺表示機能
2. 時限付きトークンによる場所記録制限
3. 地理的位置情報の記録と表示
4. ログイン不要・個人情報収集なし

## コード規約
- Vue 3のComposition APIを使用
- TailwindCSSでスタイリング
- TypeScript型注釈は適宜使用
- APIエンドポイントは/api/プレフィックス
- エラーハンドリングを適切に実装

## セキュリティ考慮事項
- JWTトークンは1時間で期限切れ
- 一度使用されたトークンは再利用不可
- CORS設定を本番環境では適切に制限

## 開発時の注意点
- 地図機能にはOpenLayersを使用
- 位置情報取得にはブラウザのGeolocation APIを使用
- Docker Composeでの開発環境構築を前提
- SQLiteを使用するため、データの永続化に注意
