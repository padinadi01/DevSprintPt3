const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;
const appName = process.env.APP_NAME || 'Student 3 Service';

// 1. Determine target schema from DATABASE_URL (?schema=...) or DB_SCHEMA env var
let targetSchema = process.env.DB_SCHEMA || 'student3';
if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const schemaParam = parsed.searchParams.get('schema');
    if (schemaParam) {
      targetSchema = schemaParam;
    }
  } catch (err) {
    console.warn('Could not parse DATABASE_URL as URL, using schema:', targetSchema);
  }
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(targetSchema)) {
  throw new Error('Invalid PostgreSQL schema name');
}

// 2. Initialize PostgreSQL Pool
let pool = null;
if (process.env.DATABASE_URL) {
  const isSupabase = process.env.DATABASE_URL.includes('supabase.com');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Automatically enforce the student's isolated schema on every client connection
  pool.on('connect', (client) => {
    client.query(`SET search_path TO "${targetSchema}", public;`);
  });
}

// 3. Auto-initialize example 'notes' table in the assigned schema
async function initDatabase() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log(`[Database] "notes" table initialized in schema: "${targetSchema}"`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] Initialization error:', err.message);
  }
}

app.use(express.json());

// 4. REST API Endpoints

// Cloud Run Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName,
    schema: targetSchema,
    timestamp: new Date().toISOString(),
  });
});

// Database info
app.get('/api/schema-info', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const info = await pool.query(`
      SELECT current_user, current_schema(), version();
    `);
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1;
    `, [targetSchema]);

    res.json({
      user: info.rows[0].current_user,
      activeSchema: info.rows[0].current_schema,
      tables: tables.rows.map(r => r.table_name),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all notes
app.get('/api/notes', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'DATABASE_URL not configured' });
  try {
    const result = await pool.query(`
      SELECT id, title, content, created_at
      FROM notes
      ORDER BY id DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new note
app.post('/api/notes', async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!pool) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  try {
    const result = await pool.query(
      `INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *;`,
      [title, content || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE note by ID
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  if (!pool) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  try {
    const result = await pool.query(`DELETE FROM notes WHERE id = $1 RETURNING *;`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Interactive Web Dashboard
app.get('/', async (req, res) => {
  let dbStatus = {
    connected: false,
    user: 'N/A',
    schema: targetSchema,
    error: null,
  };

  if (pool) {
    try {
      const result = await pool.query('SELECT current_user, current_schema();');
      dbStatus.connected = true;
      dbStatus.user = result.rows[0].current_user;
      dbStatus.schema = result.rows[0].current_schema;
    } catch (err) {
      dbStatus.error = err.message;
    }
  } else {
    dbStatus.error = 'DATABASE_URL environment variable is missing';
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Cloud Run & Supabase</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --card-hover: #24344d;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --success: #22c55e;
      --danger: #ef4444;
      --border: #334155;
      --code-bg: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
    }
    .container {
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header-card {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .badge-online { background: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid var(--success); }
    .badge-error { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger); }
    h1 { font-size: 1.85rem; font-weight: 700; margin-bottom: 6px; }
    p.subtitle { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .stat-box {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
    }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.05rem; font-weight: 700; color: var(--primary); margin-top: 4px; word-break: break-all; }

    .main-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    @media (min-width: 768px) {
      .main-grid { grid-template-columns: 320px 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    h2 { font-size: 1.25rem; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }

    /* Form styles */
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; }
    input[type="text"], textarea {
      width: 100%;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--text);
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus, textarea:focus { border-color: var(--primary); }
    textarea { resize: vertical; min-height: 80px; }
    button.btn {
      width: 100%;
      background: var(--primary);
      color: #0f172a;
      border: none;
      border-radius: 8px;
      padding: 11px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    button.btn:hover { background: var(--primary-hover); color: #fff; }
    button.btn:active { transform: scale(0.98); }

    /* Notes List */
    .notes-list { display: flex; flex-direction: column; gap: 12px; max-height: 440px; overflow-y: auto; padding-right: 4px; }
    .note-item {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }
    .note-header { display: flex; justify-content: space-between; align-items: baseline; }
    .note-title { font-weight: 700; font-size: 1.05rem; color: var(--text); }
    .note-date { font-size: 0.75rem; color: var(--text-muted); }
    .note-content { font-size: 0.9rem; color: #cbd5e1; line-height: 1.4; white-space: pre-wrap; }
    .btn-delete {
      align-self: flex-end;
      background: transparent;
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      margin-top: 6px;
      transition: all 0.2s;
    }
    .btn-delete:hover { background: var(--danger); color: white; }
    .empty-msg { text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 32px 0; }

    .explainer-card {
      background: rgba(56, 189, 248, 0.05);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 12px;
      padding: 18px;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .explainer-card strong { color: var(--primary); }
    code { background: rgba(0, 0, 0, 0.4); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--primary); }
  </style>
</head>
<body>
  <div class="container">

    <!-- Top System Card -->
    <div class="header-card">
      <div class="badge ${dbStatus.connected ? 'badge-online' : 'badge-error'}">
        ● ${dbStatus.connected ? 'Supabase Connected' : 'Database Error'}
      </div>
      <h1>${appName}</h1>
      <p class="subtitle">Cloud Run Auto-Deployed Container &middot; Isolated PostgreSQL Schema</p>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Assigned Schema</div>
          <div class="stat-value">${dbStatus.schema}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Database User</div>
          <div class="stat-value">${dbStatus.user}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Container Port</div>
          <div class="stat-value">${port}</div>
        </div>
      </div>
    </div>

    <!-- Live CRUD Application Grid -->
    <div class="main-grid">
      <!-- Create Note -->
      <div class="card">
        <h2>Add Item to Database</h2>
        <form id="noteForm">
          <div class="form-group">
            <label for="title">Title</label>
            <input type="text" id="title" placeholder="e.g. Test Item" required />
          </div>
          <div class="form-group">
            <label for="content">Description / Content</label>
            <textarea id="content" placeholder="e.g. This row is saved directly in ${dbStatus.schema}.notes"></textarea>
          </div>
          <button type="submit" class="btn" id="submitBtn">Save to Database</button>
        </form>
      </div>

      <!-- Notes Feed -->
      <div class="card">
        <h2>
          <span>Items in Schema: <code>${dbStatus.schema}.notes</code></span>
          <span style="font-size: 0.85rem; color: var(--text-muted);" id="itemCount">Loading...</span>
        </h2>
        <div class="notes-list" id="notesList">
          <div class="empty-msg">Fetching data from Supabase...</div>
        </div>
      </div>
    </div>

    <!-- Educational Architecture Explainer -->
    <div class="explainer-card">
      <strong>💡 How Schema Isolation Works for You:</strong>
      <p style="margin-top: 6px;">
        Every time your app runs <code>SELECT * FROM notes</code> or <code>INSERT INTO notes</code>, PostgreSQL automatically saves it to <strong><code>${dbStatus.schema}.notes</code></strong>.
        Other students can have their own <code>notes</code> table with completely different data and never collide with yours!
      </p>
    </div>

  </div>

  <script>
    async function loadNotes() {
      const listEl = document.getElementById('notesList');
      const countEl = document.getElementById('itemCount');
      try {
        const res = await fetch('/api/notes');
        const notes = await res.json();

        countEl.textContent = notes.length + ' item(s)';

        if (!notes || notes.length === 0) {
          listEl.innerHTML = '<div class="empty-msg">No items found in this schema yet. Add one on the left!</div>';
          return;
        }

        listEl.innerHTML = notes.map(n => \`
          <div class="note-item">
            <div class="note-header">
              <span class="note-title">\${escapeHtml(n.title)}</span>
              <span class="note-date">\${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            \${n.content ? \`<div class="note-content">\${escapeHtml(n.content)}</div>\` : ''}
            <button class="btn-delete" onclick="deleteNote(\${n.id})">Delete</button>
          </div>
        \`).join('');
      } catch (err) {
        listEl.innerHTML = '<div class="empty-msg" style="color: var(--danger)">Error loading data: ' + err.message + '</div>';
        countEl.textContent = 'Error';
      }
    }

    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('title');
      const contentInput = document.getElementById('content');
      const btn = document.getElementById('submitBtn');

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleInput.value,
            content: contentInput.value
          })
        });

        if (res.ok) {
          titleInput.value = '';
          contentInput.value = '';
          await loadNotes();
        } else {
          alert('Failed to save item');
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save to Database';
      }
    });

    async function deleteNote(id) {
      if (!confirm('Delete this item from your schema?')) return;
      try {
        await fetch('/api/notes/' + id, { method: 'DELETE' });
        await loadNotes();
      } catch (err) {
        alert('Error deleting note: ' + err.message);
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Initial load
    loadNotes();
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Start Server and Initialize Database
app.listen(port, async () => {
  console.log(`[${appName}] Server running on port ${port}`);
  await initDatabase();
});
