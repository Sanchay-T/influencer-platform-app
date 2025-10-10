import assert from 'node:assert/strict';
import { getClientLoggingConfig, resetClientLoggingConfigCache, shouldEmitClientLog } from '../../lib/logging/client-config';
import { LogLevel } from '../../lib/logging/types';

function runWithEnv<T>(overrides: Partial<NodeJS.ProcessEnv>, fn: () => T): T {
  const originalEnv = { ...process.env };
  try {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }
      process.env[key] = value;
    });

    resetClientLoggingConfigCache();
    return fn();
  } finally {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    resetClientLoggingConfigCache();
  }
}

function testWarnSuppressesInfo() {
  runWithEnv({ NODE_ENV: 'production', NEXT_PUBLIC_CLIENT_LOG_LEVEL: 'warn' }, () => {
    assert.equal(shouldEmitClientLog(LogLevel.INFO), false, 'INFO logs should be suppressed when min level is WARN');
    assert.equal(shouldEmitClientLog(LogLevel.WARN), true, 'WARN logs should pass when min level is WARN');
    const config = getClientLoggingConfig();
    assert.equal(config.minLevel, LogLevel.WARN, 'config minLevel should resolve to WARN');
  });
}

function testDebugEnablesAll() {
  runWithEnv({ NODE_ENV: 'development', NEXT_PUBLIC_CLIENT_LOG_LEVEL: 'debug' }, () => {
    assert.equal(shouldEmitClientLog(LogLevel.DEBUG), true, 'DEBUG logs should emit when min level is DEBUG');
    assert.equal(shouldEmitClientLog(LogLevel.INFO), true, 'INFO logs should emit when min level is DEBUG');
  });
}

function testDefaultProductionIsWarn() {
  runWithEnv({ NODE_ENV: 'production', NEXT_PUBLIC_CLIENT_LOG_LEVEL: undefined }, () => {
    const config = getClientLoggingConfig();
    assert.equal(config.minLevel, LogLevel.WARN, 'Production default should be WARN');
    assert.equal(shouldEmitClientLog(LogLevel.INFO), false, 'INFO logs should be filtered under production default');
  });
}

function run() {
  testWarnSuppressesInfo();
  testDebugEnablesAll();
  testDefaultProductionIsWarn();
  console.log('client-config.test.ts passed');
}

run();
