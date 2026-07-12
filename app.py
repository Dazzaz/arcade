import uuid
import json
import os
import random
import sqlite3
import migrate
from datetime import timedelta
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'arcade_python_secret_key_123'
app.permanent_session_lifetime = timedelta(days=365) # Persistencia de 1 año

def get_db():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.before_request
def require_login():
    allowed_routes = ['login', 'static']
    
    # Auto-reparación / Sync base de datos
    if 'user_id' in session:
        conn = get_db()
        c = conn.cursor()
        c.execute('SELECT * FROM users WHERE user_id = ?', (session['user_id'],))
        user = c.fetchone()
        if not user:
            default_pw = generate_password_hash('123456')
            c.execute('INSERT INTO users (user_id, username, friends, pending_requests, password) VALUES (?, ?, ?, ?, ?)',
                      (session['user_id'], session.get('username', 'Operador'), '[]', '[]', default_pw))
            conn.commit()
        conn.close()
            
    if request.endpoint not in allowed_routes and 'user_id' not in session:
        return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username and password:
            conn = get_db()
            c = conn.cursor()
            c.execute('SELECT * FROM users WHERE lower(username) = ?', (username.lower(),))
            existing_user = c.fetchone()
            
            session.permanent = True # Hacer la sesión persistente
            
            if existing_user:
                if check_password_hash(existing_user['password'], password):
                    session['username'] = existing_user['username']
                    session['user_id'] = existing_user['user_id']
                else:
                    conn.close()
                    return render_template('login.html', error="Contraseña incorrecta")
            else:
                new_id = str(uuid.uuid4())
                session['username'] = username
                session['user_id'] = new_id
                hashed_pw = generate_password_hash(password)
                c.execute('INSERT INTO users (user_id, username, friends, pending_requests, password) VALUES (?, ?, ?, ?, ?)',
                          (new_id, username, '[]', '[]', hashed_pw))
                conn.commit()
            conn.close()
            return redirect(url_for('portal'))
        else:
            return render_template('login.html', error="Faltan datos")
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
def portal():
    return render_template('portal.html')

@app.route('/juegos/memoria-total')
def memoria_total():
    return render_template('juegos/memoria_total.html')

# --- APIS DE PUNTUACIONES ---

@app.route('/api/save_score', methods=['POST'])
def save_score():
    data = request.json
    if not data or 'level' not in data:
        return jsonify({'status': 'error', 'msg': 'Invalid data'}), 400
    
    conn = get_db()
    c = conn.cursor()
    details = json.dumps(data.get('details', {}))
    c.execute('INSERT INTO scores (user_id, username, game, level, details) VALUES (?, ?, ?, ?, ?)',
              (session['user_id'], session['username'], data.get('game', 'memoria_total'), data['level'], details))
    
    # Mantener el límite de 500 scores para no inflar la BD si se desea, 
    # aunque en SQLite no es tan grave. Limpiaremos los más bajos si excede.
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    game = request.args.get('game', 'memoria_total')
    conn = get_db()
    c = conn.cursor()
    
    # Obtener el top 10 único por user_id
    c.execute('''
        SELECT user_id, username, level, details 
        FROM scores 
        WHERE game = ? 
        GROUP BY user_id 
        ORDER BY MAX(level) DESC 
        LIMIT 10
    ''', (game,))
    
    scores = [dict(row) for row in c.fetchall()]
    conn.close()
    
    # Para asegurar formato JSON
    for s in scores:
        if s.get('details'):
            s['details'] = json.loads(s['details'])
            
    return jsonify(scores)

# --- APIS DE AMIGOS ---

@app.route('/api/search_user', methods=['GET'])
def search_user():
    query = request.args.get('q', '').lower()
    if not query: return jsonify([])
    
    conn = get_db()
    c = conn.cursor()
    
    search_term = f"%{query}%"
    c.execute('''
        SELECT user_id, username FROM users 
        WHERE (lower(username) LIKE ? OR user_id LIKE ?) 
        AND user_id != ?
        LIMIT 10
    ''', (search_term, search_term, session['user_id']))
    
    results = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(results)

@app.route('/api/add_friend', methods=['POST'])
def add_friend():
    target_id = request.json.get('target_id')
    if not target_id or target_id == session['user_id']:
        return jsonify({'status': 'error', 'msg': 'ID inválido'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT friends FROM users WHERE user_id = ?', (session['user_id'],))
    current_user_row = c.fetchone()
    c.execute('SELECT pending_requests FROM users WHERE user_id = ?', (target_id,))
    target_user_row = c.fetchone()
    
    if current_user_row and target_user_row:
        current_friends = json.loads(current_user_row['friends'])
        target_pending = json.loads(target_user_row['pending_requests'])
        
        if target_id in current_friends:
            conn.close()
            return jsonify({'status': 'info', 'msg': 'Ya son conexiones activas'})
            
        if session['user_id'] in target_pending:
            conn.close()
            return jsonify({'status': 'info', 'msg': 'Solicitud ya enviada'})
            
        target_pending.append(session['user_id'])
        c.execute('UPDATE users SET pending_requests = ? WHERE user_id = ?', (json.dumps(target_pending), target_id))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'msg': 'Solicitud de conexión enviada.'})
        
    conn.close()
    return jsonify({'status': 'error'}), 400

@app.route('/api/pending_requests', methods=['GET'])
def get_pending_requests():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT pending_requests FROM users WHERE user_id = ?', (session['user_id'],))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify([])
        
    pending_ids = json.loads(row['pending_requests'])
    if not pending_ids:
        conn.close()
        return jsonify([])
        
    placeholders = ','.join('?' for _ in pending_ids)
    c.execute(f'SELECT user_id, username FROM users WHERE user_id IN ({placeholders})', pending_ids)
    pending_details = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return jsonify(pending_details)

@app.route('/api/respond_request', methods=['POST'])
def respond_request():
    target_id = request.json.get('target_id')
    action = request.json.get('action') # 'accept' o 'reject'
    
    if not target_id or action not in ['accept', 'reject']:
        return jsonify({'status': 'error'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT friends, pending_requests FROM users WHERE user_id = ?', (session['user_id'],))
    current = c.fetchone()
    c.execute('SELECT friends FROM users WHERE user_id = ?', (target_id,))
    target = c.fetchone()
    
    if current and target:
        pending = json.loads(current['pending_requests'])
        if target_id in pending:
            pending.remove(target_id)
            c.execute('UPDATE users SET pending_requests = ? WHERE user_id = ?', (json.dumps(pending), session['user_id']))
            
            if action == 'accept':
                my_friends = json.loads(current['friends'])
                their_friends = json.loads(target['friends'])
                
                if target_id not in my_friends: my_friends.append(target_id)
                if session['user_id'] not in their_friends: their_friends.append(session['user_id'])
                
                c.execute('UPDATE users SET friends = ? WHERE user_id = ?', (json.dumps(my_friends), session['user_id']))
                c.execute('UPDATE users SET friends = ? WHERE user_id = ?', (json.dumps(their_friends), target_id))
                
            conn.commit()
            conn.close()
            return jsonify({'status': 'success'})
            
    conn.close()
    return jsonify({'status': 'error'}), 400

@app.route('/api/remove_friend', methods=['POST'])
def remove_friend():
    target_id = request.json.get('target_id')
    if not target_id: return jsonify({'status': 'error'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT friends FROM users WHERE user_id = ?', (session['user_id'],))
    current = c.fetchone()
    c.execute('SELECT friends FROM users WHERE user_id = ?', (target_id,))
    target = c.fetchone()
    
    if current and target:
        my_friends = json.loads(current['friends'])
        their_friends = json.loads(target['friends'])
        
        if target_id in my_friends: my_friends.remove(target_id)
        if session['user_id'] in their_friends: their_friends.remove(session['user_id'])
        
        c.execute('UPDATE users SET friends = ? WHERE user_id = ?', (json.dumps(my_friends), session['user_id']))
        c.execute('UPDATE users SET friends = ? WHERE user_id = ?', (json.dumps(their_friends), target_id))
        
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
        
    conn.close()
    return jsonify({'status': 'error'}), 400

@app.route('/api/friends', methods=['GET'])
def get_friends():
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT friends FROM users WHERE user_id = ?', (session['user_id'],))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify([])
        
    friend_ids = json.loads(row['friends'])
    if not friend_ids:
        conn.close()
        return jsonify([])
        
    placeholders = ','.join('?' for _ in friend_ids)
    c.execute(f'SELECT user_id, username FROM users WHERE user_id IN ({placeholders})', friend_ids)
    friend_details = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return jsonify(friend_details)

# --- APIS DE VERSUS / RETOS ---

@app.route('/api/create_challenge', methods=['POST'])
def create_challenge():
    target_id = request.json.get('target_id')
    settings = request.json.get('settings', {})
    if not target_id: return jsonify({'status': 'error'}), 400
    
    uid = session['user_id']
    conn = get_db()
    c = conn.cursor()
    
    # Check si ya hay reto pendiente
    c.execute('''
        SELECT * FROM challenges 
        WHERE ((creator_id = ? AND target_id = ?) OR (creator_id = ? AND target_id = ?))
        AND status != 'completed'
    ''', (uid, target_id, target_id, uid))
    existing = c.fetchone()
    
    if existing:
        conn.close()
        return jsonify({'status': 'error', 'msg': 'Ya tienes un reto pendiente con esta conexión. Vence el actual primero.'})
        
    new_id = str(uuid.uuid4())
    seed = random.randint(1, 999999999)
    
    c.execute('''
        INSERT INTO challenges 
        (id, creator_id, target_id, seed, settings, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (new_id, uid, target_id, seed, json.dumps(settings), 'pending_both'))
    
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'success', 'challenge': {
        'id': new_id, 'creator_id': uid, 'target_id': target_id,
        'seed': seed, 'status': 'pending_both'
    }})

@app.route('/api/challenges', methods=['GET'])
def get_challenges():
    uid = session['user_id']
    conn = get_db()
    c = conn.cursor()
    
    # Hacer JOIN para traer nombres
    c.execute('''
        SELECT c.*, 
               u1.username as creator_name, 
               u2.username as target_name
        FROM challenges c
        LEFT JOIN users u1 ON c.creator_id = u1.user_id
        LEFT JOIN users u2 ON c.target_id = u2.user_id
        WHERE c.creator_id = ? OR c.target_id = ?
        ORDER BY c.rowid DESC
    ''', (uid, uid))
    
    rows = c.fetchall()
    conn.close()
    
    my_challenges = []
    for row in rows:
        c_copy = dict(row)
        
        am_i_creator = (c_copy['creator_id'] == uid)
        c_copy['am_i_creator'] = am_i_creator
        
        c_copy['my_score'] = c_copy['creator_score'] if am_i_creator else c_copy['target_score']
        c_copy['their_score'] = c_copy['target_score'] if am_i_creator else c_copy['creator_score']
        c_copy['opponent_name'] = c_copy['target_name'] if am_i_creator else c_copy['creator_name']
        
        c_copy['my_turn'] = False
        st = c_copy['status']
        if st in ['pending_both', 'waiting']:
            c_copy['my_turn'] = True
        elif st == 'pending_creator' and am_i_creator:
            c_copy['my_turn'] = True
        elif st == 'pending_target' and not am_i_creator:
            c_copy['my_turn'] = True
            
        # Fix missing names if user deleted
        if not c_copy['creator_name']: c_copy['creator_name'] = 'Desconocido'
        if not c_copy['target_name']: c_copy['target_name'] = 'Desconocido'
            
        my_challenges.append(c_copy)
        
    return jsonify(my_challenges)

@app.route('/api/complete_challenge', methods=['POST'])
def complete_challenge():
    c_id = request.json.get('challenge_id')
    score = request.json.get('score')
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT * FROM challenges WHERE id = ?', (c_id,))
    challenge = c.fetchone()
    
    if not challenge: 
        conn.close()
        return jsonify({'status': 'error'}), 400
        
    uid = session['user_id']
    creator_id = challenge['creator_id']
    target_id = challenge['target_id']
    
    new_status = challenge['status']
    cr_score = challenge['creator_score']
    tg_score = challenge['target_score']
    
    if creator_id == uid:
        cr_score = score
        c.execute('UPDATE challenges SET creator_score = ? WHERE id = ?', (score, c_id))
    elif target_id == uid:
        tg_score = score
        c.execute('UPDATE challenges SET target_score = ? WHERE id = ?', (score, c_id))
        
    if cr_score is not None and tg_score is not None:
        new_status = 'completed'
    elif cr_score is not None:
        new_status = 'pending_target'
    elif tg_score is not None:
        new_status = 'pending_creator'
        
    c.execute('UPDATE challenges SET status = ? WHERE id = ?', (new_status, c_id))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
