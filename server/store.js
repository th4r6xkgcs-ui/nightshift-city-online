'use strict';
// Player profile storage. No database and no paid service: profiles live in
// memory, optionally mirrored to one JSON file with atomic writes.
// Tokens are stored only as SHA-256 hashes, so the file can't be used to log in.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newToken = () => crypto.randomBytes(16).toString('hex');
const isToken = (t) => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);

class MemoryStore {
  constructor() { this.data = new Map(); }
  load(token) { return isToken(token) ? structuredClone(this.data.get(hash(token)) ?? null) : null; }
  save(token, profile) { if (isToken(token)) this.data.set(hash(token), structuredClone(profile)); }
  flush() {}
  get size() { return this.data.size; }
}

class FileStore extends MemoryStore {
  constructor(file, { debounceMs = 2000 } = {}) {
    super();
    this.file = path.resolve(file);
    this.debounceMs = debounceMs;
    this.timer = null;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw?.v === 1 && raw.profiles && typeof raw.profiles === 'object') {
        for (const [k, v] of Object.entries(raw.profiles)) if (/^[a-f0-9]{64}$/.test(k)) this.data.set(k, v);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Keep the unreadable file for inspection instead of overwriting it.
        const bad = this.file + '.corrupt-' + Date.now();
        try { fs.renameSync(this.file, bad); } catch {}
        console.warn(`profile store unreadable, moved to ${bad}: ${e.message}`);
      }
    }
  }

  save(token, profile) {
    super.save(token, profile);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const body = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), profiles: Object.fromEntries(this.data) });
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    fs.renameSync(tmp, this.file); // atomic on POSIX: never a half-written file
  }
}

module.exports = { MemoryStore, FileStore, newToken, isToken };
