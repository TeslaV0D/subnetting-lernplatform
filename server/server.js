const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');
const crypto  = require('crypto');

const app           = express();
const DATA_DIR      = path.join(__dirname, 'data');
const RESULTS_FILE  = path.join(DATA_DIR, 'results.json');
const QUESTIONS_FILE= path.join(DATA_DIR, 'questions.json');

const ADMIN_PASS    = process.env.ADMIN_PASS || 'admin123';
const SESSION_SECRET= process.env.SESSION_SECRET || ADMIN_PASS + ':sn-secret';
const TOKEN_TTL_MS  = 60 * 60 * 1000; // 1 Stunde

// ─── DATEISYSTEM VORBEREITEN ───────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, '[]', 'utf8');

app.use(cors());
app.use(express.json({ limit: '4mb' }));

// kleiner Request-Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── HILFSFUNKTIONEN: JSON LESEN/SCHREIBEN ─────────────────
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
const readResults   = () => readJson(RESULTS_FILE, []);
const writeResults  = (d) => writeJson(RESULTS_FILE, d);
const readQuestions = () => readJson(QUESTIONS_FILE, []);
const writeQuestions= (d) => writeJson(QUESTIONS_FILE, d);

// ─── AUTH: TOKEN + MIDDLEWARE ──────────────────────────────
function makeToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `admin.${exp}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}
function verifyToken(tok) {
  try {
    const dec = Buffer.from(tok, 'base64url').toString('utf8');
    const [role, exp, sig] = dec.split('.');
    if (role !== 'admin' || !exp || !sig) return false;
    if (Date.now() > Number(exp)) return false;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${role}.${exp}`).digest('hex');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
// akzeptiert Bearer-Token ODER x-admin-pass Header (Abwärtskompatibilität)
function requireAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'];
  const auth = req.headers['authorization'] || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (pass && pass === ADMIN_PASS) return next();
  if (bearer && verifyToken(bearer)) return next();
  return res.status(401).json({ error: 'Nicht autorisiert' });
}

// ─── LOGIN ─────────────────────────────────────────────────
// POST /api/admin/login  – Passwort prüfen, Token zurückgeben
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Falscher Benutzername oder Passwort' });
  }
  res.json({ ok: true, token: makeToken(), expiresIn: TOKEN_TTL_MS / 1000 });
});

// ═══════════════════════════════════════════════════════════
//  FRAGEN-VALIDIERUNG & NORMALISIERUNG
// ═══════════════════════════════════════════════════════════
const VALID_TYPES = ['mc', 'freetext', 'order'];

function validateQuestion(q) {
  if (!q || typeof q !== 'object') return 'Ungültiges Datenformat';
  if (typeof q.text !== 'string' || q.text.trim().length < 10)
    return 'Fragetext muss mindestens 10 Zeichen lang sein';
  if (!VALID_TYPES.includes(q.type))
    return `Fragetyp muss einer von ${VALID_TYPES.join(', ')} sein`;

  if (q.type === 'mc') {
    if (typeof q.correct !== 'string' || !q.correct.trim())
      return 'Multiple Choice: richtige Antwort erforderlich';
    const wrong = Array.isArray(q.wrong) ? q.wrong.filter(w => String(w).trim()) : [];
    if (wrong.length < 1)
      return 'Multiple Choice: mindestens eine falsche Antwort erforderlich';
  } else if (q.type === 'freetext') {
    if (typeof q.correct !== 'string' || !q.correct.trim())
      return 'Freitext: richtige Antwort erforderlich';
  } else if (q.type === 'order') {
    const items = Array.isArray(q.orderItems) ? q.orderItems.filter(i => String(i).trim()) : [];
    if (items.length < 2)
      return 'Reihenfolge: mindestens 2 Elemente erforderlich';
  }
  if (q.difficulty !== undefined) {
    const d = Number(q.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5)
      return 'Schwierigkeit muss zwischen 1 und 5 liegen';
  }
  return null; // valid
}

// vereinheitlicht eine Frage in das Speicherschema
function normalizeQuestion(q, existing) {
  const now = Date.now();
  const type = q.type;
  const out = {
    id:         existing?.id || `q-${crypto.randomUUID()}`,
    type,
    text:       String(q.text).trim(),
    category:   (q.category && String(q.category).trim()) || 'Allgemein',
    difficulty: q.difficulty ? Number(q.difficulty) : (existing?.difficulty || 2),
    ip:         q.ip ? String(q.ip).trim() : '',
    correct:    '',
    wrong:      [],
    orderItems: [],
    explain:    q.explain ? String(q.explain).trim() : '',
    author:     q.author || existing?.author || 'admin',
    createdAt:  existing?.createdAt || now,
    updatedAt:  now
  };
  if (type === 'mc') {
    out.correct = String(q.correct).trim();
    out.wrong   = (q.wrong || []).map(w => String(w).trim()).filter(Boolean);
  } else if (type === 'freetext') {
    out.correct = String(q.correct).trim();
    out.caseSensitive = !!q.caseSensitive;
  } else if (type === 'order') {
    out.orderItems = (q.orderItems || []).map(i => String(i).trim()).filter(Boolean);
  }
  return out;
}

// ─── MIGRATION: DEFAULT-FRAGEN beim ersten Start anlegen ────
const SEED_QUESTIONS = [
  { type:'mc', category:'CIDR', difficulty:1, text:'Was ist die CIDR-Präfixlänge der Subnetzmaske:', ip:'255.255.255.0', correct:'/24', wrong:['/25','/16','/8'], explain:'255.255.255.0 hat 24 aufeinanderfolgende Einsen in Binär → /24' },
  { type:'freetext', category:'Hosts', difficulty:2, text:'Wie viele nutzbare Hosts gibt es im Netz (nur Zahl eingeben):', ip:'192.168.1.0/25', correct:'126', explain:'2^(32-25) – 2 = 2^7 – 2 = 128 – 2 = 126 Hosts' },
  { type:'mc', category:'Broadcast', difficulty:2, text:'Was ist die Broadcast-Adresse von:', ip:'192.168.5.64/26', correct:'192.168.5.127', wrong:['192.168.5.128','192.168.5.63','192.168.5.255'], explain:'Blockgröße=64, Netzadresse=.64, Broadcast=64+64–1=.127' },
  { type:'freetext', category:'Subnetzmaske', difficulty:2, text:'Welche Subnetzmaske gehört zur Präfixlänge /26? (z. B. 255.255.255.x)', ip:'', correct:'255.255.255.192', explain:'Blockgröße=2^6=64, Maske=256–64=192 → 255.255.255.192' },
  { type:'mc', category:'Subnetting', difficulty:3, text:'Zu welchem Subnetz gehört die IP:', ip:'172.16.45.200/20', correct:'172.16.32.0/20', wrong:['172.16.45.0/20','172.16.48.0/20','172.16.0.0/20'], explain:'Blockgröße=/20→2^12=4096. Im 3. Oktett: Vielfaches von 16 ≤ 45 ist 32 → 172.16.32.0' },
  { type:'freetext', category:'Subnetting', difficulty:2, text:'Wie viele Subnetze entstehen, wenn /24 in /27 aufgeteilt wird? (nur Zahl)', ip:'', correct:'8', explain:'Zusätzliche Bits: 27–24=3 → 2^3=8 Subnetze' },
  { type:'order', category:'Subnetting', difficulty:3, text:'Bringe die Schritte zum Subnetting in die richtige Reihenfolge:', ip:'', explain:'Die korrekte Reihenfolge: Host-Bits → Blockgröße → nutzbare Hosts → Subnetzmaske berechnen.', orderItems:['Host-Bits berechnen (32 – Präfix)','Blockgröße ermitteln (2^Host-Bits)','Nutzbare Hosts berechnen (Blockgröße – 2)','Subnetzmaske berechnen (256 – Blockgröße)'] },
  { type:'mc', category:'Hosts', difficulty:3, text:'Was ist der nutzbare Hostbereich von:', ip:'192.168.0.0/29', correct:'192.168.0.1 – 192.168.0.6', wrong:['192.168.0.0 – 192.168.0.7','192.168.0.1 – 192.168.0.7','192.168.0.0 – 192.168.0.6'], explain:'Blockgröße=8, Netz=.0, Broadcast=.7 → Hosts: .1–.6' },
  { type:'freetext', category:'Netzadresse', difficulty:3, text:'Was ist die Netzadresse von 10.10.10.130/25? (IP-Adresse eingeben)', ip:'', correct:'10.10.10.128', explain:'Blockgröße=128. Vielfaches von 128 ≤ 130: 128 → Netzadresse ist 10.10.10.128' },
  { type:'mc', category:'RFC 1918', difficulty:2, text:'Welcher private IPv4-Bereich gehört laut RFC 1918 zu Klasse B?', ip:'', correct:'172.16.0.0 – 172.31.255.255', wrong:['10.0.0.0 – 10.255.255.255','192.168.0.0 – 192.168.255.255','172.0.0.0 – 172.255.255.255'], explain:'RFC 1918 Klasse B: 172.16.0.0 bis 172.31.255.255 (/12)' },
  { type:'mc', category:'CIDR', difficulty:3, text:'Welche Präfixlänge ist für ein Punkt-zu-Punkt-Netz (genau 2 Hosts) am besten geeignet?', ip:'', correct:'/30', wrong:['/29','/31','/28'], explain:'/30 → 2^2–2=2 Hosts. /29 verschwendet Adressen, /31 hat keine Netz/Broadcast-Adresse (Sonderfall RFC 3021)' }
];

function seedQuestionsIfEmpty() {
  let current = [];
  if (fs.existsSync(QUESTIONS_FILE)) current = readQuestions();
  if (!Array.isArray(current) || current.length === 0) {
    const seeded = SEED_QUESTIONS.map(q => normalizeQuestion(q));
    writeQuestions(seeded);
    console.log(`[seed] ${seeded.length} Standardfragen nach questions.json geschrieben`);
  }
}
seedQuestionsIfEmpty();

// ─── STATISTIK: Fehlerquoten aus results.json ableiten ─────
// In diesem Test werden immer ALLE Fragen genau einmal beantwortet,
// daher gilt: Versuche pro Frage ≈ Anzahl Testergebnisse.
function computeStats(questions, results) {
  const errMap = {};
  results.forEach(r => {
    (r.wrong || []).forEach(w => {
      if (w && w.q) errMap[w.q] = (errMap[w.q] || 0) + 1;
    });
  });
  const attempts = results.length;
  return questions.map(q => {
    const ident = q.text + (q.ip ? ` (${q.ip})` : '');
    const errors = errMap[ident] || 0;
    return {
      ...q,
      stats: {
        attempted: attempts,
        errors,
        correct: Math.max(0, attempts - errors),
        errorRate: attempts ? errors / attempts : 0
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════
//  RESULTS API (bestehend, Auth auf Middleware umgestellt)
// ═══════════════════════════════════════════════════════════
app.post('/api/results', (req, res) => {
  const { name, score, correct, total, duration, wrong, answers } = req.body;
  if (!name || score === undefined) return res.status(400).json({ error: 'name + score required' });
  const entry = {
    id:       Date.now(),
    name:     String(name).trim().substring(0, 80),
    time:     new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
    score, correct, total,
    duration: duration || null,
    passed:   score >= 60,
    wrong:    wrong   || [],
    answers:  answers || []
  };
  const all = readResults();
  all.unshift(entry);
  writeResults(all);
  res.json({ ok: true, id: entry.id });
});

app.get('/api/results', requireAdmin, (_req, res) => res.json(readResults()));

app.delete('/api/results', requireAdmin, (_req, res) => { writeResults([]); res.json({ ok: true }); });

app.get('/api/results/export', requireAdmin, (_req, res) => {
  const data = readResults();
  res.setHeader('Content-Disposition', 'attachment; filename="subnetting-results.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

// ═══════════════════════════════════════════════════════════
//  QUESTIONS API (NEU)
// ═══════════════════════════════════════════════════════════

// GET /api/questions/public – für den Schüler-Test (ohne Auth, ohne Statistik)
app.get('/api/questions/public', (_req, res) => {
  const qs = readQuestions().map(({ stats, author, ...rest }) => rest);
  res.json(qs);
});

// GET /api/questions/export – Admin: JSON-Download  (VOR :id definieren!)
app.get('/api/questions/export', requireAdmin, (_req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    questions: readQuestions()
  };
  res.setHeader('Content-Disposition', 'attachment; filename="subnetting-questions.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload, null, 2));
});

// POST /api/questions/import – Admin: Fragen importieren
// Body: { questions:[...], mode:'skip'|'overwrite'|'merge' }
app.post('/api/questions/import', requireAdmin, (req, res) => {
  try {
    const body = req.body || {};
    const incoming = Array.isArray(body) ? body : (body.questions || []);
    const mode = body.mode || 'skip';
    if (!Array.isArray(incoming) || incoming.length === 0)
      return res.status(400).json({ error: 'Keine Fragen zum Importieren gefunden' });

    const current = readQuestions();
    const byText = new Map(current.map(q => [q.text.trim().toLowerCase(), q]));
    const report = { added: 0, updated: 0, skipped: 0, errors: [] };

    incoming.forEach((raw, idx) => {
      const err = validateQuestion(raw);
      if (err) { report.errors.push({ row: idx + 1, error: err }); return; }
      const key = String(raw.text).trim().toLowerCase();
      const existing = byText.get(key);
      if (existing) {
        if (mode === 'overwrite' || mode === 'merge') {
          const merged = normalizeQuestion(raw, existing);
          const i = current.findIndex(q => q.id === existing.id);
          current[i] = merged;
          byText.set(key, merged);
          report.updated++;
        } else {
          report.skipped++;
        }
      } else {
        const nq = normalizeQuestion(raw);
        current.push(nq);
        byText.set(key, nq);
        report.added++;
      }
    });

    writeQuestions(current);
    res.json({ ok: true, ...report, total: current.length });
  } catch (e) {
    console.error('Import-Fehler:', e);
    res.status(500).json({ error: 'Import fehlgeschlagen' });
  }
});

// POST /api/questions/bulk-delete – Admin: mehrere löschen  Body: { ids:[...] }
app.post('/api/questions/bulk-delete', requireAdmin, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Keine IDs angegeben' });
  const current = readQuestions();
  const set = new Set(ids);
  const remaining = current.filter(q => !set.has(q.id));
  const removed = current.length - remaining.length;
  writeQuestions(remaining);
  res.json({ ok: true, removed, total: remaining.length });
});

// POST /api/questions/bulk-update – Admin: Kategorie/Schwierigkeit für mehrere setzen
// Body: { ids:[...], patch:{ category?, difficulty? } }
app.post('/api/questions/bulk-update', requireAdmin, (req, res) => {
  const { ids, patch } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0 || !patch || typeof patch !== 'object')
    return res.status(400).json({ error: 'ids und patch erforderlich' });
  if (patch.difficulty !== undefined) {
    const d = Number(patch.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5)
      return res.status(400).json({ error: 'Schwierigkeit muss 1–5 sein' });
  }
  const current = readQuestions();
  const set = new Set(ids);
  let updated = 0;
  current.forEach(q => {
    if (set.has(q.id)) {
      if (patch.category !== undefined && String(patch.category).trim())
        q.category = String(patch.category).trim();
      if (patch.difficulty !== undefined)
        q.difficulty = Number(patch.difficulty);
      q.updatedAt = Date.now();
      updated++;
    }
  });
  writeQuestions(current);
  res.json({ ok: true, updated, total: current.length });
});

// GET /api/questions – Admin: alle Fragen inkl. abgeleiteter Statistik
app.get('/api/questions', requireAdmin, (_req, res) => {
  const withStats = computeStats(readQuestions(), readResults());
  res.json(withStats);
});

// GET /api/questions/stats/:id – Admin: Statistik für eine Frage
app.get('/api/questions/stats/:id', requireAdmin, (req, res) => {
  const withStats = computeStats(readQuestions(), readResults());
  const q = withStats.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Frage nicht gefunden' });
  res.json(q.stats);
});

// POST /api/questions – Admin: neue Frage
app.post('/api/questions', requireAdmin, (req, res) => {
  const err = validateQuestion(req.body);
  if (err) return res.status(400).json({ error: err });
  const all = readQuestions();
  const nq = normalizeQuestion(req.body);
  all.push(nq);
  writeQuestions(all);
  res.status(201).json(nq);
});

// PUT /api/questions/:id – Admin: Frage bearbeiten
app.put('/api/questions/:id', requireAdmin, (req, res) => {
  const err = validateQuestion(req.body);
  if (err) return res.status(400).json({ error: err });
  const all = readQuestions();
  const i = all.findIndex(q => q.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Frage nicht gefunden' });
  all[i] = normalizeQuestion(req.body, all[i]);
  writeQuestions(all);
  res.json(all[i]);
});

// DELETE /api/questions/:id – Admin: Frage löschen
app.delete('/api/questions/:id', requireAdmin, (req, res) => {
  const all = readQuestions();
  const i = all.findIndex(q => q.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Frage nicht gefunden' });
  const [removed] = all.splice(i, 1);
  writeQuestions(all);
  res.json({ ok: true, id: removed.id });
});

// ─── 404 + Fehler-Handler ──────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint nicht gefunden' }));
app.use((err, _req, res, _next) => {
  console.error('Server-Fehler:', err);
  res.status(500).json({ error: 'Interner Server-Fehler' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
