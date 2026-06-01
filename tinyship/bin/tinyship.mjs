#!/usr/bin/env node
/**
 * 文件说明: TinyShip 命令入口，将命令行参数转交给通用部署模块。
 * 参考资料: packages/tinyship/src/cli.ts
 */
import { main } from '../dist/cli.js';

await main();
