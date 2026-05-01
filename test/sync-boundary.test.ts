import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SyncRequestCommand, SyncCompleteEvent } from '../protocol.js';
import { PEER_CAPABILITIES } from '../capabilities.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8')) as T;
}

test('sync_request fixture matches SyncRequestCommand shape', () => {
  const fixture = loadFixture<SyncRequestCommand>('sync-request.json');
  assert.equal(fixture.type, 'sync_request');
  assert.equal(typeof fixture.request_id, 'string');
  assert.ok(fixture.request_id.length > 0);
  assert.ok(Array.isArray(fixture.cursors));
  for (const cursor of fixture.cursors) {
    assert.equal(typeof cursor.session_id, 'string');
    assert.equal(typeof cursor.last_seq, 'number');
    assert.equal(Number.isInteger(cursor.last_seq), true);
  }
});

test('sync_complete fixture matches SyncCompleteEvent shape', () => {
  const fixture = loadFixture<SyncCompleteEvent>('sync-complete.json');
  assert.equal(fixture.type, 'sync_complete');
  assert.equal(typeof fixture.request_id, 'string');
  assert.ok(fixture.request_id.length > 0);
  assert.ok(Array.isArray(fixture.delivered));
  for (const entry of fixture.delivered) {
    assert.equal(typeof entry.session_id, 'string');
    assert.equal(typeof entry.last_seq, 'number');
    assert.equal(Number.isInteger(entry.last_seq), true);
    assert.ok(entry.last_seq >= 0);
  }
});

test('sync request_id round-trips through complete', () => {
  const req = loadFixture<SyncRequestCommand>('sync-request.json');
  const res = loadFixture<SyncCompleteEvent>('sync-complete.json');
  assert.equal(res.request_id, req.request_id);
});

test('SYNC_BOUNDARY capability constant is declared', () => {
  assert.equal(PEER_CAPABILITIES.SYNC_BOUNDARY, 'messages.sync_boundary');
});
