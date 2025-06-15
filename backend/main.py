from fastapi import FastAPI, HTTPException, Depends, Header, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
import sqlite3
import jwt
import datetime
from typing import Optional
import uuid
import os
import pytz
import json
import traceback
import shutil

app = FastAPI(title="Namecard Places API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001", 
        "http://localhost:3000", 
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:3000",
        "http://192.168.56.1:3001",
        "http://192.168.56.1:3000",
        "https://firstmet.cinnamon.works",  # フロントエンドのCloudflareトンネルURL
        "https://api-firstmet.cinnamon.works"  # バックエンドのCloudflareトンネルURL
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# JWT秘密鍵（本番環境では環境変数から取得）
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")  # 本番環境では変更必須

# データベースパス
DB_PATH = "namecard_places.db"

# 日本標準時のタイムゾーン
JST = pytz.timezone('Asia/Tokyo')

def get_jst_now():
    """日本標準時での現在時刻を取得"""
    return datetime.datetime.now(JST)

def get_jst_timestamp(dt=None):
    """日本標準時でのタイムスタンプを取得"""
    if dt is None:
        dt = get_jst_now()
    elif dt.tzinfo is None:
        # ナイーブなdatetimeの場合、UTCとして扱って日本時間に変換
        dt = pytz.UTC.localize(dt).astimezone(JST)
    return dt.isoformat()

# データモデル
class LocationRecord(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[str] = None
    session_id: Optional[str] = None
    
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

class NameCardConfig(BaseModel):
    personalInfo: dict
    socialLinks: list
    design: dict

# 設定ファイル管理
CONFIG_FILE = "config.json"
EXAMPLE_CONFIG_FILE = "config.example.json"

def load_config():
    """設定ファイルを読み込む"""
    try:
        # 設定ファイルが存在しない場合、サンプルからコピー
        if not os.path.exists(CONFIG_FILE) and os.path.exists(EXAMPLE_CONFIG_FILE):
            shutil.copy2(EXAMPLE_CONFIG_FILE, CONFIG_FILE)
            print(f"Created {CONFIG_FILE} from {EXAMPLE_CONFIG_FILE}")
        
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # デフォルト設定を返す
            return {
                "personalInfo": {
                    "name": "あなたの名前",
                    "title": "あなたの肩書き",
                    "company": "あなたの会社名",
                    "department": "",
                    "email": "your-email@example.com",
                    "phone": "",
                    "website": "https://your-website.com"
                },
                "socialLinks": [],
                "design": {
                    "primaryColor": "#3B82F6",
                    "accentColor": "#10B981",
                    "backgroundColor": "#F8FAFC",
                    "showQRCode": False
                }
            }
    except Exception as e:
        print(f"Error loading config: {e}")
        # エラーの場合はデフォルト設定を返す
        return {
            "personalInfo": {
                "name": "あなたの名前",
                "title": "あなたの肩書き",
                "company": "あなたの会社名",
                "department": "",
                "email": "your-email@example.com",
                "phone": "",
                "website": "https://your-website.com"
            },
            "socialLinks": [],
            "design": {
                "primaryColor": "#3B82F6",
                "accentColor": "#10B981",
                "backgroundColor": "#F8FAFC",
                "showQRCode": False
            }
        }

def save_config(config_data):
    """設定ファイルを保存する"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

# データベース初期化
def init_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    if expires_at:
        try:
            # ISO形式の文字列をパース（簡単な形式のみサポート）
            expires_str = expires_at.replace('Z', '+00:00').replace('T', ' ')
            if '+' in expires_str:
                expires_str = expires_str.split('+')[0]
              # 秒が含まれているかチェック
            if len(expires_str) >= 19 and expires_str[16] == ':':
                # 秒が含まれている場合（YYYY-MM-DD HH:MM:SS）
                expires_dt = datetime.datetime.strptime(expires_str[:19], '%Y-%m-%d %H:%M:%S')
            else:
                # 秒が含まれていない場合（YYYY-MM-DD HH:MM）
                expires_dt = datetime.datetime.strptime(expires_str[:16], '%Y-%m-%d %H:%M')
            
            expires_dt = JST.localize(expires_dt)
            
            if expires_dt < get_jst_now():
                # 期限切れの場合は無効化
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute('UPDATE recording_sessions SET enabled = 0 WHERE id = 1')
                conn.commit()
                conn.close()
                return {"enabled": False, "expires_at": expires_at, "description": description}
        except Exception as e:
            print(f"Date parsing error: {e}")
            # パースエラーの場合は期限切れとして扱わない
    
    return {"enabled": bool(enabled), "expires_at": expires_at, "description": description}

# 管理者認証（簡易版）
def verify_admin_password(password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True

# ===== ヘルスチェックAPI =====

@app.get("/api/health")
async def health_check():
    """APIサーバーのヘルスチェック"""
    return {"status": "healthy", "timestamp": get_jst_timestamp()}

# ===== 管理者API =====

@app.post("/api/admin/login")
async def admin_login(login_data: AdminLogin):
    verify_admin_password(login_data.password)    # 簡易JWTトークン生成（管理者用）
    payload = {
        "admin": True,
        "exp": get_jst_now() + datetime.timedelta(hours=24)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {"token": token, "message": "Admin login successful"}

@app.post("/api/admin/enable-recording")
async def enable_recording(session: RecordingSession, admin_password: str):
    verify_admin_password(admin_password)
    
    expires_at = None
    if session.expires_at:
        expires_at = session.expires_at
    
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
            "timestamp": get_jst_timestamp(datetime.datetime.fromisoformat(loc[3]) if loc[3] else None),
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
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM locations WHERE id = ?', (location_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Location not found")
    
    conn.commit()
    conn.close()
    
    return {"message": "Location deleted successfully"}

# 管理者による設定取得
@app.get("/api/admin/config")
async def get_config_admin(admin_password: str):
    verify_admin_password(admin_password)
    return load_config()

# 管理者による設定更新
@app.put("/api/admin/config")
async def update_config_admin(config: NameCardConfig, admin_password: str):
    verify_admin_password(admin_password)
    
    # 設定データを辞書に変換
    config_data = {
        "personalInfo": config.personalInfo,
        "socialLinks": config.socialLinks,
        "design": config.design
    }
    
    if save_config(config_data):
        return {"message": "Configuration updated successfully", "config": config_data}
    else:
        raise HTTPException(status_code=500, detail="Failed to save configuration")

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
async def record_location(location: LocationRecord):
    """位置情報を記録"""
    try:
        print(f"Received location record request: {location}")
          # 記録が有効かチェック
        session = get_recording_session()
        if not session["enabled"]:  # enabled
            raise HTTPException(status_code=403, detail="Recording is currently disabled")        # セッションの期限をチェック
        if session["expires_at"]:  # expires_at exists
            try:
                # ISO形式の文字列をパース（簡単な形式のみサポート）
                expires_str = session["expires_at"].replace('Z', '+00:00').replace('T', ' ')
                if '+' in expires_str:
                    expires_str = expires_str.split('+')[0]
                
                # 秒が含まれているかチェック
                if len(expires_str) >= 19 and expires_str[16] == ':':
                    # 秒が含まれている場合（YYYY-MM-DD HH:MM:SS）
                    expires_dt = datetime.datetime.strptime(expires_str[:19], '%Y-%m-%d %H:%M:%S')
                else:
                    # 秒が含まれていない場合（YYYY-MM-DD HH:MM）
                    expires_dt = datetime.datetime.strptime(expires_str[:16], '%Y-%m-%d %H:%M')
                
                expires_dt = JST.localize(expires_dt)
                
                if datetime.datetime.now(JST) > expires_dt:
                    raise HTTPException(status_code=403, detail="Recording session has expired")
            except Exception as e:
                print(f"Date parsing error in record_location: {e}")
                # パースエラーの場合は期限チェックをスキップ
          # 既存の記録をチェック（1人1記録の制限）
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if location.session_id:
            cursor.execute('''
                SELECT COUNT(*) FROM locations WHERE session_id = ?
            ''', (location.session_id,))
            
            if cursor.fetchone()[0] > 0:
                conn.close()
                raise HTTPException(status_code=409, detail="既に位置情報を記録済みです")
        
        # JSTタイムスタンプを生成
        jst_now = datetime.datetime.now(JST)
          # 位置情報を記録
        cursor.execute('''
            INSERT INTO locations (latitude, longitude, timestamp, session_id, user_agent, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (location.latitude, location.longitude, jst_now.isoformat(), location.session_id, None, None))
        
        conn.commit()
        conn.close()
        
        print(f"Successfully recorded location: lat={location.latitude}, lon={location.longitude}")
        return {"message": "Location recorded successfully"}
        
    except HTTPException as e:
        print(f"HTTP Exception in record_location: {e}")
        raise e
    except Exception as e:
        print(f"Error in record_location: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to record location: {str(e)}")

# 位置情報取得（公開用）
@app.get("/api/locations")
async def get_locations():
    """位置情報の一覧を取得"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # まずテーブルが存在するかチェック
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='locations'
        """)
        
        if not cursor.fetchone():
            print("Locations table does not exist")
            conn.close()
            return []
        
        cursor.execute('''
            SELECT latitude, longitude, timestamp, session_id 
            FROM locations 
            ORDER BY timestamp DESC
        ''')
        
        locations = []
        for row in cursor.fetchall():
            lat, lon, timestamp, session_id = row
            try:
                # JSTタイムゾーンでフォーマット
                dt = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                jst_dt = dt.astimezone(JST)
                formatted_timestamp = jst_dt.isoformat()
            except Exception as e:
                print(f"Timestamp parsing error: {e}")
                formatted_timestamp = timestamp
            
            locations.append({
                "latitude": lat,
                "longitude": lon,
                "timestamp": formatted_timestamp,
                "session_id": session_id or ""
            })
        
        conn.close()
        return locations
        
    except Exception as e:
        print(f"Error in get_locations: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 位置情報削除（ユーザー自身の記録のみ）
@app.delete("/api/locations/{location_id}")
async def delete_location(location_id: int, x_session_id: str = Header(None)):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")
    
    conn = sqlite3.connect(DB_PATH)
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
    config = load_config()
    
    # personalInfoから表示用の情報を生成
    personal_info = config.get("personalInfo", {})
    social_links = config.get("socialLinks", [])
    design = config.get("design", {})
    
    # 空文字列の項目をフィルタリング
    filtered_info = {}
    for key, value in personal_info.items():
        if value and value.strip():  # 空文字列や空白文字のみでない場合
            filtered_info[key] = value
    
    # 有効なソーシャルリンクのみをフィルタリング
    enabled_social_links = [
        link for link in social_links 
        if link.get("enabled", False) and link.get("url", "").strip()
    ]
    
    return {
        "personalInfo": filtered_info,
        "socialLinks": enabled_social_links,
        "design": design
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
