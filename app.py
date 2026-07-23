from flask import Flask, render_template, request, jsonify
import sqlite3
import datetime
from functools import wraps

app = Flask(__name__)
DB_NAME = 'sanatorium.db'

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            sanatorium TEXT NOT NULL,
            start_date TEXT NOT NULL,
            days INTEGER NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            department TEXT,
            vacation_schedule_confirmed BOOLEAN NOT NULL,
            status TEXT DEFAULT 'pending',
            admin_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sanatoriums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT,
            contact_phone TEXT,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    sanatoriums = [
        ('Арман', 'г. Боровое', '+7 (716) 364-XX-XX'),
        ('Арай делюкс', 'г. Боровое', '+7 (716) 364-XX-XX'),
        ('Манкент', 'Туркестанская область', '+7 (725) 331-XX-XX'),
        ('Мерке', 'Жамбылская область', '+7 (726) 221-XX-XX'),
        ('Жанакорган', 'Кызылординская область', '+7 (724) 221-XX-XX'),
        ('Юкон', 'г. Щучинск', '+7 (716) 362-XX-XX'),
        ('Зару', 'Алматинская область', '+7 (727) 292-XX-XX'),
        ('Шипагер', 'Акмолинская область', '+7 (716) 362-XX-XX'),
        ('Коктем', 'г. Алматы', '+7 (727) 292-XX-XX'),
        ('Казахстан', 'г. Боровое', '+7 (716) 364-XX-XX'),
        ('Сосновый бор', 'г. Щучинск', '+7 (716) 362-XX-XX'),
        ('Щучинск', 'г. Щучинск', '+7 (716) 362-XX-XX')
    ]
    
    cursor.executemany('INSERT OR IGNORE INTO sanatoriums (name, address, contact_phone) VALUES (?, ?, ?)', sanatoriums)
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/sanatoriums', methods=['GET'])
def get_sanatoriums():
    conn = get_db_connection()
    sanatoriums = conn.execute('SELECT * FROM sanatoriums WHERE is_active = 1 ORDER BY name').fetchall()
    conn.close()
    return jsonify([dict(row) for row in sanatoriums])

@app.route('/api/applications', methods=['GET'])
def get_applications():
    conn = get_db_connection()
    applications = conn.execute('''
        SELECT a.*, s.address as sanatorium_address 
        FROM applications a 
        LEFT JOIN sanatoriums s ON a.sanatorium = s.name
        ORDER BY a.created_at DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in applications])

@app.route('/api/applications', methods=['POST'])
def create_application():
    data = request.json
    
    if not all(k in data for k in ['full_name', 'sanatorium', 'start_date', 'days', 'email', 'phone']):
        return jsonify({'error': 'Все обязательные поля должны быть заполнены'}), 400
    
    days = int(data['days'])
    if days < 7 or days > 10:
        return jsonify({'error': 'Количество дней должно быть от 7 до 10'}), 400
    
    if not data.get('vacation_schedule_confirmed'):
        return jsonify({'error': 'Необходимо подтвердить соответствие графику отпусков'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO applications (full_name, sanatorium, start_date, days, email, phone, department, vacation_schedule_confirmed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['full_name'], data['sanatorium'], data['start_date'], days, 
          data['email'], data['phone'], data.get('department', ''), data['vacation_schedule_confirmed']))
    app_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': app_id, 'message': 'Заявка успешно отправлена'})

@app.route('/api/applications/<int:id>', methods=['GET'])
def get_application(id):
    conn = get_db_connection()
    application = conn.execute('''
        SELECT a.*, s.address as sanatorium_address 
        FROM applications a 
        LEFT JOIN sanatoriums s ON a.sanatorium = s.name
        WHERE a.id = ?
    ''', (id,)).fetchone()
    conn.close()
    
    if not application:
        return jsonify({'error': 'Заявка не найдена'}), 404
    
    return jsonify(dict(application))

@app.route('/api/applications/<int:id>', methods=['PUT'])
def update_application(id):
    data = request.json
    
    valid_statuses = ['pending', 'approved', 'rejected']
    if data.get('status') not in valid_statuses:
        return jsonify({'error': 'Неверный статус'}), 400
    
    conn = get_db_connection()
    conn.execute('''
        UPDATE applications 
        SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ''', (data.get('status'), data.get('admin_comment', ''), id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Статус обновлен'})

@app.route('/api/applications/<int:id>', methods=['DELETE'])
def delete_application(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM applications WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Заявка удалена'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    stats = conn.execute('SELECT status, COUNT(*) as count FROM applications GROUP BY status').fetchall()
    conn.close()
    return jsonify([dict(row) for row in stats])

if __name__ == '__main__':
    init_database()
    print('Сервер запущен на http://localhost:5000')
    app.run(debug=True, port=5000)
