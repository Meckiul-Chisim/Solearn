import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return port;
}

test('accounts, earning, redemptions, and payout requests use server balances', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'solearn-api-'));
  const databasePath = join(directory, 'test.sqlite');
  const port = await findAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  let output = '';
  const server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: 'test-secret-with-more-than-thirty-two-characters',
      SOLEARN_DATABASE_PATH: databasePath,
      CORS_ORIGIN: 'http://localhost:8081',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { output += chunk.toString(); });
  server.stderr.on('data', (chunk) => { output += chunk.toString(); });

  t.after(async () => {
    if (server.exitCode === null) {
      server.kill();
      await once(server, 'exit');
    }
    await rm(directory, { recursive: true, force: true });
  });

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);
    try {
      const response = await fetch(`${origin}/health`, { signal: controller.signal });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      if (server.exitCode !== null) break;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  assert.equal(ready, true, `API server did not start (exit ${server.exitCode}): ${output}`);

  const call = async (path, { token, method = 'GET', body } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };

  const preflight = await fetch(`${origin}/me`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:8081' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:8081');

  const registration = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Student One', email: 'one@example.com', password: 'secure-password' },
  });
  assert.equal(registration.status, 201);
  assert.match(registration.data.user.referralCode, /^[A-F0-9]{8}$/);
  assert.equal(registration.data.user.points, 0);
  const token = registration.data.token;

  const invalidRegistration = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Student', email: 42, password: 'secure-password' },
  });
  assert.equal(invalidRegistration.status, 400);

  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: 'one@example.com', password: 'secure-password' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, registration.data.user.id);

  const questions = await call('/questions', { token });
  assert.equal(questions.status, 200);
  assert.equal(questions.data.questions.length, 3);
  assert.equal(questions.data.questions[0].points, 10);
  const questionId = questions.data.questions[0].id;
  const correctAnswer = {
    'english-1': 'Quick',
    'math-1': '96',
    'science-1': 'Mars',
  }[questionId];
  const wrongAnswer = await call(`/questions/${questionId}/answer`, {
    token,
    method: 'POST',
    body: { answer: 'incorrect' },
  });
  assert.equal(wrongAnswer.data.correct, false);
  const rightAnswer = await call(`/questions/${questionId}/answer`, {
    token,
    method: 'POST',
    body: { answer: correctAnswer },
  });
  assert.equal(rightAnswer.data.pointsAwarded, 10);
  const repeatedAnswer = await call(`/questions/${questionId}/answer`, {
    token,
    method: 'POST',
    body: { answer: correctAnswer },
  });
  assert.equal(repeatedAnswer.data.pointsAwarded, 0);
  assert.equal(repeatedAnswer.data.alreadyCompleted, true);

  const dailyReward = await call('/rewards/daily', { token, method: 'POST', body: {} });
  assert.equal(dailyReward.data.pointsAwarded, 20);
  assert.equal(dailyReward.data.streak, 1);
  assert.equal((await call('/rewards/daily', { token, method: 'POST', body: {} })).status, 409);

  const spin = await call('/rewards/spin', { token, method: 'POST', body: {} });
  assert.equal(spin.status, 200);
  assert.ok(spin.data.pointsAwarded >= 0);
  assert.ok(spin.data.outcomeIndex >= 0 && spin.data.outcomeIndex < 8);
  assert.equal((await call('/rewards/spin', { token, method: 'POST', body: {} })).status, 409);
  const adEndpoint = await fetch(`${origin}/rewards/ad`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ placementId: 'test' }),
  });
  assert.equal(adEndpoint.status, 404);

  const friend = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'Student Two',
      email: 'two@example.com',
      password: 'secure-password',
      referralCode: registration.data.user.referralCode,
    },
  });
  assert.equal(friend.status, 201);
  const inviter = await call('/me', { token });
  assert.ok(inviter.data.user.points >= 80);

  const products = await call('/products', { token });
  assert.equal(products.data.products.length, 6);
  const rejectedRedemption = await call('/redemptions', {
    token,
    method: 'POST',
    body: { productId: 'headphones', details: '45 Example Street, City' },
  });
  assert.equal(rejectedRedemption.status, 400);

  const database = new DatabaseSync(databasePath);
  database.prepare('UPDATE users SET points = 5000 WHERE id = ?').run(registration.data.user.id);
  database.close();
  const redemption = await call('/redemptions', {
    token,
    method: 'POST',
    body: { productId: 'bottle', details: '45 Example Street, City, 12345' },
  });
  assert.equal(redemption.status, 201);
  assert.equal(redemption.data.pointsDeducted, 1800);
  assert.equal(redemption.data.status, 'pending');

  const withdrawal = await call('/withdrawals', {
    token,
    method: 'POST',
    body: { points: 1000, method: 'UPI', details: 'student@bank' },
  });
  assert.equal(withdrawal.status, 201);
  assert.equal(withdrawal.data.status, 'pending');
  assert.equal((await call('/me', { token })).data.user.points, 2200);

  const activity = await call('/activity', { token });
  assert.equal(activity.status, 200);
  assert.equal(activity.data.activity.filter((item) => item.description.includes('Water Bottle')).length, 1);
});
