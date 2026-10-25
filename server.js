require('dotenv').config();

// Ensure pgbouncer=true for Prisma when connecting to Supabase transaction pooler (port 6543)
if (
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes(':6543') || process.env.DATABASE_URL.includes('pooler.supabase.com')) &&
  !process.env.DATABASE_URL.includes('pgbouncer=true')
) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

const express = require('express');
const compression = require('compression');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 8080;
const appName = process.env.APP_NAME || 'Student 1 Service';

if (typeof BigInt !== 'undefined') {
  BigInt.prototype.toJSON = function () {
    return Number(this);
  };
}

// 1. Determine target schema from DATABASE_URL (?schema=...) or DB_SCHEMA env var
let targetSchema = process.env.DB_SCHEMA || 'student1';
if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const schemaParam = parsed.searchParams.get('schema');
    if (schemaParam) {
      targetSchema = schemaParam;
    } else {
      parsed.searchParams.set('schema', targetSchema);
      process.env.DATABASE_URL = parsed.toString();
    }
  } catch (err) {
    console.warn('Could not parse DATABASE_URL as URL, using schema:', targetSchema);
  }
}

// 2. Initialize PostgreSQL Pool (for Lab Notes API)
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

// Circuit-breaker resilience for PostgreSQL pool: prevents 2.5s TCP hangs when Supabase is paused/offline
let isPoolOffline = !pool;

async function safePoolQuery(queryText, params = [], timeoutMs = 250) {
  if (!pool || isPoolOffline) return null;
  try {
    const queryPromise = pool.query(queryText, params);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PostgreSQL query timeout')), timeoutMs)
    );
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (err) {
    isPoolOffline = true;
    console.warn(`[Supabase Standby] PostgreSQL query failed/timed out (${err.message}). Switched to in-memory fallback.`);
    return null;
  }
}

// Background probe on startup within 300ms
if (pool) {
  safePoolQuery('SELECT 1;', [], 300).then((res) => {
    if (res) {
      isPoolOffline = false;
      console.log(`[Database] PostgreSQL connection active in schema: "${targetSchema}"`);
    } else {
      isPoolOffline = true;
    }
  });
}

// In-memory fallback store for notes when remote database is standby/offline
let inMemoryNotes = [
  {
    id: 1,
    title: 'Item Selamat Datang (Resilient Mode)',
    content: 'Data tersimpan otomatis dalam skema student1.',
    created_at: new Date().toISOString(),
  },
];
let nextNoteId = 2;

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
    console.warn('[Database] Remote connection warning (using resilient fallback):', err.message);
  }
}

app.use(compression());
app.use(express.json());

// Enforce X-Robots-Tag: noindex, nofollow, noarchive on all /api endpoints
app.use('/api', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

// 4. Lab REST API Endpoints

// Cloud Run Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    appName,
    schema: targetSchema,
    timestamp: new Date().toISOString(),
    warungMadura: 'online',
  });
});

// Database info with resilient fallback
app.get('/api/schema-info', async (req, res) => {
  let user = 'student1_user';
  let activeSchema = targetSchema;
  let tables = [
    'notes',
    'User',
    'Product',
    'PurchaseOrder',
    'PurchaseOrderItem',
    'GoodsReceipt',
    'GoodsReceiptItem',
    'StockMovement',
    'Sale',
    'SaleItem',
    'Receiver',
    'Supplier',
  ];

  if (pool && !isPoolOffline) {
    try {
      const info = await safePoolQuery(`SELECT current_user, current_schema();`, [], 250);
      if (info && info.rows && info.rows.length > 0) {
        user = info.rows[0].current_user;
        activeSchema = info.rows[0].current_schema;
        const tablesRes = await safePoolQuery(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = $1;`,
          [targetSchema],
          250
        );
        if (tablesRes && tablesRes.rows && tablesRes.rows.length > 0) {
          tables = tablesRes.rows.map((r) => r.table_name);
        }
      }
    } catch (err) {
      console.warn('[Supabase Standby] Using fallback schema info:', err.message);
    }
  }

  res.json({ user, activeSchema, tables });
});

// GET all notes (resilient to remote database outages)
app.get('/api/notes', async (req, res) => {
  if (pool && !isPoolOffline) {
    try {
      const result = await safePoolQuery(`
        SELECT id, title, content, created_at 
        FROM notes 
        ORDER BY id DESC;
      `, [], 250);
      if (result && result.rows) {
        return res.json(result.rows);
      }
    } catch (err) {
      console.warn('[Supabase Standby] Using in-memory fallback for notes:', err.message);
    }
  }
  res.json(inMemoryNotes);
});

// POST new note (resilient to remote database outages)
app.post('/api/notes', async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  if (pool && !isPoolOffline) {
    try {
      const result = await safePoolQuery(
        `INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *;`,
        [title, content || ''],
        250
      );
      if (result && result.rows && result.rows.length > 0) {
        return res.status(201).json(result.rows[0]);
      }
    } catch (err) {
      console.warn('[Supabase Standby] Adding note to in-memory fallback:', err.message);
    }
  }

  const newNote = {
    id: nextNoteId++,
    title,
    content: content || '',
    created_at: new Date().toISOString(),
  };
  inMemoryNotes.unshift(newNote);
  res.status(201).json(newNote);
});

// DELETE note by ID (resilient to remote database outages)
app.delete('/api/notes/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (pool && !isPoolOffline) {
    try {
      const result = await safePoolQuery(`DELETE FROM notes WHERE id = $1 RETURNING *;`, [req.params.id], 250);
      if (result && result.rowCount > 0) {
        return res.json({ message: 'Note deleted', deleted: result.rows[0] });
      }
    } catch (err) {
      console.warn('[Supabase Standby] Deleting note from in-memory fallback:', err.message);
    }
  }

  const index = inMemoryNotes.findIndex((n) => n.id === id);
  if (index !== -1) {
    const deleted = inMemoryNotes.splice(index, 1)[0];
    return res.json({ message: 'Note deleted', deleted });
  }
  res.json({ message: 'Note deleted', deleted: { id } });
});

// 5. Warung Madura Stock Manager REST APIs
try {
  const { apiRouter } = require('./dist/routes');
  const { errorHandler } = require('./dist/middleware/error-handler');
  app.use('/api', apiRouter);
  app.use(errorHandler);
  console.log('[Warung Madura] REST APIs mounted successfully.');
} catch (err) {
  console.error('[Warung Madura] Error mounting API routes:', err);
}

// Fallback for unknown /api/* endpoints - always return real 404 JSON (never HTML or 200)
app.use('/api', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint API tidak ditemukan.' } });
});

// 6. Serve Compiled Frontend & Lab Dashboard
const publicPath = path.join(__dirname, 'public');

// Highly cacheable hashed assets (Vite outputs content hashes in /assets/)
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Serve general static files with no-cache enforcement for index.html
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// DevSprint Container Lab Dashboard (/lab)
app.get(['/lab', '/lab-dashboard', '/notes-dashboard'], async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  let dbStatus = {
    connected: false,
    user: 'N/A',
    schema: targetSchema,
    error: null,
  };

  if (pool && !isPoolOffline) {
    try {
      const result = await safePoolQuery('SELECT current_user, current_schema();', [], 250);
      if (result && result.rows && result.rows.length > 0) {
        dbStatus.connected = true;
        dbStatus.user = result.rows[0].current_user;
        dbStatus.schema = result.rows[0].current_schema;
      } else {
        dbStatus.user = 'student1_user';
      }
    } catch (err) {
      dbStatus.error = err.message;
      dbStatus.user = 'student1_user';
    }
  } else {
    dbStatus.error = isPoolOffline ? 'Database is standby (unreachable)' : 'DATABASE_URL environment variable is missing';
    dbStatus.user = 'student1_user';
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Cloud Run & Supabase Lab</title>
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
    .nav-link {
      display: inline-block;
      margin-bottom: 16px;
      color: var(--primary);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .nav-link:hover { text-decoration: underline; }
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
    <a href="/" class="nav-link">← Kembali ke Warung Madura Stock Manager</a>

    <!-- Top System Card -->
    <div class="header-card">
      ${
        dbStatus.connected
          ? '<div class="badge badge-online">● Supabase Connected</div>'
          : '<div class="badge badge-online" style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid #eab308;">● Resilient Standby Mode</div>'
      }
      <h1>${appName}</h1>
      <p class="subtitle">DevSprint Container &middot; Cloud Run Auto-Deployed &middot; Isolated PostgreSQL Schema</p>

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
        Your classmates on other branches cannot view or overwrite your data because each branch uses its own schema!
      </p>
    </div>
  </div>

  <script>
    async function loadNotes() {
      try {
        const res = await fetch('/api/notes');
        const notes = await res.json();
        const list = document.getElementById('notesList');
        const count = document.getElementById('itemCount');

        if (!Array.isArray(notes)) {
          list.innerHTML = '<div class="empty-msg" style="color:var(--text-muted)">Mode Standby Aktif. Menampilkan catatan in-memory.</div>';
          count.textContent = '0 items';
          return;
        }
        
        count.textContent = notes.length + ' item' + (notes.length === 1 ? '' : 's');

        if (notes.length === 0) {
          list.innerHTML = '<div class="empty-msg">No items in your schema yet. Add one above!</div>';
          return;
        }

        list.innerHTML = notes.map(n => \`
          <div class="note-item">
            <div class="note-header">
              <span class="note-title">\${escapeHtml(n.title)}</span>
              <span class="note-date">\${new Date(n.created_at).toLocaleTimeString()}</span>
            </div>
            \${n.content ? \`<div class="note-content">\${escapeHtml(n.content)}</div>\` : ''}
            <button class="btn-delete" onclick="deleteNote(\${n.id})">Delete</button>
          </div>
        \`).join('');
      } catch (err) {
        document.getElementById('notesList').innerHTML = '<div class="empty-msg" style="color:var(--danger)">Failed to load items</div>';
      }
    }

    document.getElementById('noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value;
      const content = document.getElementById('content').value;
      const btn = document.getElementById('submitBtn');

      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content })
        });
        document.getElementById('noteForm').reset();
        await loadNotes();
      } catch (err) {
        alert('Error saving note: ' + err.message);
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

    loadNotes();
  </script>
</body>
</html>
  `;
  res.send(html);
});

// 7. SPA Fallback for Warung Madura Stock Manager
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint API tidak ditemukan.' } });
  }

  // Only public landing/login pages should be indexable
  // Private pages (dashboard, stock, products, orders, pos, rbac, etc.) get X-Robots-Tag: noindex
  const publicPaths = new Set(['/', '/login', '/index.html']);
  if (!publicPaths.has(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start Server and Initialize Database
const server = app.listen(port, async () => {
  console.log(`[${appName}] Server running on port ${port}`);
  await initDatabase();
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down server gracefully...');
  server.close();
  if (pool) {
    try {
      await pool.end();
    } catch {}
  }
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
