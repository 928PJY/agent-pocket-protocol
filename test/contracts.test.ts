import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CURRENT_PEER_CAPABILITIES, PEER_CAPABILITIES } from '../capabilities.js';
import { WIRE_VERSION_CURRENT, WIRE_VERSION_MIN } from '../constants.js';
import { CURRENT_RELAY_FEATURES, RELAY_FEATURES } from '../features.js';
import type { NotificationDeliveryAckCommand } from '../protocol.js';
import { RISK_CLASSIFICATION, RiskLevel } from '../protocol.js';

function assertUniqueSubset<T>(current: readonly T[], all: Record<string, T>): void {
  const allowed = new Set(Object.values(all));
  const seen = new Set<T>();

  for (const value of current) {
    assert.equal(allowed.has(value), true, `${String(value)} is not declared`);
    assert.equal(seen.has(value), false, `${String(value)} is duplicated`);
    seen.add(value);
  }
}

test('current peer capabilities are declared and unique', () => {
  assertUniqueSubset(CURRENT_PEER_CAPABILITIES, PEER_CAPABILITIES);
});

test('current relay features are declared and unique', () => {
  assertUniqueSubset(CURRENT_RELAY_FEATURES, RELAY_FEATURES);
});

test('wire protocol version range is valid', () => {
  assert.equal(Number.isInteger(WIRE_VERSION_MIN), true);
  assert.equal(Number.isInteger(WIRE_VERSION_CURRENT), true);
  assert.ok(WIRE_VERSION_MIN > 0);
  assert.ok(WIRE_VERSION_MIN <= WIRE_VERSION_CURRENT);
});

test('risk classification keeps expected permission boundaries', () => {
  assert.equal(RISK_CLASSIFICATION.Read, RiskLevel.LOW);
  assert.equal(RISK_CLASSIFICATION.Grep, RiskLevel.LOW);
  assert.equal(RISK_CLASSIFICATION.Edit, RiskLevel.MEDIUM);
  assert.equal(RISK_CLASSIFICATION.Write, RiskLevel.MEDIUM);
  assert.equal(RISK_CLASSIFICATION.Bash, RiskLevel.HIGH);
  assert.equal(RISK_CLASSIFICATION.emergency_abort, RiskLevel.CRITICAL);
});

test('notification delivery ack command preserves stable event identity', () => {
  const command: NotificationDeliveryAckCommand = {
    type: 'notification_delivery_ack',
    session_id: 'session-1',
    event_type: 'permission_request',
    request_id: 'request-1',
    delivered_at: 1710000000000,
  };

  assert.equal(command.type, 'notification_delivery_ack');
  assert.equal(command.session_id, 'session-1');
  assert.equal(command.event_type, 'permission_request');
  assert.equal(command.request_id, 'request-1');
});
