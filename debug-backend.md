# バックエンドの500エラーをデバッグするために、ログを確認
# バックエンドを再起動して、詳細なエラーログを取得

# PowerShellでバックエンドサーバーを起動
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000