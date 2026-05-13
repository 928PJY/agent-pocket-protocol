import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RELAY_CONTROL_TYPE,
  isPeerHelloControlFrame,
  type PeerHelloControlFrame,
  type RelayControlFrame,
} from '../relay-control.js';

test('RELAY_CONTROL_TYPE is the wire literal', () => {
  assert.equal(RELAY_CONTROL_TYPE, '__relay_control');
});

test('isPeerHelloControlFrame accepts a well-formed frame', () => {
  const frame: PeerHelloControlFrame = {
    type: RELAY_CONTROL_TYPE,
    action: 'peer_hello',
    product: 'app',
    product_version: '1.2.3',
    wire_version: 1,
    capabilities: ['history.verify', 'sdk.stable_uuid'],
    sent_at: 1710000000000,
  };
  assert.equal(isPeerHelloControlFrame(frame), true);
});

test('isPeerHelloControlFrame rejects wrong action', () => {
  const frame = {
    type: RELAY_CONTROL_TYPE,
    action: 'peer_status',
    product: 'app',
    product_version: '1.2.3',
    wire_version: 1,
    capabilities: [],
    sent_at: 0,
  } as RelayControlFrame;
  assert.equal(isPeerHelloControlFrame(frame), false);
});

test('isPeerHelloControlFrame rejects missing fields', () => {
  const frame = {
    type: RELAY_CONTROL_TYPE,
    action: 'peer_hello',
    product: 'app',
  } as RelayControlFrame;
  assert.equal(isPeerHelloControlFrame(frame), false);
});

test('isPeerHelloControlFrame rejects wrong field types', () => {
  const frame = {
    type: RELAY_CONTROL_TYPE,
    action: 'peer_hello',
    product: 'app',
    product_version: '1.2.3',
    wire_version: '1',
    capabilities: ['x'],
    sent_at: 0,
  } as unknown as RelayControlFrame;
  assert.equal(isPeerHelloControlFrame(frame), false);
});

test('isPeerHelloControlFrame rejects non-array capabilities', () => {
  const frame = {
    type: RELAY_CONTROL_TYPE,
    action: 'peer_hello',
    product: 'daemon',
    product_version: '0.2.1',
    wire_version: 1,
    capabilities: 'history.verify',
    sent_at: 0,
  } as unknown as RelayControlFrame;
  assert.equal(isPeerHelloControlFrame(frame), false);
});
