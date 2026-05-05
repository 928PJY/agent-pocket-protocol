import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CURRENT_PEER_CAPABILITIES, PEER_CAPABILITIES } from '../capabilities.js';
import { WIRE_VERSION_CURRENT, WIRE_VERSION_MIN } from '../constants.js';
import { CURRENT_RELAY_FEATURES, RELAY_FEATURES } from '../features.js';
import type { CommandAckEvent, NewSessionCommand, NotificationDeliveryAckCommand, PermissionMode, SessionInfo, SessionPermissionModeChangedEvent, SessionStartedEvent, SetModelCommand, SetPermissionModeCommand } from '../protocol.js';
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

test('set_permission_mode command shape', () => {
  const command: SetPermissionModeCommand = {
    type: 'set_permission_mode',
    request_id: 'req-1',
    session_id: 'sess-1',
    mode: 'plan',
  };
  assert.equal(command.type, 'set_permission_mode');
  const allModes: PermissionMode[] = ['default', 'acceptEdits', 'plan', 'bypassPermissions', 'dontAsk', 'auto'];
  assert.equal(allModes.length, 6);
});

test('SessionInfo carries observed/permission_mode/dangerous flags', () => {
  const info: SessionInfo = {
    session_id: 'sess-1',
    status: 'running',
    working_directory: '/tmp',
    project_name: 'tmp',
    last_activity: 0,
    is_observed: false,
    permission_mode: 'acceptEdits',
    dangerously_skip_permissions: true,
  };
  assert.equal(info.is_observed, false);
  assert.equal(info.permission_mode, 'acceptEdits');
  assert.equal(info.dangerously_skip_permissions, true);
});

test('SessionStartedEvent mirrors observed/permission_mode/dangerous flags', () => {
  const ev: SessionStartedEvent = {
    type: 'session_started',
    session_id: 's',
    request_id: 'r',
    working_directory: '/tmp',
    is_observed: false,
    permission_mode: 'default',
    dangerously_skip_permissions: false,
  };
  assert.equal(ev.dangerously_skip_permissions, false);
});

test('NewSessionCommand accepts dangerously_skip_permissions opt-in', () => {
  const cmd: NewSessionCommand = {
    type: 'new_session',
    request_id: 'r',
    config: { name: 'x', agent_type: 'claude_code', dangerously_skip_permissions: true },
  };
  assert.equal(cmd.config.dangerously_skip_permissions, true);
});

test('session_permission_mode_changed event shape', () => {
  const ev: SessionPermissionModeChangedEvent = {
    type: 'session_permission_mode_changed',
    session_id: 's',
    mode: 'auto',
  };
  assert.equal(ev.mode, 'auto');
});

test('set_model command allows undefined model for default', () => {
  const explicit: SetModelCommand = { type: 'set_model', request_id: 'r', session_id: 's', model: 'sonnet' };
  const reset: SetModelCommand = { type: 'set_model', request_id: 'r', session_id: 's' };
  assert.equal(explicit.model, 'sonnet');
  assert.equal(reset.model, undefined);
});

test('command_ack event identifies which control command was acked', () => {
  const ack: CommandAckEvent = {
    type: 'command_ack',
    request_id: 'r',
    session_id: 's',
    command: 'set_model',
  };
  assert.equal(ack.type, 'command_ack');
  assert.equal(ack.command, 'set_model');
});

test('SESSION_CONTROL capability is announced', () => {
  assert.ok(CURRENT_PEER_CAPABILITIES.includes(PEER_CAPABILITIES.SESSION_CONTROL));
});
