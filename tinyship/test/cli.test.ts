/**
 * 文件说明: 验证 TinyShip CLI 的命令层级，确保 deploy host 名称不会和顶层命令冲突。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { main } from '../dist/deploy.js';

test('deploy help exits before loading project config', async () => {
  await assert.doesNotReject(() => main(['deploy', '--help'], '/tmp/tinyship-missing-project'));
});
