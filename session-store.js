const { Store } = require('express-session');

class SQLiteStore extends Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, cb) {
    try {
      const row = this.db.prepare('SELECT data FROM sessions WHERE sid = ? AND expires > datetime(?)')
        .get(sid, new Date().toISOString());
      if (!row) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  set(sid, data, cb) {
    try {
      const expires = data.cookie && data.cookie._expires
        ? new Date(data.cookie._expires).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
      this.db.prepare(`INSERT INTO sessions (sid, expires, data) VALUES (?,?,?)
        ON CONFLICT(sid) DO UPDATE SET expires=excluded.expires, data=excluded.data`)
        .run(sid, expires, JSON.stringify(data));
      cb(null);
    } catch (e) { cb(e); }
  }

  destroy(sid, cb) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb(null);
    } catch (e) { cb(e); }
  }

  touch(sid, data, cb) {
    try {
      const expires = data.cookie && data.cookie._expires
        ? new Date(data.cookie._expires).toISOString()
        : new Date(Date.now() + 86400000).toISOString();
      this.db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?').run(expires, sid);
      cb(null);
    } catch (e) { cb(e); }
  }
}

module.exports = SQLiteStore;
