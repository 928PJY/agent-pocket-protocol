import assert from 'node:assert/strict';
import { createDecipheriv, hkdfSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { WakeBlobPayload } from '../protocol.js';

interface WakeBlobFixture {
  session_recv_key_base64: string;
  nonce_base64?: string;
  wake_blob_base64: string;
  plaintext: string;
  payload: WakeBlobPayload;
}

const nodeFixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/wake-blob.permission-request.json',
);
const swiftFixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/wake-blob.swift-session-error.json',
);

function loadFixture(path: string): WakeBlobFixture {
  return JSON.parse(readFileSync(path, 'utf-8')) as WakeBlobFixture;
}

function decryptWakeBlob(blobBase64: string, sessionRecvKeyBase64: string): string {
  const combined = Buffer.from(blobBase64, 'base64');
  assert.ok(combined.length >= 28, 'wake blob must contain nonce, ciphertext, and tag');

  const nonce = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12, -16);
  const authTag = combined.subarray(-16);
  const wakeKey = Buffer.from(hkdfSync(
    'sha256',
    Buffer.from(sessionRecvKeyBase64, 'base64'),
    Buffer.from('agent-pocket-v1'),
    Buffer.from('agent-pocket-wake-blob-key'),
    32,
  ));

  const decipher = createDecipheriv('chacha20-poly1305', wakeKey, nonce, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  assert.equal(plaintext.length, 1024);
  const length = plaintext.readUInt16BE(0);
  assert.ok(length > 0 && length <= 1022);
  return plaintext.subarray(2, 2 + length).toString('utf-8');
}

test('TypeScript decrypts the shared wake blob fixture', () => {
  const fixture = loadFixture(nodeFixturePath);
  const plaintext = decryptWakeBlob(fixture.wake_blob_base64, fixture.session_recv_key_base64);
  const payload = JSON.parse(plaintext) as WakeBlobPayload;

  assert.equal(plaintext, fixture.plaintext);
  assert.deepEqual(payload, fixture.payload);
  assert.equal(payload.type, 'permission_request');
  assert.equal(payload.session_name, 'Fixture Session');
  assert.equal(payload.session_id, 'session-fixture');
  assert.equal(payload.request_id, 'request-fixture');
});

test('TypeScript decrypts the Swift-generated wake blob fixture', () => {
  const fixture = loadFixture(swiftFixturePath);
  const plaintext = decryptWakeBlob(fixture.wake_blob_base64, fixture.session_recv_key_base64);
  const payload = JSON.parse(plaintext) as WakeBlobPayload;

  assert.equal(Buffer.from(fixture.wake_blob_base64, 'base64').subarray(0, 12).toString('base64'), fixture.nonce_base64);
  assert.equal(plaintext, fixture.plaintext);
  assert.deepEqual(payload, fixture.payload);
  assert.equal(payload.type, 'session_error');
  assert.equal(payload.session_name, 'Swift Fixture Session');
  assert.equal(payload.session_id, 'session-swift-fixture');
  assert.equal(payload.request_id, 'request-swift-fixture');
});
