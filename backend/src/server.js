import express from 'express';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(express.json({ limit: '20kb' }));

const dbPath = process.env.SOLEARN_DATABASE_PATH
  ? resolve(process.env.SOLEARN_DATABASE_PATH)
  : fileURLToPath(new URL('../data/solearn.sqlite', import.meta.url));
if (!existsSync(dirname(dbPath))) mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
if (process.env.CORS_ORIGIN) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (process.env.CORS_ORIGIN === '*' || origin === process.env.CORS_ORIGIN)) {
      res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN === '*' ? '*' : origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}
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
  CREATE TABLE IF NOT EXISTS spins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    spin_date TEXT NOT NULL,
    outcome_index INTEGER NOT NULL,
    points INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, spin_date)
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
  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    points INTEGER NOT NULL,
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
const products = [
  { id: 'headphones', name: 'Wireless Noise-Cancelling Headphones', brand: 'SONY', points: 5500, tag: 'TECH', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85' },
  { id: 'watch', name: 'Apple Watch Series 10', brand: 'APPLE', points: 8900, tag: 'POPULAR', image: 'https://images.unsplash.com/photo-1557438159-51eec7a6c9e8?auto=format&fit=crop&w=900&q=85' },
  { id: 'speaker', name: 'Portable Bluetooth Speaker', brand: 'JBL', points: 3800, tag: 'AUDIO', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85' },
  { id: 'backpack', name: 'Classic Everyday Backpack', brand: 'JANSPORT', points: 2600, tag: 'EVERYDAY', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85' },
  { id: 'bottle', name: 'Vacuum Insulated Water Bottle', brand: 'STANLEY', points: 1800, tag: 'NEW', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85' },
  { id: 'keyboard', name: 'Mechanical Wireless Keyboard', brand: 'LOGITECH', points: 4200, tag: 'WORKSPACE', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85' },
];
const insertQuestion = db.prepare('INSERT OR IGNORE INTO questions (id, subject, prompt, options, answer, points) VALUES (?, ?, ?, ?, ?, ?)');
for (const q of questions) insertQuestion.run(q[0], q[1], q[2], JSON.stringify(q[3]), q[4], q[5]);

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
  points: user.points,
  streak: user.streak,
  lastRewardDate: user.last_reward_date,
  canClaimDaily: user.last_reward_date !== utcDate(),
  canSpin: !db.prepare('SELECT 1 FROM spins WHERE user_id = ? AND spin_date = ?')
    .get(user.id, utcDate())
    && !db.prepare('SELECT 1 FROM rewards WHERE user_id = ? AND kind = ? AND source_id = ?')
      .get(user.id, 'spin', utcDate()),
});
const utcDate = () => new Date().toISOString().slice(0, 10);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/auth/register', (req, res) => {
  const { name, email, password, referralCode: code } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8) {
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
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email ?? '').toLowerCase());
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
  if (req.user.last_reward_date === today) {
    const reward = db.prepare('SELECT points FROM rewards WHERE user_id = ? AND kind = ? AND source_id = ?')
      .get(req.user.id, 'daily', today);
    return res.json({ pointsAwarded: reward?.points ?? 0, streak: req.user.streak, alreadyClaimed: true });
  }
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

app.post('/rewards/spin', auth, (req, res) => {
  const today = utcDate();
  const outcomes = [
    { label: '10 pts', points: 10 },
    { label: '5 pts', points: 5 },
    { label: '25 pts', points: 25 },
    { label: 'Try again', points: 0 },
    { label: '50 pts', points: 50 },
    { label: '5 pts', points: 5 },
    { label: '20 pts', points: 20 },
    { label: 'Try again', points: 0 },
  ];
  const previousSpin = db.prepare('SELECT outcome_index, points FROM spins WHERE user_id = ? AND spin_date = ?')
    .get(req.user.id, today);
  if (previousSpin) {
    const outcome = outcomes[previousSpin.outcome_index];
    return res.json({
      ...outcome,
      outcomeIndex: previousSpin.outcome_index,
      pointsAwarded: previousSpin.points,
      alreadyPlayed: true,
    });
  }
  const outcomeIndex = crypto.randomInt(outcomes.length);
  const outcome = outcomes[outcomeIndex];
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO spins (user_id, spin_date, outcome_index, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, today, outcomeIndex, outcome.points);
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'spin', today, outcome.points);
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(outcome.points, req.user.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error?.message?.includes('UNIQUE')) {
      const previous = db.prepare('SELECT outcome_index, points FROM spins WHERE user_id = ? AND spin_date = ?')
        .get(req.user.id, today);
      if (previous) {
        const previousOutcome = outcomes[previous.outcome_index];
        return res.json({
          ...previousOutcome,
          outcomeIndex: previous.outcome_index,
          pointsAwarded: previous.points,
          alreadyPlayed: true,
        });
      }
      return res.status(409).json({ error: 'Your daily spin has already been used.' });
    }
    return res.status(500).json({ error: 'Could not save your spin.' });
  }
  res.json({ ...outcome, outcomeIndex, pointsAwarded: outcome.points, alreadyPlayed: false });
});

app.get('/products', auth, (_req, res) => res.json({ products }));

app.post('/redemptions', auth, (req, res) => {
  const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  const product = products.find((item) => item.id === productId);
  if (!product) return res.status(404).json({ error: 'Reward not found.' });
  if (details.length < 10 || details.length > 1000) {
    return res.status(400).json({ error: 'Enter delivery details between 10 and 1000 characters.' });
  }
  if (req.user.points < product.points) return res.status(400).json({ error: 'You do not have enough points for this reward.' });

  db.exec('BEGIN');
  try {
    const result = db.prepare(
      'INSERT INTO redemptions (user_id, product_id, product_name, points, details) VALUES (?, ?, ?, ?, ?)',
    ).run(req.user.id, product.id, product.name, product.points, details);
    db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(product.points, req.user.id);
    db.prepare('INSERT INTO rewards (user_id, kind, source_id, points) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'redemption', String(result.lastInsertRowid), -product.points);
    db.exec('COMMIT');
    return res.status(201).json({
      id: Number(result.lastInsertRowid),
      status: 'pending',
      pointsDeducted: product.points,
      balance: req.user.points - product.points,
    });
  } catch {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Could not submit your redemption.' });
  }
});

app.get('/activity', auth, (req, res) => {
  const activity = db.prepare(`
    SELECT kind AS type, kind AS description, points, created_at AS createdAt
    FROM rewards WHERE user_id = ? AND kind != 'redemption'
    UNION ALL
    SELECT 'redemption', 'Redeemed ' || product_name, -points, created_at
    FROM redemptions WHERE user_id = ?
    UNION ALL
    SELECT 'withdrawal', 'Withdrawal request (' || method || ')', -points, created_at
    FROM withdrawals WHERE user_id = ?
    ORDER BY createdAt DESC LIMIT 30
  `).all(req.user.id, req.user.id, req.user.id);
  res.json({ activity });
});

app.post('/withdrawals', auth, (req, res) => {
  const points = Number(req.body?.points);
  const method = typeof req.body?.method === 'string' ? req.body.method.trim() : '';
  const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
  if (!Number.isInteger(points) || points < 1000) return res.status(400).json({ error: 'Minimum withdrawal is 1000 points.' });
  if (!['UPI', 'Gift card'].includes(method)) return res.status(400).json({ error: 'Choose a supported payout method.' });
  if (details.length < 3 || details.length > 200) return res.status(400).json({ error: 'Enter valid payment details.' });
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
