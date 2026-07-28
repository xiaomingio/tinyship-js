/**
 * 文件说明: 为 tinyship-demo 模拟一个发布期数据库迁移命令。
 * 这个脚本只写入发布目录内的演示 ledger，不连接真实数据库。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const targetVersion = 1;
const ledgerPath = path.resolve('.tinyship-demo-db-ledger.json');

async function readCurrentVersion() {
  try {
    const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
    return Number.isInteger(ledger.version) ? ledger.version : 0;
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
}

const currentVersion = await readCurrentVersion();

if (currentVersion >= targetVersion) {
  console.info(`tinyship-demo database already at version ${currentVersion}`);
  process.exit(0);
}

await mkdir(path.dirname(ledgerPath), { recursive: true });
await writeFile(ledgerPath, JSON.stringify({
  version: targetVersion,
  migratedAt: new Date().toISOString(),
}, null, 2) + '\n');

console.info(`tinyship-demo database migrated from version ${currentVersion} to ${targetVersion}`);
