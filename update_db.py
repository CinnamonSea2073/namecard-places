import sqlite3

# プロジェクトルートのデータベースに session_id カラムを追加
conn = sqlite3.connect('namecard_places.db')
cursor = conn.cursor()

try:
    # locationsテーブルにsession_idカラムを追加
    cursor.execute('ALTER TABLE locations ADD COLUMN session_id TEXT')
    print("Added session_id column to locations table in root database")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("session_id column already exists in locations table")
    else:
        print(f"Error adding session_id column: {e}")

# 現在の構造を確認
cursor.execute("PRAGMA table_info(locations)")
columns = cursor.fetchall()
print("\nUpdated locations table columns:")
for col in columns:
    print(f"  {col[1]} {col[2]} (nullable: {not col[3]})")

conn.commit()
conn.close()
print("\nDatabase update completed!")
