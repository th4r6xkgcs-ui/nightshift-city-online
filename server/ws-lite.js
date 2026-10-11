'use strict';
// Minimal RFC 6455 WebSocket server using only Node's standard library,
// keeping the project dependency-free like the client. Supports what the
// game needs: text/binary frames, ping/pong, close codes, payload limits.
// Fragmented messages are rejected (browsers don't fragment small JSON).

const http = require('node:http');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3;

class Socket extends EventEmitter {
  constructor(sock, maxPayload, ip) {
    super();
    this.sock = sock;
    this.ip = ip;
    this.lastSeen = Date.now(); // any inbound bytes (messages, pongs) count as alive
    this.maxPayload = maxPayload;
    this.readyState = OPEN;
    this.OPEN = OPEN;
    this.buf = Buffer.alloc(0);
    this.closeCode = 1006;
    sock.setNoDelay(true);
    sock.on('data', (d) => this._data(d));
    // http.Server sockets allow half-open connections; when the client's side
    // ends (FIN), finish ours too or the socket and player linger forever.
    sock.on('end', () => sock.destroy());
    sock.on('close', () => this._finish());
    sock.on('error', (e) => this.emit('error', e));
  }

  _data(chunk) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.readyState !== CLOSED) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0, rsv = b[0] & 0x70, op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (b.length < 10) return;
        const big = b.readBigUInt64BE(2);
        if (big > BigInt(this.maxPayload)) return this._fail(1009, 'too big');
        len = Number(big); off = 10;
      }
      if (rsv) return this._fail(1002, 'reserved bits');
      if (!masked) return this._fail(1002, 'client frames must be masked');
      if (len > this.maxPayload) return this._fail(1009, 'too big');
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);

      if (op === 0x8) {
        const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
        this.closeCode = code;
        if (this.readyState === OPEN) this._frame(0x8, payload.subarray(0, 2));
        this.readyState = CLOSING;
        this.sock.end();
        return;
      }
      if (op === 0x9) { this._frame(0xA, payload); continue; }
      if (op === 0xA) continue;
      if (!fin || op === 0x0) return this._fail(1003, 'fragmented frames unsupported');
      if (op !== 0x1 && op !== 0x2) return this._fail(1002, 'bad opcode');
      this.emit('message', payload, op === 0x2);
    }
  }

  _frame(op, payload) {
    if (this.sock.destroyed) return;
    const n = payload.length;
    const head = n < 126 ? Buffer.from([0x80 | op, n])
      : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
    this.sock.write(Buffer.concat([head, payload]));
  }

  send(text) {
    if (this.readyState !== OPEN) return;
    this._frame(0x1, Buffer.from(String(text), 'utf8'));
  }

  close(code = 1000, reason = '') {
    if (this.readyState !== OPEN) return;
    const r = Buffer.from(String(reason).slice(0, 120), 'utf8');
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0); r.copy(p, 2);
    this._frame(0x8, p);
    this.closeCode = code;
    this.readyState = CLOSING;
    this.sock.end();
    setTimeout(() => this.sock.destroy(), 1000).unref();
  }

  // Browsers answer pings automatically, so a silent socket is a dead one.
  ping() { if (this.readyState === OPEN) this._frame(0x9, Buffer.alloc(0)); }

  terminate() { this.sock.destroy(); this._finish(); }

  _fail(code, reason) { this.close(code, reason); }

  _finish() {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.emit('close', this.closeCode);
  }
}

class WebSocketServer extends EventEmitter {
  // allowUpgrade(req) may return null to accept, or [httpStatus, reason] to refuse
  // before the handshake (origin checks, connection limits).
  constructor({ port = 0, host = '127.0.0.1', maxPayload = 2048, server, onRequest, allowUpgrade, clientIp } = {}) {
    super();
    this.clients = new Set();
    this.http = server || http.createServer(onRequest || ((req, res) => {
      res.writeHead(426, { 'content-type': 'text/plain' });
      res.end('Nightshift City Online game server: connect with WebSocket.\n');
    }));
    this.http.on('upgrade', (req, sock) => {
      const key = req.headers['sec-websocket-key'];
      if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
        sock.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      const refusal = allowUpgrade ? allowUpgrade(req) : null;
      if (refusal) {
        sock.end(`HTTP/1.1 ${refusal[0]} ${refusal[1]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
        return;
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
        + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const ws = new Socket(sock, maxPayload, clientIp ? clientIp(req) : req.socket.remoteAddress);
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      this.emit('connection', ws, req);
    });
    if (!server) this.http.listen(port, host, () => this.emit('listening'));
  }

  address() { return this.http.address(); }

  close(cb) {
    for (const ws of this.clients) ws.terminate();
    this.http.close(() => cb && cb());
  }
}

module.exports = { WebSocketServer, CONNECTING, OPEN, CLOSING, CLOSED };
