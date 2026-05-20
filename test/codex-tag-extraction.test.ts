import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type {
  ClaudeEvent,
  CodexEnvironmentContextEvent,
  CodexCollaborationModeEvent,
  CodexSkillsListingEvent,
  CodexSystemReminderEvent,
  CodexMemCitationEvent,
} from '../protocol.js';
import { PEER_CAPABILITIES, CURRENT_PEER_CAPABILITIES } from '../capabilities.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8')) as T;
}

test('CODEX_TAG_EXTRACTION capability constant is declared with the expected wire string', () => {
  assert.equal(PEER_CAPABILITIES.CODEX_TAG_EXTRACTION, 'codex.tag_extraction');
});

test('CURRENT_PEER_CAPABILITIES announces CODEX_TAG_EXTRACTION', () => {
  assert.ok(CURRENT_PEER_CAPABILITIES.includes(PEER_CAPABILITIES.CODEX_TAG_EXTRACTION));
});

test('codex_environment_context fixture matches shape', () => {
  const ev = loadFixture<CodexEnvironmentContextEvent>('codex-environment-context.json');
  assert.equal(ev.type, 'codex_environment_context');
  assert.equal(typeof ev.cwd, 'string');
  assert.equal(typeof ev.shell, 'string');
  assert.equal(typeof ev.current_date, 'string');
  assert.equal(typeof ev.timezone, 'string');
  assert.match(ev.current_date!, /^\d{4}-\d{2}-\d{2}$/);
});

test('codex_collaboration_mode fixture matches shape and carries a non-empty mode', () => {
  const ev = loadFixture<CodexCollaborationModeEvent>('codex-collaboration-mode.json');
  assert.equal(ev.type, 'codex_collaboration_mode');
  assert.equal(typeof ev.mode, 'string');
  assert.ok(ev.mode.length > 0);
  assert.equal(typeof ev.body, 'string');
});

test('codex_skills_listing fixture matches shape (skills is an array of CodexSkillInfo)', () => {
  const ev = loadFixture<CodexSkillsListingEvent>('codex-skills-listing.json');
  assert.equal(ev.type, 'codex_skills_listing');
  assert.ok(Array.isArray(ev.skills));
  assert.ok(ev.skills.length > 0);
  for (const skill of ev.skills) {
    assert.equal(typeof skill.name, 'string');
    assert.ok(skill.name.length > 0);
    assert.equal(typeof skill.description, 'string');
    if (skill.path !== undefined) {
      assert.equal(typeof skill.path, 'string');
    }
  }
});

test('codex_system_reminder fixture matches shape', () => {
  const ev = loadFixture<CodexSystemReminderEvent>('codex-system-reminder.json');
  assert.equal(ev.type, 'codex_system_reminder');
  assert.equal(typeof ev.text, 'string');
  assert.ok(ev.text.length > 0);
  if (ev.severity !== undefined) {
    assert.ok(['info', 'warn'].includes(ev.severity));
  }
});

test('codex_mem_citation fixture matches shape (entries + rollout_ids)', () => {
  const ev = loadFixture<CodexMemCitationEvent>('codex-mem-citation.json');
  assert.equal(ev.type, 'codex_mem_citation');
  assert.ok(Array.isArray(ev.entries));
  assert.ok(ev.entries.length > 0);
  for (const entry of ev.entries) {
    assert.equal(typeof entry.path, 'string');
    assert.ok(entry.path.length > 0);
    assert.equal(typeof entry.line_start, 'number');
    assert.equal(typeof entry.line_end, 'number');
    assert.ok(entry.line_start >= 1);
    assert.ok(entry.line_end >= entry.line_start);
    if (entry.note !== undefined) {
      assert.equal(typeof entry.note, 'string');
    }
  }
  assert.ok(Array.isArray(ev.rollout_ids));
  for (const id of ev.rollout_ids) {
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
  }
});

test('all codex_* events are assignable to ClaudeEvent (discriminated union)', () => {
  const events: ClaudeEvent[] = [
    loadFixture<CodexEnvironmentContextEvent>('codex-environment-context.json'),
    loadFixture<CodexCollaborationModeEvent>('codex-collaboration-mode.json'),
    loadFixture<CodexSkillsListingEvent>('codex-skills-listing.json'),
    loadFixture<CodexSystemReminderEvent>('codex-system-reminder.json'),
    loadFixture<CodexMemCitationEvent>('codex-mem-citation.json'),
  ];
  assert.equal(events.length, 5);
  for (const ev of events) {
    assert.ok(ev.type.startsWith('codex_'));
  }
});
