import express from 'express';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';

const app = express();

// Lets the web build of the app call the API from another origin.
// Auth uses a Bearer header (no cookies), so '*' is fine for development;
// set CORS_ORIGIN to your real web domain in production.
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '20kb' }));

const dataDir = new URL('../data/', import.meta.url);
const dataPath = new URL('../data/solearn.sqlite', import.meta.url);
if (!existsSync(dataDir)) mkdirSync(dataDir);

const db = new DatabaseSync(dataPath.pathname.replace(/^\/([A-Z]:)/, '$1'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    referral_code TEXT UNIQUE,
    referred_by INTEGER REFERENCES users(id),
    points INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_reward_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options TEXT NOT NULL,
    answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 10
  );
  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, kind, source_id)
  );
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    points INTEGER NOT NULL,
    method TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const questions = [
  ['math-1', 'Mathematics', 'What is 12 × 8?', ['96', '86', '108', '72'], '96', 10],
  ['science-1', 'Science', 'Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 'Mars', 10],
  ['english-1', 'English', 'Choose the synonym of “rapid”.', ['Slow', 'Quick', 'Heavy', 'Quiet'], 'Quick', 10],
];
const insertQuestion = db.prepare('INSERT OR IGNORE INTO questions (id, subject, prompt, options, answer, points) VALUES (?, ?, ?, ?, ?, ?)');
for (const q of questions) insertQuestion.run(q[0], q[1], q[2], JSON.stringify(q[3]), q[4], q[5]);

// The default secret is public (it is in this repo), so anyone could forge a
// login token with it. Refuse to start in production without a real secret.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
}
const jwtSecret = process.env.JWT_SECRET || 'development-only-change-me';
const sign = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};
const verify = (token) => {
  const parts = token?.split('.');
  if (parts?.length !== 2) return null;
  const expected = crypto.createHmac('sha256', jwtSecret).update(parts[0]).digest('base64url');
  const given = Buffer.from(parts[1], 'base64url');
  const wanted = Buffer.from(expected, 'base64url');
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try { return JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch { return null; }
};

function hashPassword(password, salt = crypto.randomBytes(16)) {
  return `${salt.toString('hex')}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function passwordMatches(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
  const expected = Buffer.from(hashHex, 'hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), expected);
}
const referralCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const payload = verify(token);
  if (!payload?.userId) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!req.user) return res.status(401).json({ error: 'Account not found.' });
  next();
};
const publicUser = (user) => ({
  id: user.id, name: user.name, email: user.email, referralCode: user.referral_code,
  points: user.points, streak: user.streak,
  // Lets the app disable the daily-reward button without guessing.
  claimedToday: user.last_reward_date === utcDate(),
});
const utcDate = () => new Date().toISOString().slice(0, 10);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/auth/register', (req, res) => {
  const { name, email, password, referralCode: code } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '') || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Use a valid email and a password of at least 8 characters.' });
  }
  const normalizedEmail = email.toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
    return res.status(409).json({ error: 'An account already exists with this email.' });
  }
  const referrer = code ? db.prepare('SELECT * FROM users WHERE referral_code = ?').get(code.toUpperCase()) : null;
  let result;
  db.exec('BEGIN');
  try {
    result = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)')
      .run(name.trim(), normalizedEmail, hashPassword(password), referralCode(), referrer?.id ?? null);
    if (referrer) {
      db.prepare('UPDATE users SET points = points + 50 WHERE id = ?').run(referrer.id);
      db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)').run(referrer.id, 'referral', String(result.lastInsertRowid), 50);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Could not create account.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: sign({ userId: user.id }), user: publicUser(user) });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email ?? '').toLowerCase());
  if (!user || typeof password !== 'string' || !passwordMatches(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: sign({ userId: user.id }), user: publicUser(user) });
});

app.get('/me', auth, (req, res) => {
  // Totals for the wallet screen, computed from the ledger rather than stored.
  const sumFor = (table) => db.prepare(`SELECT COALESCE(SUM(points), 0) AS total FROM ${table} WHERE user_id = ?`).get(req.user.id).total;
  res.json({
    user: { ...publicUser(req.user), lifetimeEarned: sumFor('rewards'), withdrawn: sumFor('withdrawals') },
  });
});
app.get('/questions', auth, (_req, res) => {
  const rows = db.prepare('SELECT id, subject, prompt, options FROM questions ORDER BY id').all();
  res.json({ questions: rows.map((q) => ({ ...q, options: JSON.parse(q.options) })) });
});

app.post('/questions/:id/answer', auth, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Question not found.' });
  if (req.body?.answer !== question.answer) {
    return res.json({ correct: false, pointsAwarded: 0 });
  }
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'question', question.id, question.points);
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(question.points, req.user.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error?.message?.includes('UNIQUE')) return res.json({ correct: true, pointsAwarded: 0, alreadyCompleted: true });
    return res.status(500).json({ error: 'Could not save answer.' });
  }
  res.json({ correct: true, pointsAwarded: question.points });
});

app.post('/rewards/daily', auth, (req, res) => {
  const today = utcDate();
  if (req.user.last_reward_date === today) return res.status(409).json({ error: 'Daily reward already claimed.' });
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = req.user.last_reward_date === yesterday ? req.user.streak + 1 : 1;
  const points = Math.min(20 + (streak - 1) * 5, 50);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET points = points + ?, streak = ?, last_reward_date = ? WHERE id = ?').run(points, streak, today, req.user.id);
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)').run(req.user.id, 'daily', today, points);
    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
    return res.status(409).json({ error: 'Daily reward already claimed.' });
  }
  res.json({ pointsAwarded: points, streak });
});

app.post('/rewards/ad', auth, (req, res) => {
  const placementId = typeof req.body?.placementId === 'string' ? req.body.placementId.trim() : '';
  if (!placementId) return res.status(400).json({ error: 'Placement ID is required.' });
  try {
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'ad', placementId, 5);
    db.prepare('UPDATE users SET points = points + 5 WHERE id = ?').run(req.user.id);
  } catch (error) {
    if (error?.message?.includes('UNIQUE')) return res.status(409).json({ error: 'This ad reward was already claimed.' });
    return res.status(500).json({ error: 'Could not claim ad reward.' });
  }
  res.json({ pointsAwarded: 5 });
});

app.post('/withdrawals', auth, (req, res) => {
  const points = Number(req.body?.points);
  const method = typeof req.body?.method === 'string' ? req.body.method.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  if (!Number.isInteger(points) || points < 1000) return res.status(400).json({ error: 'Minimum withdrawal is 1000 points.' });
  if (!method || !details) return res.status(400).json({ error: 'Payment method and account details are required.' });
  if (req.user.points < points) return res.status(400).json({ error: 'Insufficient points.' });
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(points, req.user.id);
    db.prepare('INSERT INTO withdrawals (user_id, points, method, details) VALUES (?, ?, ?, ?)').run(req.user.id, points, method, details);
    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Could not create withdrawal.' });
  }
  res.status(201).json({ status: 'pending' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`SoLearn API listening on http://localhost:${port}`));
