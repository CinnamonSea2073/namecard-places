# 名刺交換場所記録サイト

名刺を渡した場所を地図上に記録できるWebアプリケーションです。**固定QRコード**を名刺に印刷し、**管理者による記録セッション制御**で「その時のみ」の位置記録を実現します。

## 特徴

- **固定QRコード**: 一度印刷すれば変更不要の固定URL
- **管理者制御**: 記録の有効/無効を管理者がリアルタイムで制御
- **時限設定**: 管理者が設定した期間のみ位置記録が可能
- **ログイン不要**: 利用者は個人情報登録なしで簡単アクセス
- **地図表示**: OpenLayersを使った地図上での位置表示
- **保守不要**: SQLiteによる軽量データベース

## 使用フロー

### 事前準備（管理者）
1. サイトにアクセスして管理者パネルで位置記録を有効化
2. 固定QRコードを名刺に印刷

### 名刺交換時
1. **名刺を渡す前**: 管理者が記録セッションを有効化
2. **名刺受取者**: QRコードを読み取り → 名刺情報表示
3. **位置記録**: 「出会った場所を記録する」→ 地図で位置選択
4. **セッション終了**: 管理者が記録を無効化

## 技術スタック

- **フロントエンド**: Vue 3 + TailwindCSS + OpenLayers
- **バックエンド**: FastAPI (Python)
- **データベース**: SQLite
- **コンテナ化**: Docker Compose

## セットアップ

### 開発環境での実行

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動（フロントエンド）
npm run dev
# フロントエンドは http://localhost:3001 で起動

# バックエンドサーバーの起動
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# バックエンドは http://localhost:8000 で起動
```

### Docker Composeでの実行

```bash
# サービスの起動
docker-compose up -d

# ログの確認
docker-compose logs -f

# サービスの停止
docker-compose down
```

## 管理者機能

### 管理者パネルへのアクセス
- URLに `?view=admin` を追加、またはサイト右上の「Admin」リンクをクリック

### 記録セッション管理
- **有効/無効の切り替え**: リアルタイムで位置記録の制御
- **期限設定**: 指定時刻で自動無効化
- **セッション説明**: イベント名などの記録
- **位置データ確認**: 記録された場所の一覧表示

## API エンドポイント

### 公開API
- `GET /api/card-info`: 名刺情報の取得
- `GET /api/recording-status`: 記録セッション状態の確認
- `POST /api/record-location`: 位置情報の記録
- `GET /api/locations`: 記録済み位置情報の取得

### 管理者API
- `POST /api/admin/login`: 管理者ログイン
- `POST /api/admin/enable-recording`: 記録セッションの制御
- `GET /api/admin/session-status`: セッション状態の取得
- `GET /api/admin/locations`: 全位置データの取得

## 設定のカスタマイズ

### 名刺情報の変更
`backend/main.py` の `get_card_info()` 関数内で名刺情報を編集してください。

### 管理者パスワードの設定
本番環境では `ADMIN_PASSWORD` 環境変数を設定してください：

```bash
# Docker Composeの場合
ADMIN_PASSWORD=your-secure-password docker-compose up -d

# 直接実行の場合
export ADMIN_PASSWORD=your-secure-password
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 秘密鍵の設定
本番環境では `SECRET_KEY` 環境変数を設定してください。

## 運用の流れ

1. **名刺印刷**: 固定QRコードを含む名刺を事前印刷
2. **イベント前**: 管理者パネルで記録セッションを有効化
3. **名刺交換**: 受取者がQRコードから位置記録
4. **イベント後**: 管理者パネルで記録を無効化・データ確認

## ライセンス

MIT License
