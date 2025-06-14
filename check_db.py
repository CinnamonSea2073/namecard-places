import sqlite3

# データベース接続
conn = sqlite3.connect('C:/Users/Cinnamon/Namecard-places/backend/namecard_places.db')
cursor = conn.cursor()

# テーブル一覧と構造を確認
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

# locationsテーブルの構造を確認
cursor.execute("PRAGMA table_info(locations)")
columns = cursor.fetchall()
print("\nlocations table columns:")
for col in columns:
    print(f"  {col[1]} {col[2]} (nullable: {not col[3]})")

# recording_sessionsテーブルの構造を確認
try:
    cursor.execute("PRAGMA table_info(recording_sessions)")
    columns = cursor.fetchall()
    print("\nrecording_sessions table columns:")
    for col in columns:
        print(f"  {col[1]} {col[2]} (nullable: {not col[3]})")
except:
    print("\nrecording_sessions table does not exist")

conn.close()
