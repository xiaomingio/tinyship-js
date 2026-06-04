# TinyShip 发布流程

本文档是 TinyShip 发布流程的唯一真源。发布 npm package 时，只需要一个发布 commit；`tinyship-demo` 的发布前验证通过本地 hook 使用当前仓库里的 `tinyship` package，不需要为了 demo 消费新版本再拆一个 commit。

## 发布前准备

先完成 `tinyship` 源码、测试、README 和 demo 文档更新。发布前在 `tinyship-demo` 中打开本地 package hook，验证 demo 会使用当前仓库里的 `tinyship`：

```bash
cd tinyship-demo # 进入 demo 项目目录
npm run tinyship:local:on # 让 demo 的 tinyship 命令指向本仓库 package
npm run deploy:validate # 校验 demo 配置、env 文件和本地发布文件
npm run deploy:dry-run # 预览全部 host 和 service 的发布命令
npx tinyship dry-run host frontend # 预览单个 host 的发布命令，确认参数透传和 host 选择正常
npx tinyship dry-run service tinyship-demo-user # 预览单个 service 的发布命令，确认 service 选择正常
npm run tinyship:local:off # 恢复 demo 使用已安装的 npm package
```

`tinyship:local:on` 会把 `node_modules/.bin/tinyship` 指向本仓库的 `tinyship/bin/tinyship.mjs`；`tinyship:local:off` 会恢复为已安装的 npm package。验证结束后必须恢复到 off 状态。

## 版本号

在发布 npm 前，同时更新 `tinyship/package.json` 和 `tinyship/package-lock.json` 中的版本号：

```bash
cd tinyship # 进入 TinyShip CLI package 目录
npm version <version> --no-git-tag-version # 只更新 package.json 和 package-lock.json，不自动提交或打 tag
```

## 发布验证

在 `tinyship` package 内验证当前版本：

```bash
npm test # 构建并运行 tinyship 测试
npm run typecheck # 单独运行 TypeScript 类型检查
npm pack --dry-run # 预览 npm 包内容，不生成正式发布
```

回到仓库根目录后确认 demo 的 bin hook 已恢复到已安装 package：

```bash
cd .. # 回到仓库根目录
ls -l tinyship-demo/node_modules/.bin/tinyship # 确认 demo 的 tinyship bin 已恢复到 npm package
```

输出应指向 `../@xiaomingio/tinyship/bin/tinyship.mjs`。

## Commit、发布和 Tag

提交本次发布相关改动：

```bash
git add README.md README.zh-CN.md docs/release.md tinyship tinyship-demo # 暂存发布相关改动
git commit -m "release: tinyship <version>" # 创建发布 commit
```

从该 commit 发布 npm package：

```bash
cd tinyship # 进入 TinyShip CLI package 目录
npm publish # 发布当前 package 到 npm
```

给同一个发布 commit 打 tag：

```bash
cd .. # 回到仓库根目录
git tag -a v<version> -m "@xiaomingio/tinyship v<version>" # 给发布 commit 创建 annotated tag
```

推送分支和 tag：

```bash
git push origin main # 推送发布 commit
git push origin v<version> # 推送版本 tag
```
