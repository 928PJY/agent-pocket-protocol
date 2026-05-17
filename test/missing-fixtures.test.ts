import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  EmergencyAbortCommand,
  KillSessionCommand,
  QuestionResponseCommand,
  PermissionExpiredEvent,
  PermissionDismissedEvent,
  FileContentEvent,
  ErrorEvent,
  SessionOutputAckCommand,
  GetHistoryCommand,
  SetPreferencesCommand,
  InterruptSessionCommand,
  AssistantMessageEvent,
  TurnMetrics,
} from '../protocol.js';
import { PEER_CAPABILITIES, CURRENT_PEER_CAPABILITIES } from '../capabilities.js';

test('EmergencyAbortCommand shape', () => {
  const cmd: EmergencyAbortCommand = {
    type: 'emergency_abort',
    phone_signature: 'sig-abc',
  };
  assert.equal(cmd.type, 'emergency_abort');
  assert.equal(typeof cmd.phone_signature, 'string');
});

test('KillSessionCommand shape', () => {
  const cmd: KillSessionCommand = {
    type: 'kill_session',
    session_id: 's1',
  };
  assert.equal(cmd.type, 'kill_session');
  assert.equal(typeof cmd.session_id, 'string');
});

test('QuestionResponseCommand shape', () => {
  const cmd: QuestionResponseCommand = {
    type: 'question_response',
    session_id: 's1',
    request_id: 'r1',
    answers: { 'Continue?': 'Yes' },
  };
  assert.equal(cmd.type, 'question_response');
  assert.equal(typeof cmd.session_id, 'string');
  assert.equal(typeof cmd.request_id, 'string');
  assert.equal(typeof cmd.answers, 'object');
});

test('PermissionExpiredEvent shape', () => {
  const ev: PermissionExpiredEvent = {
    type: 'permission_expired',
    session_id: 's1',
    request_id: 'r1',
    tool_name: 'Bash',
  };
  assert.equal(ev.type, 'permission_expired');
  assert.equal(typeof ev.session_id, 'string');
  assert.equal(typeof ev.request_id, 'string');
  assert.equal(typeof ev.tool_name, 'string');
});

test('PermissionDismissedEvent shape', () => {
  const ev: PermissionDismissedEvent = {
    type: 'permission_dismissed',
    request_id: 'r1',
    tool_name: 'Edit',
  };
  assert.equal(ev.type, 'permission_dismissed');
  assert.equal(typeof ev.request_id, 'string');
  assert.equal(typeof ev.tool_name, 'string');
});

test('FileContentEvent shape', () => {
  const ev: FileContentEvent = {
    type: 'file_content',
    request_id: 'r1',
    path: '/tmp/a.txt',
    content: 'hello',
  };
  assert.equal(ev.type, 'file_content');
  assert.equal(typeof ev.request_id, 'string');
  assert.equal(typeof ev.path, 'string');
  assert.equal(typeof ev.content, 'string');
});

test('ErrorEvent shape', () => {
  const ev: ErrorEvent = {
    type: 'error',
    message: 'something went wrong',
  };
  assert.equal(ev.type, 'error');
  assert.equal(typeof ev.message, 'string');
});

test('SessionOutputAckCommand shape', () => {
  const cmd: SessionOutputAckCommand = {
    type: 'session_output_ack',
    session_id: 's1',
    last_seq: 42,
  };
  assert.equal(cmd.type, 'session_output_ack');
  assert.equal(typeof cmd.session_id, 'string');
  assert.equal(typeof cmd.last_seq, 'number');
});

test('GetHistoryCommand shape', () => {
  const cmd: GetHistoryCommand = {
    type: 'get_history',
    session_id: 's1',
  };
  assert.equal(cmd.type, 'get_history');
  assert.equal(typeof cmd.session_id, 'string');
});

test('SetPreferencesCommand shape', () => {
  const cmd: SetPreferencesCommand = {
    type: 'set_preferences',
    preferences: { show_tool_use: true },
  };
  assert.equal(cmd.type, 'set_preferences');
  assert.equal(typeof cmd.preferences, 'object');
});

test('InterruptSessionCommand shape', () => {
  const cmd: InterruptSessionCommand = {
    type: 'interrupt_session',
    session_id: 's1',
  };
  assert.equal(cmd.type, 'interrupt_session');
  assert.equal(typeof cmd.session_id, 'string');
});

test('AssistantMessageEvent.turnMetrics shape (cap MESSAGES_TURN_METRICS)', () => {
  const metrics: TurnMetrics = {
    totalTokens: 12345,
    toolUseCount: 4,
    durationSec: 18,
  };
  const ev: AssistantMessageEvent = {
    type: 'assistant_message',
    message: 'final answer',
    sdkUuid: 'uuid-tail',
    sdkBlockIndex: 0,
    turnMetrics: metrics,
  };
  assert.equal(ev.type, 'assistant_message');
  assert.equal(ev.turnMetrics?.toolUseCount, 4);
  assert.equal(typeof ev.turnMetrics?.totalTokens, 'number');
  assert.equal(typeof ev.turnMetrics?.durationSec, 'number');

  // turnMetrics is optional — non-end_turn rows omit it.
  const intermediate: AssistantMessageEvent = {
    type: 'assistant_message',
    message: 'mid-turn text before a tool_use',
  };
  assert.equal(intermediate.turnMetrics, undefined);

  // Cap is announced in this build.
  assert.ok(CURRENT_PEER_CAPABILITIES.includes(PEER_CAPABILITIES.MESSAGES_TURN_METRICS));
  assert.equal(PEER_CAPABILITIES.MESSAGES_TURN_METRICS, 'messages.turn_metrics');
});
