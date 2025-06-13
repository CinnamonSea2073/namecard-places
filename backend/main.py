from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
import sqlite3
import jwt
import datetime
from typing import Optional
import uuid
import os

app = FastAPI(title="Namecard Places API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では具体的なドメインを指定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT秘密鍵（本番環境では環境変数から取得）
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")  # 本番環境では変更必須

# データモデル
class LocationRecord(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[str] = None
    
    @field_validator('latitude')
    @classmethod
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @field_validator('longitude')
    @classmethod
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v

class RecordingSession(BaseModel):
    enabled: bool
    expires_at: Optional[str] = None
    description: Optional[str] = None

class AdminLogin(BaseModel):
    password: str

# データベース初期化
def init_db():
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            session_id TEXT,
            user_agent TEXT,
            ip_address TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recording_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enabled INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            description TEXT
        )
    ''')
    # 初期セッションレコードを作成
    cursor.execute('''
        INSERT OR IGNORE INTO recording_sessions (id, enabled) VALUES (1, 0)
    ''')
    conn.commit()
    conn.close()

# データベース初期化実行
init_db()

# 記録セッション状態を取得
def get_recording_session():
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT enabled, expires_at, description FROM recording_sessions WHERE id = 1
    ''')
    result = cursor.fetchone()
    
    if not result:
        # 初期レコードが存在しない場合は作成
        cursor.execute('''
            INSERT INTO recording_sessions (id, enabled, expires_at, description) 
            VALUES (1, 0, NULL, NULL)
        ''')
        conn.commit()
        # 新しく作成したレコードを取得
        cursor.execute('''
            SELECT enabled, expires_at, description FROM recording_sessions WHERE id = 1
        ''')
        result = cursor.fetchone()
        
        # もしまだ取得できない場合はデフォルト値を返す
        if not result:
            conn.close()
            return {"enabled": False, "expires_at": None, "description": None}
    
    conn.close()
    
    # resultが空やNoneでないかを確認
    if not result or len(result) < 3:
        return {"enabled": False, "expires_at": None, "description": None}
    
    enabled, expires_at, description = result
    
    # 期限切れチェック
    if expires_at and datetime.datetime.fromisoformat(expires_at) < datetime.datetime.utcnow():
        # 期限切れの場合は無効化
        conn = sqlite3.connect('namecard_places.db')
        cursor = conn.cursor()
        cursor.execute('UPDATE recording_sessions SET enabled = 0 WHERE id = 1')
        conn.commit()
        conn.close()
        return {"enabled": False, "expires_at": expires_at, "description": description}
    
    return {"enabled": bool(enabled), "expires_at": expires_at, "description": description}

# 管理者認証（簡易版）
def verify_admin_password(password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True

# ===== 管理者API =====

@app.post("/api/admin/login")
async def admin_login(login_data: AdminLogin):
    verify_admin_password(login_data.password)
    # 簡易JWTトークン生成（管理者用）
    payload = {
        "admin": True,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {"token": token, "message": "Admin login successful"}

@app.post("/api/admin/enable-recording")
async def enable_recording(session: RecordingSession, admin_password: str):
    verify_admin_password(admin_password)
    
    expires_at = None
    if session.expires_at:
        expires_at = session.expires_at
    
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE recording_sessions 
        SET enabled = ?, expires_at = ?, description = ?
        WHERE id = 1
    ''', (1 if session.enabled else 0, expires_at, session.description))
    conn.commit()
    conn.close()
    
    return {"message": "Recording session updated", "session": session}

@app.get("/api/admin/session-status")
async def get_session_status(admin_password: str):
    verify_admin_password(admin_password)
    return get_recording_session()

@app.get("/api/admin/locations")
async def get_all_locations_admin(admin_password: str):
    verify_admin_password(admin_password)
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, latitude, longitude, timestamp, session_id, user_agent, ip_address 
        FROM locations 
        ORDER BY timestamp DESC
    ''')
    locations = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": loc[0],
            "latitude": loc[1],
            "longitude": loc[2],
            "timestamp": loc[3],
            "session_id": loc[4],
            "user_agent": loc[5],
            "ip_address": loc[6]
        }
        for loc in locations
    ]

# 管理者による記録削除
@app.delete("/api/admin/locations/{location_id}")
async def delete_location_admin(location_id: int, admin_password: str):
    verify_admin_password(admin_password)
    
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM locations WHERE id = ?', (location_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Location not found")
    
    conn.commit()
    conn.close()
    
    return {"message": "Location deleted successfully"}

# 管理者による位置情報削除
@app.delete("/api/admin/locations/{location_id}")
async def admin_delete_location(location_id: int, admin_password: str):
    verify_admin_password(admin_password)
    
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM locations WHERE id = ?', (location_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Location not found")
    
    conn.commit()
    conn.close()
    
    return {"message": "Location deleted successfully"}

# ===== 公開API =====

# 記録セッション状態確認（公開）
@app.get("/api/recording-status")
async def get_recording_status():
    session = get_recording_session()
    return {
        "enabled": session["enabled"],
        "expires_at": session["expires_at"],
        "description": session["description"]
    }

# 位置情報記録（セッション有効時のみ）
@app.post("/api/record-location")
async def record_location(location: LocationRecord, x_session_id: str = Header(None)):
    session = get_recording_session()
    
    if not session["enabled"]:
        raise HTTPException(status_code=403, detail="Recording is currently disabled")
    
    # 位置情報を保存
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO locations (latitude, longitude, session_id, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?)
    ''', (location.latitude, location.longitude, x_session_id, "browser", "unknown"))
    
    location_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"message": "Location recorded successfully", "id": location_id}

# 位置情報取得（公開用）
@app.get("/api/locations")
async def get_locations():
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, latitude, longitude, timestamp, session_id FROM locations
        ORDER BY timestamp DESC
        LIMIT 100
    ''')
    locations = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": loc[0],
            "latitude": loc[1],
            "longitude": loc[2],
            "timestamp": loc[3],
            "session_id": loc[4]
        }
        for loc in locations
    ]

# 位置情報削除（ユーザー自身の記録のみ）
@app.delete("/api/locations/{location_id}")
async def delete_location(location_id: int, x_session_id: str = Header(None)):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    
    conn = sqlite3.connect('namecard_places.db')
    cursor = conn.cursor()
    
    # セッションIDが一致する記録のみ削除
    cursor.execute('''
        DELETE FROM locations 
        WHERE id = ? AND session_id = ?
    ''', (location_id, x_session_id))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Location not found or not owned by user")
    
    conn.commit()
    conn.close()
    
    return {"message": "Location deleted successfully"}

# 名刺情報取得
@app.get("/api/card-info")
async def get_card_info():
    return {
        "name": "あなたの名前",
        "title": "あなたの肩書き",
        "company": "あなたの会社名",
        "website": "https://your-website.com",
        "email": "your-email@example.com",
        "description": "簡単な自己紹介文をここに記載します。"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
