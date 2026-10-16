import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLogin } from '../js/lib/validate.js';

test('accepts correct credentials, case-insensitive username', () => {
  assert.deepEqual(checkLogin('s', 'SI96305'), { ok: true, user: 'S' });
  assert.deepEqual(checkLogin('I', 'SI96305'), { ok: true, user: 'I' });
  assert.deepEqual(checkLogin('S ', 'SI96305'), { ok: true, user: 'S' });
});

test('rejects wrong password with a password error message', () => {
  const r = checkLogin('S', 'wrong');
  assert.equal(r.ok, false);
  assert.match(r.error, /password/i);
});

test('rejects unknown username with a username error message', () => {
  const r = checkLogin('Rahul', 'SI96305');
  assert.equal(r.ok, false);
  assert.match(r.error, /username/i);
});

test('rejects empty input', () => {
  assert.equal(checkLogin('', '').ok, false);
});
