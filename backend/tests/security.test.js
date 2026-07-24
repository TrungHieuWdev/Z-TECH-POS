import assert from 'node:assert/strict';
import test from 'node:test';
import csrfProtection from '../middleware/csrf.js';
import {
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  verifyTotp
} from '../security/totp.js';

test('TOTP secret survives authenticated encryption', () => {
  const secret = createTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptTotpSecret(encrypted), secret);
});

test('TOTP accepts current code and rejects malformed code', () => {
  const secret = createTotpSecret();
  assert.equal(verifyTotp(secret, generateTotpCode(secret)), true);
  assert.equal(verifyTotp(secret, '123'), false);
});

test('CSRF rejects a mutating request without double-submit token', () => {
  let status;
  let nextCalled = false;
  const req = {
    method: 'POST',
    path: '/api/orders',
    headers: {},
    get() { return ''; }
  };
  const res = {
    status(value) { status = value; return this; },
    json() { return this; }
  };
  csrfProtection(req, res, () => { nextCalled = true; });
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});

test('CSRF permits safe GET requests', () => {
  let nextCalled = false;
  csrfProtection({ method: 'GET', path: '/api/products' }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

