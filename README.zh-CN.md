# tinyship-js

[English](README.md) | 简体中文

tinyship-js 是给个人开发者和小团队用的轻量发布工具，用来把 Node.js / PM2 项目发布到自己的服务器。

它把一套常见发布流程标准化：先在本地构建项目，再按配置把不同 service 需要的文件同步到对应 host，然后在服务器安装生产依赖，重载对应的 PM2 服务，最后在运行时加载对应 env。

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
├── tinyship.config.yml             # 发布配置：hosts、services、每台 host 要同步的文件
├── ecosystem.config.cjs            # PM2 服务配置
├── package.json                    # 项目依赖和 scripts
├── package-lock.json               # 服务器安装生产依赖时使用
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

`tinyship.config.yml` 描述发布目标和文件清单。

```yaml
hosts:
  demo-host-one:                 # host 名
    ssh:
      target: deploy@example.com # SSH alias 或 user@host
    appDir: /var/www/example     # 服务器上的项目目录
    rsync:                       # 发布到这个 host 的文件清单
      - dist/                    # 本地构建产物
      - package.json
      - package-lock.json
      - ecosystem.config.cjs
      - tinyship.config.yml
      - .env.prod.demo-service-one
      - .env.prod.demo-service-two

  demo-host-two:
    ssh:
      target: deploy@example.org
    appDir: /var/www/example
    rsync:
      - dist/
      - package.json
      - package-lock.json
      - ecosystem.config.cjs
      - tinyship.config.yml
      - .env.prod.demo-service-three

services:
  demo-service-one:     # service 名，需要和 PM2 app name 一致
    host: demo-host-one # 发布到 hosts.demo-host-one
  demo-service-two:
    host: demo-host-one
  demo-service-three:
    host: demo-host-two
```

## ecosystem.config.cjs

PM2 服务名要和 `tinyship.config.yml` 里的 service 名一致。

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
    "deploy:validate": "tinyship validate",             // 校验配置、PM2 apps、env 文件和本地文件
    "deploy:preflight": "tinyship preflight",           // 检查 SSH、远程工具、目录权限和本地 rsync
    "deploy:dry-run": "tinyship dry-run all",           // 预览全部 host 的发布命令
    "deploy:host-one": "tinyship deploy demo-host-one", // 只发布 demo-host-one
    "deploy:all": "tinyship deploy all"                 // 发布全部 host
  }
}
```

## 服务器要求

首次发布前，服务器需提前准备好：

- SSH，已经配置好本机SSH Key，可以免密码登录
- Node.js / npm / PM2
- rsync
- 可写的项目目录
- 项目需要的系统依赖

本机需要准备：

- Node.js / npm
- rsync

可以通过 `tinyship preflight` 检查 SSH、远程工具和目录权限是否满足要求。

## 完整 Demo

Demo 项目在 [tinyship-demo](tinyship-demo/README.md)。

## 本项目开发

```bash
cd tinyship
npm install
npm test

cd ../tinyship-env
npm install
npm run typecheck
```

## License

ISC
