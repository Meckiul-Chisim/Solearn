import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'solearn-api-test-'));
process.env.DATABASE_PATH = join(temporaryDirectory, 'test.sqlite');
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_API_KEY = 'test-admin-secret';

let app;
let db;
let server;
let baseUrl;

before(async () => {
  ({ app, db } = await import('../src/server.js'));
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  db?.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function request(path, { token, adminKey, body, method = 'GET' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['x-admin-key'] = adminKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}

test('earnings, redemptions, and admin review use the points ledger', async () => {
  const registration = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Test Learner', email: 'learner@example.com', password: 'secure-password' },
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.data.user.canClaimDaily, true);
  assert.equal(registration.data.user.canSpin, true);
  const token = registration.data.token;

  const wrongAnswer = await request('/questions/math-1/answer', {
    method: 'POST',
    token,
    body: { answer: '86' },
  });
  assert.equal(wrongAnswer.status, 200);
  assert.equal(wrongAnswer.data.pointsAwarded, 0);

  const correctAnswer = await request('/questions/math-1/answer', {
    method: 'POST',
    token,
    body: { answer: '96' },
  });
  assert.equal(correctAnswer.data.pointsAwarded, 10);
  const repeatedAnswer = await request('/questions/math-1/answer', {
    method: 'POST',
    token,
    body: { answer: '96' },
  });
  assert.equal(repeatedAnswer.data.alreadyCompleted, true);
  assert.equal(repeatedAnswer.data.pointsAwarded, 0);

  const dailyReward = await request('/rewards/daily', { method: 'POST', token, body: {} });
  assert.equal(dailyReward.data.pointsAwarded, 20);
  assert.equal((await request('/rewards/daily', { method: 'POST', token, body: {} })).status, 409);

  const spin = await request('/rewards/spin', { method: 'POST', token, body: {} });
  assert.equal(spin.status, 200);
  assert.ok(spin.data.outcomeIndex >= 0 && spin.data.outcomeIndex < 8);
  assert.equal((await request('/rewards/spin', { method: 'POST', token, body: {} })).status, 409);
  assert.equal((await request('/me', { token })).data.user.canSpin, false);

  const userId = registration.data.user.id;
  db.prepare("UPDATE rewards SET created_at = datetime('now', '-25 hours') WHERE user_id = ? AND kind = 'spin'").run(userId);
  assert.equal((await request('/me', { token })).data.user.canSpin, true);
  const resetSpin = await request('/rewards/spin', { method: 'POST', token, body: {} });
  assert.equal(resetSpin.status, 200);
  assert.equal((await request('/me', { token })).data.user.canSpin, false);

  db.prepare('UPDATE users SET points = 5000 WHERE id = ?').run(userId);

  const invalidMethod = await request('/withdrawals', {
    method: 'POST', token, body: { points: 1000, method: 'anything', details: 'value' },
  });
  assert.equal(invalidMethod.status, 400);
  const invalidUpi = await request('/withdrawals', {
    method: 'POST', token, body: { points: 1000, method: 'UPI', details: 'not-an-upi' },
  });
  assert.equal(invalidUpi.status, 400);
  const insufficient = await request('/withdrawals', {
    method: 'POST', token, body: { points: 6000, method: 'UPI', details: 'learner@bank' },
  });
  assert.equal(insufficient.status, 400);
  assert.equal(db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points, 5000);

  const upiRequest = await request('/withdrawals', {
    method: 'POST',
    token,
    body: { points: 1200, method: 'UPI', details: 'learner@bank' },
  });
  assert.equal(upiRequest.status, 201);
  assert.equal(upiRequest.data.pointsDeducted, 1200);
  assert.equal(db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points, 3800);
  assert.equal((await request('/admin/withdrawals')).status, 401);

  const history = await request('/activity', { token });
  const debit = history.data.activity.find((item) => item.type === 'withdrawal');
  assert.equal(debit.points, -1200);
  assert.equal(debit.status, 'pending');
  assert.equal(debit.method, 'UPI');

  const rejected = await request(`/admin/withdrawals/${upiRequest.data.id}/review`, {
    method: 'POST',
    adminKey: process.env.ADMIN_API_KEY,
    body: { action: 'reject', note: 'Test refund' },
  });
  assert.equal(rejected.data.status, 'rejected');
  assert.equal(db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points, 5000);
  assert.equal((await request(`/admin/withdrawals/${upiRequest.data.id}/review`, {
    method: 'POST',
    adminKey: process.env.ADMIN_API_KEY,
    body: { action: 'reject' },
  })).status, 409);

  const giftCardRequest = await request('/withdrawals', {
    method: 'POST',
    token,
    body: { points: 1000, method: 'Gift card', details: 'learner@example.com' },
  });
  assert.equal(giftCardRequest.status, 201);
  const completed = await request(`/admin/withdrawals/${giftCardRequest.data.id}/review`, {
    method: 'POST',
    adminKey: process.env.ADMIN_API_KEY,
    body: { action: 'complete', note: 'Fulfilled manually' },
  });
  assert.equal(completed.data.status, 'completed');
  assert.equal(db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points, 4000);

  const finalHistory = await request('/activity', { token });
  assert.ok(finalHistory.data.activity.some((item) => item.type === 'withdrawal_refund' && item.points === 1200));
  assert.ok(finalHistory.data.activity.some((item) => item.type === 'withdrawal' && item.status === 'completed'));
});
