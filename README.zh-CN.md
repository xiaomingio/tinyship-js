# tinyship-js

[English](README.md) | 简体中文

tinyship-js 是给个人开发者和小团队用的轻量发布工具，用来把本地构建产物发布到自己的服务器。

它把一套常见发布流程标准化：先在本地构建项目，再按配置把每台 host 需要的文件同步过去，然后可选地在服务器执行 npm install、PM2 restart 和自定义发布后命令。

## 安装

在你的项目里安装：

```bash
npm install @xiaomingio/tinyship-env
npm install -D @xiaomingio/tinyship
```

## 项目需要的文件

一个使用 TinyShip 的项目通常长这样：

```text
project/
├── tinyship.config.yml             # 发布配置：hosts、文件清单、service 动作
├── ecosystem.config.cjs            # PM2 服务配置，仅启用 pm2Restart 时需要
├── package.json                    # 项目依赖和 scripts，仅启用 npmInstall 时需要
├── package-lock.json               # 默认 npmInstall 使用
├── src/                            # 源码
├── dist/                           # 本地构建后的产物，被 git 忽略
├── .env                            # 本地开发环境变量，被 git 忽略
├── .env.example                    # 可提交的环境变量示例
├── .env.prod.demo-service-one      # demo-service-one 的生产环境变量，被 git 忽略
├── .env.prod.demo-service-two      # demo-service-two 的生产环境变量，被 git 忽略
└── .env.prod.demo-service-three    # demo-service-three 的生产环境变量，被 git 忽略
```

`dist/` 由你自己的构建命令生成。TinyShip 只负责同步和发布。

## tinyship.config.yml

`tinyship.config.yml` 描述发布目标、host 文件清单和可选 service 动作。SSH 可以使用 `target` 表示 SSH alias / `user@host`，也可以拆成 `host`、`user`、`port` 和 `identityFile`。

```yaml
hosts:
  demo-host-one:                 # host 名
    ssh:
      target: deploy@example.com # SSH alias 或 user@host
    appDir: /var/www/example     # 服务器上的项目目录
    rsync:                       # 发布到这个 host 的文件清单
      - dist/                    # 本地构建产物，也可以写 dist/demo-service-one/ 这样的子目录
      - package.json
      - package-lock.json
      - ecosystem.config.cjs
      - tinyship.config.yml
      - .env.prod.demo-service-one
      - .env.prod.demo-service-two

  demo-host-two:
    ssh:
      host: example.org             # SSH host
      user: deploy                  # 可选 SSH 用户名
      port: 2222                    # 可选 SSH 端口
      identityFile: ~/.ssh/id_demo  # 可选私钥路径
    appDir: /var/www/example
    rsync:
      - dist/demo-service-three/
      - package.json
      - package-lock.json
      - ecosystem.config.cjs
      - tinyship.config.yml
      - .env.prod.demo-service-three

services:
  demo-service-one:     # service 名，需要和 PM2 app name 一致
    host: demo-host-one # 发布到 hosts.demo-host-one
    npmInstall: true    # 当前 host 上选中的 services 只要有一个启用，就执行一次 npm install
    pm2Restart: true    # 只用 PM2 重启这个 service
    postCommand: []     # 这个 service 的自定义命令
  demo-service-two:
    host: demo-host-one
    npmInstall: false
    pm2Restart: true
    postCommand:
      - printf demo-service-two-deployed
  demo-service-three:
    host: demo-host-two
    npmInstall: true
    pm2Restart: true
```

`rsync` 会从项目根目录发起，并保留相对路径。你可以列出整个 `dist/`，也可以只列出包含某台 host 的 PM2 script 的子目录，例如 `dist/demo-service-three/` 会发布到 `<appDir>/dist/demo-service-three/`。

远程动作字段使用下面的结构：

```ts
type TinyShipService = {
  host: string; // 指向 hosts.<hostName>
  npmInstall?: boolean; // true 执行 npm install --omit=dev，并要求 package.json 在 rsync 中
  pm2Restart?: boolean; // true 使用 ecosystem.config.cjs 和 pm2 save 重启这个 service
  postCommand?: string[]; // 在远程 appDir 中执行，顺序在这个 service 的 npmInstall 和 pm2Restart 之后
};
```

`rsync` 属于 host，每个选中的 host 只执行一次。`npmInstall`、`pm2Restart` 和 `postCommand` 属于 services。只发布单个 service 时，TinyShip 仍会执行该 service 所在 host 的 `rsync`，只在这个 service 启用 `npmInstall` 时执行 npm install，只重启这个 PM2 service，也只执行这个 service 的 `postCommand`。

`npmInstall` 只表示 npm 依赖安装。当前 host 上选中的 services 只要有一个启用它，TinyShip 就会在该 host 执行一次 `npm install --omit=dev`，并检查 `package.json` 是否包含在 host 的 `rsync` 中。

`pm2Restart` 只表示 PM2 重启。选中的 services 只要有一个启用它，TinyShip 会加载 `ecosystem.config.cjs`，检查该文件是否包含在 host 的 `rsync` 中，检查每个选中的 PM2 service 是否存在于 ecosystem apps 中，检查每个 PM2 script 是否被 `rsync` 覆盖，检查匹配的 `.env.prod.<service>` 文件，执行 `pm2 startOrReload ecosystem.config.cjs --only <service> --update-env`，然后执行 `pm2 save`。

`postCommand` 表示自定义远程命令。TinyShip 只校验它是非空字符串数组，并在内置 npm 和 PM2 动作之后逐条执行选中 services 的命令。

静态发布可以关闭内置远程动作：

```yaml
hosts:
  static-site:
    ssh:
      target: deploy@example.com
    appDir: /var/www/site
    rsync:
      - dist/

services:
  static-site:
    host: static-site
    npmInstall: false
    pm2Restart: false
    postCommand: []
```

## ecosystem.config.cjs

PM2 服务名要和 `pm2Restart` 选择的 services 一致。禁用 `pm2Restart` 时不需要这个文件。

```js
module.exports = {
  apps: [
    {
      name: 'demo-service-one',
      script: 'dist/demo-service-one.js',
      env: {
        NODE_ENV: 'prod.demo-service-one',
      },
    },
    {
      name: 'demo-service-two',
      script: 'dist/demo-service-two.js',
      env: {
        NODE_ENV: 'prod.demo-service-two',
      },
    },
    {
      name: 'demo-service-three',
      script: 'dist/demo-service-three.js',
      env: {
        NODE_ENV: 'prod.demo-service-three',
      },
    },
  ],
};
```

## 加载 env

在应用入口最前面导入 `tinyship-env` 即可加载相应的 `.env` 文件：

```ts
import '@xiaomingio/tinyship-env/register';
```

TinyShip 会按下面的规则加载 env 文件：

| 配置场景 | 最终加载的 env 文件 |
| --- | --- |
| 设置了 `DOTENV_CONFIG_PATH` | `DOTENV_CONFIG_PATH` 指向的文件 |
| `NODE_ENV` 为 `prod.demo-service-one` | `.env.prod.demo-service-one` |
| `NODE_ENV` 为 `prod.demo-service-two` | `.env.prod.demo-service-two` |
| 没有设置 `DOTENV_CONFIG_PATH` 或 `NODE_ENV` | `.env` |

## package.json

在项目根目录的 `package.json` 里添加：

```json5
{
  "scripts": {
    "build": "node scripts/build.mjs",                  // 运行项目自己的构建流程
    "deploy:validate": "tinyship validate",             // 校验配置、启用的远程动作、env 文件和本地文件
    "deploy:preflight": "tinyship preflight",           // 检查 SSH、远程工具、目录权限和本地 rsync
    "deploy:targets": "tinyship deploy",                // 显示已配置的 hosts 和 services
    "deploy:dry-run": "tinyship dry-run all",           // 预览全部 host 和 services 的发布命令
    "deploy": "tinyship deploy"                         // 通过 npm run deploy -- <args> 透传目标参数
  }
}
```

只运行 `tinyship deploy` 时，会输出命令用法和当前项目已配置的 hosts / services 摘要，然后退出，不会执行发布。可以用 `npm run deploy -- all`、`npm run deploy -- host demo-host-one` 或 `npm run deploy -- service demo-service-one` 透传目标参数。

## 服务器要求

首次发布前，服务器需提前准备好：

- SSH，已经配置好本机SSH Key，可以免密码登录
- rsync
- 启用 npmInstall 时需要 Node.js / npm
- 启用 pm2Restart 时需要 PM2
- 可写的项目目录
- 项目需要的系统依赖

本机需要准备：

- Node.js / npm
- rsync

可以通过 `tinyship preflight` 检查 SSH、远程工具和目录权限是否满足要求。

## 完整 Demo

Demo 项目在 [tinyship-demo](tinyship-demo/README.md)。

Demo 保留普通项目写法，例如 `tinyship deploy`。本地开发 package 时，可以在 `tinyship-demo` 内运行 `npm run tinyship:local:on`，把 `node_modules/.bin/tinyship` hook 到仓库里的本地 `tinyship` package；运行 `npm run tinyship:local:off` 可恢复为已安装的 npm package。

## 本项目开发

```bash
cd tinyship
npm install
npm test

cd ../tinyship-env
npm install
npm run typecheck
```

## 发布流程

package 发布流程见 [docs/release.md](docs/release.md)。

## License

ISC
