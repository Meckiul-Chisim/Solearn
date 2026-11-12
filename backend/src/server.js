import express from 'express';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const dataPath = process.env.DATABASE_PATH
  ?? fileURLToPath(new URL('../data/solearn.sqlite', import.meta.url));
mkdirSync(dirname(dataPath), { recursive: true });

const db = new DatabaseSync(dataPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
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
  CREATE TABLE IF NOT EXISTS points_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, kind, source_id)
  );
`);

const withdrawalColumns = new Set(
  db.prepare('PRAGMA table_info(withdrawals)').all().map((column) => column.name),
);
if (!withdrawalColumns.has('reviewed_at')) db.exec('ALTER TABLE withdrawals ADD COLUMN reviewed_at TEXT');
if (!withdrawalColumns.has('review_note')) db.exec('ALTER TABLE withdrawals ADD COLUMN review_note TEXT');

db.exec(`
  INSERT OR IGNORE INTO points_ledger (user_id, kind, source_id, delta, created_at)
  SELECT user_id, kind, source_id, points, created_at FROM rewards;
  INSERT OR IGNORE INTO points_ledger (user_id, kind, source_id, delta, created_at)
  SELECT user_id, 'withdrawal', CAST(id AS TEXT), -points, created_at FROM withdrawals;
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
  lastRewardDate: user.last_reward_date,
  canClaimDaily: user.last_reward_date !== utcDate(),
  canSpin: !db.prepare(
    'SELECT 1 FROM rewards WHERE user_id = ? AND kind = ? AND source_id = ?',
  ).get(user.id, 'spin', utcDate()),
});
const utcDate = () => new Date().toISOString().slice(0, 10);
const insertLedgerEntry = db.prepare(
  'INSERT INTO points_ledger (user_id, kind, source_id, delta) VALUES (?, ?, ?, ?)',
);

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_API_KEY) {
  throw new Error('ADMIN_API_KEY must be set when NODE_ENV=production.');
}
const adminApiKey = process.env.ADMIN_API_KEY;
const adminAuth = (req, res, next) => {
  const supplied = req.get('x-admin-key') ?? '';
  const expected = adminApiKey ?? '';
  const givenBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (
    !adminApiKey
    || givenBytes.length !== expectedBytes.length
    || !crypto.timingSafeEqual(givenBytes, expectedBytes)
  ) {
    return res.status(401).json({ error: 'Admin authorization required.' });
  }
  next();
};

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/auth/register', (req, res) => {
  const { name, email, password, referralCode: code } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Use a valid email and a password of at least 8 characters.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
    return res.status(409).json({ error: 'An account already exists with this email.' });
  }
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const referrer = normalizedCode
    ? db.prepare('SELECT * FROM users WHERE referral_code = ?').get(normalizedCode)
    : null;
  let result;
  db.exec('BEGIN IMMEDIATE');
  try {
    result = db.prepare('INSERT INTO users (name, email, password_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)')
      .run(name.trim(), normalizedEmail, hashPassword(password), referralCode(), referrer?.id ?? null);
    if (referrer) {
      db.prepare('UPDATE users SET points = points + 50 WHERE id = ?').run(referrer.id);
      db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)').run(referrer.id, 'referral', String(result.lastInsertRowid), 50);
      insertLedgerEntry.run(referrer.id, 'referral', String(result.lastInsertRowid), 50);
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
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !passwordMatches(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: sign({ userId: user.id }), user: publicUser(user) });
});

app.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/questions', auth, (_req, res) => {
  const rows = db.prepare('SELECT id, subject, prompt, options, points FROM questions ORDER BY id').all();
  res.json({ questions: rows.map((q) => ({ ...q, options: JSON.parse(q.options) })) });
});

// The user's recent point history, including redemption statuses.
const activityLabels = {
  question: 'Quiz answer',
  daily: 'Daily reward',
  referral: 'Referral bonus',
  spin: 'Daily spin',
  ad: 'Ad reward',
  withdrawal: 'Redemption request',
  withdrawal_refund: 'Rejected request refund',
};
app.get('/activity', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.kind AS type, l.delta AS points, l.created_at AS createdAt,
      w.method AS method, w.status AS status
    FROM points_ledger l
    LEFT JOIN withdrawals w
      ON l.kind = 'withdrawal' AND CAST(l.source_id AS INTEGER) = w.id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC, l.id DESC
    LIMIT 20
  `).all(req.user.id);
  res.json({
    activity: rows.map((row) => ({
      ...row,
      description: row.type === 'withdrawal'
        ? `${row.method} ${activityLabels.withdrawal.toLowerCase()}`
        : activityLabels[row.type] ?? row.type,
    })),
  });
});

app.post('/questions/:id/answer', auth, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Question not found.' });
  if (req.body?.answer !== question.answer) {
    return res.json({ correct: false, pointsAwarded: 0 });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'question', question.id, question.points);
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(question.points, req.user.id);
    insertLedgerEntry.run(req.user.id, 'question', question.id, question.points);
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
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE users SET points = points + ?, streak = ?, last_reward_date = ? WHERE id = ?').run(points, streak, today, req.user.id);
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)').run(req.user.id, 'daily', today, points);
    insertLedgerEntry.run(req.user.id, 'daily', today, points);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error?.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Daily reward already claimed.' });
    }
    return res.status(500).json({ error: 'Could not save your daily reward.' });
  }
  res.json({ pointsAwarded: points, streak });
});

const spinOutcomes = [
  { label: '10 pts', pointsAwarded: 10 },
  { label: '5 pts', pointsAwarded: 5 },
  { label: '25 pts', pointsAwarded: 25 },
  { label: 'Try again', pointsAwarded: 0 },
  { label: '50 pts', pointsAwarded: 50 },
  { label: '5 pts', pointsAwarded: 5 },
  { label: '20 pts', pointsAwarded: 20 },
  { label: 'Try again', pointsAwarded: 0 },
];

app.post('/rewards/spin', auth, (req, res) => {
  const today = utcDate();
  const outcomeIndex = crypto.randomInt(spinOutcomes.length);
  const outcome = spinOutcomes[outcomeIndex];
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'spin', today, outcome.pointsAwarded);
    if (outcome.pointsAwarded > 0) {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
        .run(outcome.pointsAwarded, req.user.id);
    }
    insertLedgerEntry.run(req.user.id, 'spin', today, outcome.pointsAwarded);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error?.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Daily spin already used.' });
    }
    return res.status(500).json({ error: 'Could not save your spin.' });
  }
  res.json({ ...outcome, outcomeIndex });
});

app.post('/withdrawals', auth, (req, res) => {
  const points = req.body?.points;
  const method = req.body?.method;
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  if (!Number.isSafeInteger(points) || points < 1000) return res.status(400).json({ error: 'Minimum withdrawal is 1000 points.' });
  if (method !== 'UPI' && method !== 'Gift card') {
    return res.status(400).json({ error: 'Choose UPI or Gift card.' });
  }
  const validDestination = method === 'UPI'
    ? /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(details)
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details);
  if (!validDestination) {
    return res.status(400).json({
      error: method === 'UPI' ? 'Enter a valid UPI ID.' : 'Enter a valid email address for the gift card.',
    });
  }
  if (details.length > 254) return res.status(400).json({ error: 'Account details are too long.' });

  db.exec('BEGIN IMMEDIATE');
  try {
    const balanceUpdate = db.prepare(
      'UPDATE users SET points = points - ? WHERE id = ? AND points >= ?',
    ).run(points, req.user.id, points);
    if (balanceUpdate.changes === 0) {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient points.' });
    }
    const result = db.prepare(
      'INSERT INTO withdrawals (user_id, points, method, details) VALUES (?, ?, ?, ?)',
    ).run(req.user.id, points, method, details);
    const id = Number(result.lastInsertRowid);
    insertLedgerEntry.run(req.user.id, 'withdrawal', String(id), -points);
    db.exec('COMMIT');
    return res.status(201).json({ id, status: 'pending', pointsDeducted: points });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Could not create redemption request:', error);
    return res.status(500).json({ error: 'Could not create withdrawal.' });
  }
});

app.get('/admin/withdrawals', adminAuth, (_req, res) => {
  const withdrawals = db.prepare(`
    SELECT w.id, w.user_id AS userId, u.email, w.points, w.method, w.details,
      w.status, w.created_at AS createdAt, w.reviewed_at AS reviewedAt, w.review_note AS reviewNote
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    ORDER BY w.id DESC
    LIMIT 100
  `).all();
  res.json({ withdrawals });
});

app.post('/admin/withdrawals/:id/review', adminAuth, (req, res) => {
  const id = Number(req.params.id);
  const action = req.body?.action;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid request ID.' });
  if (action !== 'complete' && action !== 'reject') {
    return res.status(400).json({ error: 'Choose complete or reject.' });
  }
  if (note?.length > 500) return res.status(400).json({ error: 'Review note is too long.' });

  db.exec('BEGIN IMMEDIATE');
  try {
    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
    if (!withdrawal) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Redemption request not found.' });
    }
    if (withdrawal.status !== 'pending') {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'This request has already been reviewed.' });
    }

    const status = action === 'complete' ? 'completed' : 'rejected';
    const update = db.prepare(`
      UPDATE withdrawals SET status = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?
      WHERE id = ? AND status = 'pending'
    `).run(status, note, id);
    if (update.changes !== 1) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'This request has already been reviewed.' });
    }
    if (action === 'reject') {
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?')
        .run(withdrawal.points, withdrawal.user_id);
      insertLedgerEntry.run(withdrawal.user_id, 'withdrawal_refund', String(id), withdrawal.points);
    }
    db.exec('COMMIT');
    return res.json({ id, status });
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('Could not review redemption request:', error);
    return res.status(500).json({ error: 'Could not review redemption request.' });
  }
});

// Unknown routes get a JSON error like every other response, so the app can
// show a readable message instead of failing to parse an HTML error page.
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const port = Number(process.env.PORT) || 3000;
const server = isMain
  ? app.listen(port, () => console.log(`SoLearn API listening on port ${server.address().port}`))
  : null;

if (server) {
  process.on('SIGINT', () => server.close(() => db.close()));
  process.on('SIGTERM', () => server.close(() => db.close()));
}

export { app, db };
