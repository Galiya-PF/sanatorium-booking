const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./sanatorium.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err);
  } else {
    console.log('Подключено к базе данных SQLite');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Таблица заявок
    db.run(`CREATE TABLE IF NOT EXISTS applications (
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
    )`);

    // Таблица санаториев
    db.run(`CREATE TABLE IF NOT EXISTS sanatoriums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      contact_phone TEXT,
      is_active BOOLEAN DEFAULT 1
    )`);

    // Добавим несколько санаториев для примера
    const sanatoriums = [
      { name: 'Арман', address: 'г. Боровое', contact_phone: '+7 (716) 364-XX-XX' },
      { name: 'Арай делюкс', address: 'г. Боровое', contact_phone: '+7 (716) 364-XX-XX' },
      { name: 'Манкент', address: 'Туркестанская область', contact_phone: '+7 (725) 331-XX-XX' },
      { name: 'Мерке', address: 'Жамбылская область', contact_phone: '+7 (726) 221-XX-XX' },
      { name: 'Жанакорган', address: 'Кызылординская область', contact_phone: '+7 (724) 221-XX-XX' },
      { name: 'Юкон', address: 'г. Щучинск', contact_phone: '+7 (716) 362-XX-XX' },
      { name: 'Зару', address: 'Алматинская область', contact_phone: '+7 (727) 292-XX-XX' },
      { name: 'Шипагер', address: 'Акмолинская область', contact_phone: '+7 (716) 362-XX-XX' },
      { name: 'Коктем', address: 'г. Алматы', contact_phone: '+7 (727) 292-XX-XX' },
      { name: 'Казахстан', address: 'г. Боровое', contact_phone: '+7 (716) 364-XX-XX' },
      { name: 'Сосновый бор', address: 'г. Щучинск', contact_phone: '+7 (716) 362-XX-XX' },
      { name: 'Щучинск', address: 'г. Щучинск', contact_phone: '+7 (716) 362-XX-XX' }
    ];

    const insertSanatorium = db.prepare('INSERT OR IGNORE INTO sanatoriums (name, address, contact_phone) VALUES (?, ?, ?)');
    sanatoriums.forEach(s => {
      insertSanatorium.run(s.name, s.address, s.contact_phone);
    });
    insertSanatorium.finalize();
  });
}

// API Routes

// Получить список санаториев
app.get('/api/sanatoriums', (req, res) => {
  db.all('SELECT * FROM sanatoriums WHERE is_active = 1 ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Создать заявку
app.post('/api/applications', (req, res) => {
  const { full_name, sanatorium, start_date, days, email, phone, department, vacation_schedule_confirmed } = req.body;

  // Валидация
  if (!full_name || !sanatorium || !start_date || !days || !email || !phone) {
    return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
  }

  if (days < 7 || days > 10) {
    return res.status(400).json({ error: 'Количество дней должно быть от 7 до 10' });
  }

  if (!vacation_schedule_confirmed) {
    return res.status(400).json({ error: 'Необходимо подтвердить соответствие графику отпусков' });
  }

  const sql = `INSERT INTO applications (full_name, sanatorium, start_date, days, email, phone, department, vacation_schedule_confirmed)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [full_name, sanatorium, start_date, days, email, phone, department, vacation_schedule_confirmed], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      id: this.lastID, 
      message: 'Заявка успешно отправлена' 
    });
  });
});

// Получить все заявки (для админа)
app.get('/api/applications', (req, res) => {
  const sql = `SELECT a.*, s.address as sanatorium_address 
               FROM applications a 
               LEFT JOIN sanatoriums s ON a.sanatorium = s.name
               ORDER BY a.created_at DESC`;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Получить заявку по ID
app.get('/api/applications/:id', (req, res) => {
  const sql = `SELECT a.*, s.address as sanatorium_address 
               FROM applications a 
               LEFT JOIN sanatoriums s ON a.sanatorium = s.name
               WHERE a.id = ?`;
  
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }
    res.json(row);
  });
});

// Обновить статус заявки (для админа)
app.put('/api/applications/:id', (req, res) => {
  const { status, admin_comment } = req.body;
  
  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }

  const sql = `UPDATE applications 
               SET status = ?, admin_comment = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`;
  
  db.run(sql, [status, admin_comment, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Статус обновлен' });
  });
});

// Удалить заявку
app.delete('/api/applications/:id', (req, res) => {
  db.run('DELETE FROM applications WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Заявка удалена' });
  });
});

// Получить статистику
app.get('/api/stats', (req, res) => {
  db.all(`SELECT status, COUNT(*) as count FROM applications GROUP BY status`, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
