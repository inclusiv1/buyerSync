import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findLinqExecutable,
  getLinqListenerStatus,
  startLinqWebhookListener,
  stopLinqWebhookListener,
} from './linqListener';

test('findLinqExecutable returns a string path or null', () => {
  const result = findLinqExecutable();
  assert.ok(result === null || typeof result === 'string');
});

test('getLinqListenerStatus returns correct initial structure', () => {
  const status = getLinqListenerStatus();
  assert.equal(typeof status.running, 'boolean');
  assert.equal(typeof status.autoListen, 'boolean');
});

test('startLinqWebhookListener respects test mode guard when not forced', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  
  try {
    const started = startLinqWebhookListener({ port: 3001 });
    assert.equal(started, false);
    const status = getLinqListenerStatus();
    assert.equal(status.running, false);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('stopLinqWebhookListener runs safely without active child process', () => {
  assert.doesNotThrow(() => {
    stopLinqWebhookListener();
  });
});
