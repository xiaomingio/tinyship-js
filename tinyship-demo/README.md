# tinyship-demo

This is a minimal multi-service demo project that exercises the full TinyShip deployment flow on localhost. One localhost target deploys the API into `/tmp/tinyship-demo/backend`, and another localhost target deploys both the user-facing frontend and the admin frontend into `/tmp/tinyship-demo/frontend`.

```json
{
  "devDependencies": {
    "@xiaomingio/tinyship": "^0.1.0"
  }
}
```

## Layout

```text
tinyship-demo/
├── tinyship.config.yml
├── ecosystem.config.cjs
├── ecosystem.staging.config.cjs
├── apps/
│   ├── user/
│   │   ├── src/user.ts
│   │   ├── dist/user.js
│   │   ├── package.json
│   │   ├── .env.production
│   │   └── .env.example
│   ├── admin/
│   │   ├── src/admin.ts
│   │   ├── dist/admin.js
│   │   ├── package.json
│   │   ├── .env.production
│   │   └── .env.example
│   ├── backend/
│   │   ├── src/api.ts
│   │   ├── dist/api.js
│   │   ├── package.json
│   │   ├── .env.production
│   │   └── .env.example
│   └── shared/
│       ├── src/common.ts
│       └── package.json
└── package.json
```

Each service owns its source, package metadata, and `dist`. TinyShip publishes only its `package.json`, `dist`, and `.env.production`; source files and templates stay local.

`tinyship-demo-user` is deployed to the `frontend-host` localhost target and loads `apps/user/.env.production` with Node's native `--env-file`.

`tinyship-demo-admin` loads `apps/admin/.env.production` using the same process boundary.

`tinyship-demo-backend` loads `apps/backend/.env.production`. All three services use `NODE_ENV=production`; application code only reads `process.env`.

`staging-tinyship-demo-user` demonstrates deploying the same `tinyship-demo-user` PM2 app to another host. The staging host selects `ecosystem.staging.config.cjs`, while `pm2App` maps the deployment target back to the existing PM2 app name. Its rsync list explicitly includes `apps/user/.env.staging`.

## Commands

```bash
npm install
npm run build
npm run deploy:validate
npm run deploy:preflight
npm run deploy:dry-run
npm run deploy -- all
```

By default, the demo uses the installed `@xiaomingio/tinyship` package through the normal `tinyship` binary. Run `npm run tinyship:local:on` to hook `node_modules/.bin/tinyship` to the local `../tinyship` package, and run `npm run tinyship:local:off` to restore the installed package binary.

The full deployment flow requires SSH to `localhost`, `rsync`, `npm`, and `pm2` on the same machine. On macOS, enable Remote Login in System Settings. On Linux, start the local SSH server and make sure the current user can run `ssh localhost` without an interactive password prompt.

Quick local prerequisite checks:

```bash
ssh localhost 'printf ok'
rsync --version
node --version
npm --version
pm2 --version
```

If `ssh localhost` asks for a password or fails, configure local SSH keys before running `npm run deploy -- all`. If `pm2 --version` fails, install PM2 on the local machine first.

You can deploy each localhost target separately:

```bash
npm run deploy -- host frontend-host
npm run deploy -- host backend-host
npm run deploy -- service tinyship-demo-user
npm run deploy -- service staging-tinyship-demo-user
```

TinyShip deploys into `/tmp/tinyship-demo/frontend` and `/tmp/tinyship-demo/backend`, which works on both macOS and Linux.
