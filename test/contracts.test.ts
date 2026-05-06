import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CURRENT_PEER_CAPABILITIES, PEER_CAPABILITIES } from '../capabilities.js';
import { WIRE_VERSION_CURRENT, WIRE_VERSION_MIN } from '../constants.js';
import { CURRENT_RELAY_FEATURES, RELAY_FEATURES } from '../features.js';
import type { AgentInfoLite, CommandAckEvent, ContextUsageEvent, ContextUsageInfo, GetContextUsageCommand, GetMcpServerStatusCommand, GetSupportedAgentsCommand, GetSupportedCommandsCommand, GetSupportedModelsCommand, McpServerInfo, McpServerStatusEvent, ModelCatalog, ModelCatalogEntry, ModelInfo, NewSessionCommand, NotificationDeliveryAckCommand, PermissionMode, RewindSessionCommand, RewindSessionResponseEvent, SessionInfo, SessionPermissionModeChangedEvent, SessionStartedEvent, SetModelCommand, SetPermissionModeCommand, SlashCommandInfo, SupportedAgentsEvent, SupportedCommandsEvent, SupportedModelsEvent } from '../protocol.js';
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

test('get_supported_models command echoes session_id', () => {
  const cmd: GetSupportedModelsCommand = { type: 'get_supported_models', request_id: 'r', session_id: 's' };
  assert.equal(cmd.type, 'get_supported_models');
  assert.equal(cmd.session_id, 's');
});

test('supported_models event carries the models array keyed by request_id', () => {
  const model: ModelInfo = {
    value: 'claude-sonnet-4-6',
    display_name: 'Sonnet 4.6',
    description: 'Balanced model',
    supports_effort: false,
  };
  const ev: SupportedModelsEvent = {
    type: 'supported_models',
    request_id: 'r',
    session_id: 's',
    models: [model],
  };
  assert.equal(ev.models.length, 1);
  assert.equal(ev.models[0].value, 'claude-sonnet-4-6');
  assert.equal(ev.models[0].supports_effort, false);
});

test('ModelInfo optional effort levels are typed as the documented union', () => {
  const m: ModelInfo = {
    value: 'opus',
    display_name: 'Opus',
    description: 'Most capable',
    supports_effort: true,
    supported_effort_levels: ['low', 'medium', 'high', 'xhigh', 'max'],
  };
  assert.deepEqual(m.supported_effort_levels, ['low', 'medium', 'high', 'xhigh', 'max']);
});

test('supported_models event carries optional model_catalog and current_model', () => {
  const entry: ModelCatalogEntry = {
    family: 'opus',
    version: '4-7',
    version_label: '4.7',
    supports_one_m: true,
    effort_levels: ['low', 'medium', 'high', 'xhigh', 'max'],
  };
  const catalog: ModelCatalog = { entries: [entry] };
  const ev: SupportedModelsEvent = {
    type: 'supported_models',
    request_id: 'r',
    session_id: 's',
    models: [],
    current_model: 'claude-opus-4-7-xhigh[1m]',
    model_catalog: catalog,
  };
  assert.equal(ev.current_model, 'claude-opus-4-7-xhigh[1m]');
  assert.equal(ev.model_catalog?.entries.length, 1);
  assert.equal(ev.model_catalog?.entries[0].family, 'opus');
  assert.equal(ev.model_catalog?.entries[0].supports_one_m, true);
  assert.deepEqual(ev.model_catalog?.entries[0].effort_levels, ['low', 'medium', 'high', 'xhigh', 'max']);
});

test('get_context_usage command echoes session_id', () => {
  const cmd: GetContextUsageCommand = { type: 'get_context_usage', request_id: 'r', session_id: 's' };
  assert.equal(cmd.type, 'get_context_usage');
  assert.equal(cmd.session_id, 's');
});

test('context_usage event carries the SDK usage breakdown keyed by request_id', () => {
  const usage: ContextUsageInfo = {
    categories: [
      { name: 'system_prompt', tokens: 1200, color: '#abc' },
      { name: 'messages', tokens: 8900, color: '#def', is_deferred: false },
    ],
    total_tokens: 10100,
    max_tokens: 200000,
    raw_max_tokens: 200000,
    percentage: 5.05,
    model: 'claude-sonnet-4-6',
  };
  const ev: ContextUsageEvent = {
    type: 'context_usage',
    request_id: 'r',
    session_id: 's',
    usage,
  };
  assert.equal(ev.type, 'context_usage');
  assert.equal(ev.usage.total_tokens, 10100);
  assert.equal(ev.usage.categories.length, 2);
  assert.equal(ev.usage.model, 'claude-sonnet-4-6');
});

test('ContextUsageInfo memory_files / mcp_tools are optional', () => {
  const minimal: ContextUsageInfo = {
    categories: [],
    total_tokens: 0,
    max_tokens: 200000,
    raw_max_tokens: 200000,
    percentage: 0,
    model: 'opus',
  };
  assert.equal(minimal.memory_files, undefined);
  assert.equal(minimal.mcp_tools, undefined);
});

test('get_supported_commands command echoes session_id', () => {
  const cmd: GetSupportedCommandsCommand = { type: 'get_supported_commands', request_id: 'r', session_id: 's' };
  assert.equal(cmd.type, 'get_supported_commands');
  assert.equal(cmd.session_id, 's');
});

test('supported_commands event carries the SDK SlashCommand list', () => {
  const cmd: SlashCommandInfo = {
    name: 'usage',
    description: 'Show context usage',
    argument_hint: '',
    aliases: ['cost', 'stats'],
  };
  const ev: SupportedCommandsEvent = {
    type: 'supported_commands',
    request_id: 'r',
    session_id: 's',
    commands: [cmd],
  };
  assert.equal(ev.commands[0]!.name, 'usage');
  assert.equal(ev.commands[0]!.aliases?.length, 2);
});

test('SlashCommandInfo aliases is optional', () => {
  const c: SlashCommandInfo = { name: 'help', description: 'Help', argument_hint: '' };
  assert.equal(c.aliases, undefined);
});

test('get_supported_agents command echoes session_id', () => {
  const cmd: GetSupportedAgentsCommand = { type: 'get_supported_agents', request_id: 'r', session_id: 's' };
  assert.equal(cmd.type, 'get_supported_agents');
  assert.equal(cmd.session_id, 's');
});

test('supported_agents event carries the SDK AgentInfo list', () => {
  const a: AgentInfoLite = { name: 'Explore', description: 'Codebase exploration', model: 'haiku' };
  const ev: SupportedAgentsEvent = {
    type: 'supported_agents',
    request_id: 'r',
    session_id: 's',
    agents: [a],
  };
  assert.equal(ev.agents[0]!.name, 'Explore');
  assert.equal(ev.agents[0]!.model, 'haiku');
});

test('AgentInfoLite model is optional', () => {
  const a: AgentInfoLite = { name: 'Plan', description: 'Plan it' };
  assert.equal(a.model, undefined);
});

test('get_mcp_server_status command echoes session_id', () => {
  const cmd: GetMcpServerStatusCommand = { type: 'get_mcp_server_status', request_id: 'r', session_id: 's' };
  assert.equal(cmd.type, 'get_mcp_server_status');
  assert.equal(cmd.session_id, 's');
});

test('mcp_server_status event carries server connection state', () => {
  const server: McpServerInfo = {
    name: 'github',
    status: 'connected',
    scope: 'user',
    server_version: '1.2.3',
    tools: [
      { name: 'create_issue', description: 'File a new issue' },
      { name: 'list_prs' },
    ],
  };
  const ev: McpServerStatusEvent = {
    type: 'mcp_server_status',
    request_id: 'r',
    session_id: 's',
    servers: [server],
  };
  assert.equal(ev.servers[0]!.name, 'github');
  assert.equal(ev.servers[0]!.status, 'connected');
  assert.equal(ev.servers[0]!.tools?.length, 2);
});

test('McpServerInfo error/scope/tools/server_version are optional', () => {
  const minimal: McpServerInfo = { name: 'm', status: 'pending' };
  assert.equal(minimal.error, undefined);
  assert.equal(minimal.scope, undefined);
  assert.equal(minimal.tools, undefined);
  assert.equal(minimal.server_version, undefined);
});

test('McpServerInfo failed status carries error string', () => {
  const failed: McpServerInfo = { name: 'm', status: 'failed', error: 'connection refused' };
  assert.equal(failed.error, 'connection refused');
});

test('rewind_session command carries dry_run + user_message_id', () => {
  const preview: RewindSessionCommand = {
    type: 'rewind_session',
    request_id: 'r',
    session_id: 's',
    user_message_id: 'msg-1',
    dry_run: true,
  };
  const apply: RewindSessionCommand = {
    type: 'rewind_session',
    request_id: 'r',
    session_id: 's',
    user_message_id: 'msg-1',
  };
  assert.equal(preview.dry_run, true);
  assert.equal(apply.dry_run, undefined);
});

test('rewind_session_response carries fork id on apply, omits it on dry-run', () => {
  const dryRunOk: RewindSessionResponseEvent = {
    type: 'rewind_session_response',
    request_id: 'r',
    session_id: 's',
    can_rewind: true,
    dry_run: true,
    files_changed: ['a.ts', 'b.ts'],
    insertions: 12,
    deletions: 5,
  };
  const applyOk: RewindSessionResponseEvent = {
    type: 'rewind_session_response',
    request_id: 'r',
    session_id: 's',
    can_rewind: true,
    dry_run: false,
    files_changed: ['a.ts'],
    insertions: 1,
    deletions: 0,
    new_session_id: 's-fork',
  };
  const denied: RewindSessionResponseEvent = {
    type: 'rewind_session_response',
    request_id: 'r',
    session_id: 's',
    can_rewind: false,
    dry_run: false,
    error: 'file checkpointing disabled',
  };
  assert.equal(dryRunOk.new_session_id, undefined);
  assert.equal(applyOk.new_session_id, 's-fork');
  assert.equal(denied.error, 'file checkpointing disabled');
});

test('SESSION_REWIND capability is announced', () => {
  assert.ok(CURRENT_PEER_CAPABILITIES.includes(PEER_CAPABILITIES.SESSION_REWIND));
});
