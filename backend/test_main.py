import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
import sqlite3
import os
import tempfile
from main import app
import json
from datetime import datetime, timedelta
from unittest.mock import patch

# テスト用の一時データベース
TEST_DB_PATH = "test_namecard_places.db"

# テスト用のセッションID
TEST_SESSION_ID = "test_session_123"
TEST_SESSION_ID_2 = "test_session_456"

def create_test_db():
    """テスト用データベースを作成"""
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    
    conn = sqlite3.connect(TEST_DB_PATH)
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
        INSERT OR IGNORE INTO recording_sessions (id, enabled, expires_at, description) 
        VALUES (1, 0, NULL, NULL)
    ''')
    conn.commit()
    conn.close()

@pytest.fixture(scope="function")
def test_client():
    """テスト用クライアントの設定"""
    create_test_db()
    
    # mainモジュール内のすべてのsqlite3.connectを置き換え
    original_connect = sqlite3.connect
    def mock_connect(db_path):
        return original_connect(TEST_DB_PATH)
    
    with patch('main.sqlite3.connect', side_effect=mock_connect):
        client = TestClient(app)
        yield client
    
    # テスト後のクリーンアップ
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

class TestNameCardAPI:
    """名刺API関連のテスト"""
    
    def test_get_card_info(self, test_client):
        """名刺情報取得のテスト"""
        response = test_client.get("/api/card-info")
        assert response.status_code == 200
        
        data = response.json()
        assert "name" in data
        assert "title" in data
        assert "company" in data
        assert "website" in data
        assert "email" in data
        assert "description" in data

class TestRecordingSessionAPI:
    """記録セッション管理APIのテスト"""
    
    def test_get_recording_status_initial(self, test_client):
        """初期記録状態の確認"""
        response = test_client.get("/api/recording-status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["enabled"] == False
        assert data["expires_at"] is None
        assert data["description"] is None

    def test_admin_login_success(self, test_client):
        """管理者ログイン成功のテスト"""
        response = test_client.post("/api/admin/login", 
                                  json={"password": "admin123"})
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert data["message"] == "Admin login successful"

    def test_admin_login_failure(self, test_client):
        """管理者ログイン失敗のテスト"""
        response = test_client.post("/api/admin/login", 
                                  json={"password": "wrongpassword"})
        assert response.status_code == 401

    def test_enable_recording_session(self, test_client):
        """記録セッション有効化のテスト"""
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        
        response = test_client.post("/api/admin/enable-recording",
                                  json={
                                      "enabled": True,
                                      "expires_at": expires_at,
                                      "description": "Test session"
                                  },
                                  params={"admin_password": "admin123"})
        assert response.status_code == 200

    def test_disable_recording_session(self, test_client):
        """記録セッション無効化のテスト"""
        response = test_client.post("/api/admin/enable-recording",
                                  json={
                                      "enabled": False,
                                      "expires_at": None,
                                      "description": ""
                                  },
                                  params={"admin_password": "admin123"})
        assert response.status_code == 200

    def test_get_session_status_admin(self, test_client):
        """管理者向けセッション状態取得のテスト"""
        response = test_client.get("/api/admin/session-status",
                                 params={"admin_password": "admin123"})
        assert response.status_code == 200

    def test_unauthorized_admin_access(self, test_client):
        """不正な管理者アクセスのテスト"""
        response = test_client.get("/api/admin/session-status",
                                 params={"admin_password": "wrongpassword"})
        assert response.status_code == 401

class TestLocationAPI:
    """位置情報API関連のテスト"""
    
    def test_record_location_when_disabled(self, test_client):
        """記録無効時の位置記録テスト"""
        location_data = {
            "latitude": 35.6895,
            "longitude": 139.6917
        }
        
        response = test_client.post("/api/record-location", json=location_data)
        assert response.status_code == 403
        assert "disabled" in response.json()["detail"]

    def test_record_location_when_enabled(self, test_client):
        """記録有効時の位置記録テスト"""
        # まず記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        enable_response = test_client.post("/api/admin/enable-recording",
                                         json={
                                             "enabled": True,
                                             "expires_at": expires_at,
                                             "description": "Test session"
                                         },
                                         params={"admin_password": "admin123"})
        assert enable_response.status_code == 200

        # 位置情報を記録
        location_data = {
            "latitude": 35.6895,
            "longitude": 139.6917
        }        
        response = test_client.post("/api/record-location", json=location_data)
        assert response.status_code == 200
        assert response.json()["message"] == "Location recorded successfully"

    def test_get_locations_empty(self, test_client):
        """位置情報取得（空）のテスト"""
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_locations_with_data(self, test_client):
        """位置情報取得（データあり）のテスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Test session"
                        },
                        params={"admin_password": "admin123"})

        # 位置情報を記録
        location_data = {
            "latitude": 35.6895,
            "longitude": 139.6917
        }
        test_client.post("/api/record-location", json=location_data)

        # 位置情報を取得
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1
        assert data[0]["latitude"] == 35.6895
        assert data[0]["longitude"] == 139.6917
        assert "timestamp" in data[0]

    def test_get_admin_locations(self, test_client):
        """管理者向け位置情報取得のテスト"""
        response = test_client.get("/api/admin/locations",
                                 params={"admin_password": "admin123"})
        assert response.status_code == 200

    def test_record_location_with_session_id(self, test_client):
        """セッションIDを含む位置記録のテスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # セッションIDを含む位置記録
        response = test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["message"] == "Location recorded successfully"

    def test_get_locations_with_session_id(self, test_client):
        """セッションIDを含む位置情報取得のテスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # セッションIDを含む位置記録
        test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        
        # 位置情報取得
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        locations = response.json()
        assert len(locations) > 0
        assert "id" in locations[0]
        assert "session_id" in locations[0]
        assert locations[0]["session_id"] == TEST_SESSION_ID

    def test_delete_location_success(self, test_client):
        """位置記録削除の成功テスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # 位置記録
        response = test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        location_id = response.json()["id"]
        
        # 削除
        response = test_client.delete(
            f"/api/locations/{location_id}",
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Location deleted successfully"

    def test_delete_location_wrong_session(self, test_client):
        """異なるセッションIDでの削除失敗テスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # 位置記録
        response = test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        location_id = response.json()["id"]
        
        # 異なるセッションIDで削除試行
        response = test_client.delete(
            f"/api/locations/{location_id}",
            headers={"X-Session-Id": TEST_SESSION_ID_2}
        )
        assert response.status_code == 404
        assert "not found or not owned by user" in response.json()["detail"]

    def test_delete_location_no_session(self, test_client):
        """セッションIDなしでの削除失敗テスト"""
        response = test_client.delete("/api/locations/1")
        assert response.status_code == 400
        assert "Session ID is required" in response.json()["detail"]

    def test_admin_delete_location(self, test_client):
        """管理者による位置記録削除のテスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # 位置記録
        response = test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        location_id = response.json()["id"]
        
        # 管理者による削除
        response = test_client.delete(
            f"/api/admin/locations/{location_id}",
            params={"admin_password": "admin123"}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Location deleted successfully"

    def test_admin_delete_location_invalid_password(self, test_client):
        """管理者パスワード不正での削除失敗テスト"""
        response = test_client.delete(
            "/api/admin/locations/1",
            params={"admin_password": "wrong_password"}
        )
        assert response.status_code == 401

    def test_admin_get_locations_with_session_id(self, test_client):
        """管理者による位置情報取得（セッションID含む）のテスト"""
        # 記録を有効化
        test_client.post("/api/admin/enable-recording", 
                       json={"enabled": True, "expires_at": None, "description": "Test session"},
                       params={"admin_password": "admin123"})
        
        # 位置記録
        test_client.post(
            "/api/record-location",
            json={"latitude": 35.6895, "longitude": 139.6917},
            headers={"X-Session-Id": TEST_SESSION_ID}
        )
        
        # 管理者による位置情報取得
        response = test_client.get("/api/admin/locations", params={"admin_password": "admin123"})
        assert response.status_code == 200
        locations = response.json()
        assert len(locations) > 0
        assert "id" in locations[0]
        assert "session_id" in locations[0]
        assert locations[0]["session_id"] == TEST_SESSION_ID


class TestDataValidation:
    """データ検証のテスト"""
    
    def test_invalid_location_data(self, test_client):
        """不正な位置データのテスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Test session"
                        },
                        params={"admin_password": "admin123"})

        # 不正な緯度
        invalid_data = {
            "latitude": 999,  # 無効な緯度
            "longitude": 139.6917
        }
        response = test_client.post("/api/record-location", json=invalid_data)
        # FastAPIが自動的にバリデーションエラーを返すはず
        assert response.status_code in [422, 400]

    def test_missing_location_fields(self, test_client):
        """位置情報フィールド欠如のテスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Test session"
                        },
                        params={"admin_password": "admin123"})

        # 緯度のみ（経度なし）
        incomplete_data = {
            "latitude": 35.6895
        }
        response = test_client.post("/api/record-location", json=incomplete_data)
        assert response.status_code == 422

class TestSessionExpiration:
    """セッション期限のテスト"""
    
    def test_expired_session(self, test_client):
        """期限切れセッションのテスト"""
        # 既に期限切れの時刻を設定
        expired_time = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expired_time,
                            "description": "Expired session"
                        },
                        params={"admin_password": "admin123"})

        # 記録状態を確認（期限切れで無効化されているはず）
        response = test_client.get("/api/recording-status")
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == False

class TestNewFeatures:
    """新機能のテスト"""
    
    def test_location_timestamp_format(self, test_client):
        """位置情報のタイムスタンプ形式のテスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Test session"
                        },
                        params={"admin_password": "admin123"})

        # 位置情報を記録
        location_data = {
            "latitude": 35.6895,
            "longitude": 139.6917
        }
        test_client.post("/api/record-location", json=location_data)

        # 位置情報を取得してタイムスタンプを確認
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1
        assert "timestamp" in data[0]
        
        # タイムスタンプが有効な日時形式かチェック
        timestamp = data[0]["timestamp"]
        try:
            parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            assert isinstance(parsed_time, datetime)
        except ValueError:
            pytest.fail(f"Invalid timestamp format: {timestamp}")

    def test_view_only_mode_data_access(self, test_client):
        """地図閲覧専用モードでのデータアクセステスト"""
        # 記録を有効化して位置情報を追加
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Test session"
                        },
                        params={"admin_password": "admin123"})

        # 複数の位置情報を記録
        locations = [
            {"latitude": 35.6895, "longitude": 139.6917},
            {"latitude": 35.6762, "longitude": 139.6503},
            {"latitude": 35.6812, "longitude": 139.7671}
        ]
        
        for location in locations:
            test_client.post("/api/record-location", json=location)

        # 記録を無効化（閲覧専用状態をシミュレート）
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": False,
                            "expires_at": None,
                            "description": ""
                        },
                        params={"admin_password": "admin123"})

        # 記録無効状態でも位置情報は取得できることを確認
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_multiple_recording_methods_data_consistency(self, test_client):
        """複数の記録方法によるデータ一貫性のテスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "GPS and click recording test"
                        },
                        params={"admin_password": "admin123"})

        # クリック記録をシミュレート
        click_location = {
            "latitude": 35.6895,
            "longitude": 139.6917
        }
        response1 = test_client.post("/api/record-location", json=click_location)
        assert response1.status_code == 200

        # GPS記録をシミュレート（わずかに異なる座標）
        gps_location = {
            "latitude": 35.6896,
            "longitude": 139.6918
        }
        response2 = test_client.post("/api/record-location", json=gps_location)
        assert response2.status_code == 200        # 両方の記録が取得できることを確認
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # 2つの記録の緯度が含まれていることを確認
        latitudes = [item["latitude"] for item in data]
        assert gps_location["latitude"] in latitudes
        assert click_location["latitude"] in latitudes

    def test_recording_instruction_session_description(self, test_client):
        """記録説明機能のセッション情報テスト"""
        # 詳細説明付きでセッションを有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        detailed_description = "この記録は名刺交換場所を記録するためのものです。地図をクリックするかGPS機能を使用して正確な位置を記録できます。"
        
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": detailed_description
                        },
                        params={"admin_password": "admin123"})

        # 記録状態を取得して説明文が含まれていることを確認
        response = test_client.get("/api/recording-status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["enabled"] == True
        assert data["description"] == detailed_description

    def test_location_data_with_timestamp_ordering(self, test_client):
        """タイムスタンプによる位置データの順序テスト"""
        # 記録を有効化
        expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        test_client.post("/api/admin/enable-recording",
                        json={
                            "enabled": True,
                            "expires_at": expires_at,
                            "description": "Timestamp ordering test"
                        },
                        params={"admin_password": "admin123"})

        # 複数の位置情報を順次記録
        locations = [
            {"latitude": 35.6895, "longitude": 139.6917},
            {"latitude": 35.6762, "longitude": 139.6503},
            {"latitude": 35.6812, "longitude": 139.7671}
        ]
        
        for i, location in enumerate(locations):
            test_client.post("/api/record-location", json=location)
            # 各記録間に少し間隔を置く（テスト用）
            import time
            time.sleep(0.01)

        # 位置情報を取得
        response = test_client.get("/api/locations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        
        # タイムスタンプが降順（最新順）になっていることを確認
        timestamps = [datetime.fromisoformat(item["timestamp"].replace('Z', '+00:00')) 
                     for item in data]
        
        for i in range(len(timestamps) - 1):
            assert timestamps[i] >= timestamps[i + 1], "Timestamps should be in descending order"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
