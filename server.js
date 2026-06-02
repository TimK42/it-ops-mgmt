const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const SQLiteStore = require('./session-store');

const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  store: new SQLiteStore(getDb()),
  secret: process.env.SESSION_SECRET || 'it-ops-mgmt-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 16 * 60 * 60 * 1000, // 16h idle
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// Public auth routes (no login required)
app.use('/api/auth', require('./routes/auth'));

// Auth guard — all /api/* below this requires login
app.use('/api', (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
});

// Role helpers
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// QA routes — GET open to all roles, write operations Contributor+
app.use('/api/qa', (req, res, next) => {
  if (req.method === 'GET') return next(); // all roles can read
  if (['Admin','Contributor'].includes(req.session.role)) return next();
  return res.status(403).json({ error: 'Forbidden' });
}, require('./routes/qa'));

// Categories — Admin only
app.use('/api/categories', requireRole('Admin'), require('./routes/categories'));

// Users — Admin only
app.use('/api/users', requireRole('Admin'), require('./routes/users'));

app.get('/api/stats', (req, res) => {
  const db = getDb();
  res.json({
    qa: { total: db.prepare('SELECT COUNT(*) as c FROM qa_entries').get().c },
    categories: db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
  });
});

app.get('/*path', (req, res) => {
  if (req.path.startsWith('/api/') || req.path === '/api') return res.status(404).json({error:'Not found'});
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
  res.status(404).type('html').send(html);
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IT Ops Management running at http://localhost:${PORT}`);
    const db = getDb();
    console.log(`DB: ${db.prepare('SELECT COUNT(*) as c FROM qa_entries').get().c} QA entries, ${db.prepare('SELECT COUNT(*) as c FROM categories').get().c} categories`);
  });
}

module.exports = app;
