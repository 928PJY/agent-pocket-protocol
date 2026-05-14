import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type {
  SyncRequestCommand,
  SyncCompleteEvent,
  SyncAckEvent,
  SessionHistoryDoneEvent,
} from '../protocol.js';
import { PEER_CAPABILITIES, CURRENT_PEER_CAPABILITIES } from '../capabilities.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8')) as T;
}

test('sync_request fixture matches SyncRequestCommand shape (known_seqs is a map)', () => {
  const fixture = loadFixture<SyncRequestCommand>('sync-request.json');
  assert.equal(fixture.type, 'sync_request');
  assert.equal(typeof fixture.request_id, 'string');
  assert.ok(fixture.request_id.length > 0);
  assert.equal(typeof fixture.known_seqs, 'object');
  assert.ok(fixture.known_seqs !== null);
  assert.ok(!Array.isArray(fixture.known_seqs));
  for (const [sessionId, seq] of Object.entries(fixture.known_seqs)) {
    assert.equal(typeof sessionId, 'string');
    assert.ok(sessionId.length > 0);
    assert.equal(typeof seq, 'number');
    assert.equal(Number.isInteger(seq), true);
    assert.ok(seq >= 0);
  }
});

test('SyncRequestCommand has no legacy cursors/mode fields (post-#250 redesign)', () => {
  const fixture = loadFixture<Record<string, unknown>>('sync-request.json');
  assert.equal(fixture.cursors, undefined);
  assert.equal(fixture.mode, undefined);
});

test('empty known_seqs is a valid sync_request (cold start)', () => {
  const cold: SyncRequestCommand = {
    type: 'sync_request',
    request_id: 'sync-cold-start',
    known_seqs: {},
  };
  assert.equal(cold.type, 'sync_request');
  assert.equal(Object.keys(cold.known_seqs).length, 0);
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

test('sync_ack fixture matches SyncAckEvent shape', () => {
  const fixture = loadFixture<SyncAckEvent>('sync-ack.json');
  assert.equal(fixture.type, 'sync_ack');
  assert.equal(typeof fixture.request_id, 'string');
  assert.ok(fixture.request_id.length > 0);
  assert.ok(Array.isArray(fixture.sessions));
  for (const entry of fixture.sessions) {
    assert.equal(typeof entry.session_id, 'string');
    assert.equal(typeof entry.estimated_messages, 'number');
    assert.equal(Number.isInteger(entry.estimated_messages), true);
    assert.ok(entry.estimated_messages >= 0);
  }
});

test('session_history_done fixture matches SessionHistoryDoneEvent shape', () => {
  const fixture = loadFixture<SessionHistoryDoneEvent>('session-history-done.json');
  assert.equal(fixture.type, 'session_history_done');
  assert.equal(typeof fixture.request_id, 'string');
  assert.equal(typeof fixture.session_id, 'string');
  assert.equal(typeof fixture.last_seq, 'number');
  assert.equal(Number.isInteger(fixture.last_seq), true);
  assert.ok(fixture.last_seq >= 0);
});

test('sync_ack request_id round-trips with sync_complete (same request can correlate ack and terminator)', () => {
  const ack = loadFixture<SyncAckEvent>('sync-ack.json');
  const complete = loadFixture<SyncCompleteEvent>('sync-complete.json');
  assert.equal(ack.request_id, complete.request_id);
});

test('SYNC_ACK capability constant is declared', () => {
  assert.equal(PEER_CAPABILITIES.SYNC_ACK, 'messages.sync_ack');
});

test('SYNC_SCOPED capability constant has been removed (replaced by daemon-authoritative scope)', () => {
  assert.equal(
    (PEER_CAPABILITIES as Record<string, string>).SYNC_SCOPED,
    undefined,
  );
});

test('CURRENT_PEER_CAPABILITIES announces SYNC_ACK but not SYNC_SCOPED', () => {
  assert.ok(CURRENT_PEER_CAPABILITIES.includes(PEER_CAPABILITIES.SYNC_ACK));
  assert.ok(
    !CURRENT_PEER_CAPABILITIES.includes('messages.sync_scoped' as never),
  );
});
