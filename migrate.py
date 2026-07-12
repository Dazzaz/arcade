import sqlite3
import json
import os

def migrate():
    print("Iniciando migración a SQLite...")
    conn = sqlite3.connect('database.db')
    c = conn.cursor()

    # Crear tablas
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            friends TEXT,
            pending_requests TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            username TEXT,
            game TEXT,
            level INTEGER,
            details TEXT
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            creator_id TEXT,
            target_id TEXT,
            seed INTEGER,
            settings TEXT,
            creator_score INTEGER,
            target_score INTEGER,
            status TEXT
        )
    ''')

    # Migrar usuarios
    if os.path.exists('users.json'):
        with open('users.json', 'r') as f:
            try:
                users = json.load(f)
                for u in users:
                    friends = json.dumps(u.get('friends', []))
                    pending = json.dumps(u.get('pending_requests', []))
                    c.execute('INSERT OR REPLACE INTO users (user_id, username, friends, pending_requests) VALUES (?, ?, ?, ?)',
                              (u['user_id'], u['username'], friends, pending))
                print(f"Migrados {len(users)} usuarios.")
            except Exception as e:
                print("Error migrando usuarios:", e)

    # Migrar scores
    if os.path.exists('scores.json'):
        with open('scores.json', 'r') as f:
            try:
                scores = json.load(f)
                c.execute('DELETE FROM scores') # Limpiar antes de insertar
                for s in scores:
                    details = json.dumps(s.get('details', {}))
                    c.execute('INSERT INTO scores (user_id, username, game, level, details) VALUES (?, ?, ?, ?, ?)',
                              (s.get('user_id'), s.get('username'), s.get('game', 'memoria_total'), s.get('level', 0), details))
                print(f"Migrados {len(scores)} scores.")
            except Exception as e:
                print("Error migrando scores:", e)

    # Migrar challenges
    if os.path.exists('challenges.json'):
        with open('challenges.json', 'r') as f:
            try:
                challenges = json.load(f)
                for ch in challenges:
                    settings = json.dumps(ch.get('settings', {}))
                    c.execute('''INSERT OR REPLACE INTO challenges 
                                 (id, creator_id, target_id, seed, settings, creator_score, target_score, status) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                              (ch['id'], ch.get('creator_id', ch.get('player1_id')), ch.get('target_id', ch.get('player2_id')),
                               ch.get('seed', 12345), settings, ch.get('creator_score', ch.get('player1_score')),
                               ch.get('target_score', ch.get('player2_score')), ch.get('status', 'waiting')))
                print(f"Migrados {len(challenges)} retos.")
            except Exception as e:
                print("Error migrando retos:", e)

    conn.commit()
    conn.close()
    print("Migración completada con éxito.")

if __name__ == '__main__':
    migrate()
