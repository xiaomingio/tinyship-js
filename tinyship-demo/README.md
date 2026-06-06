# tinyship-demo

This is a minimal multi-service demo project that exercises the full TinyShip deployment flow on localhost. One localhost target deploys the API into `/tmp/tinyship-demo/backend`, and another localhost target deploys both the user-facing frontend and the admin frontend into `/tmp/tinyship-demo/frontend`.

```json
{
  "dependencies": {
    "@xiaomingio/tinyship-env": "^0.1.0"
  },
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
├── .env.prod.tinyship-demo-user
├── .env.prod.tinyship-demo-user.example
├── .env.prod.tinyship-demo-admin
├── .env.prod.tinyship-demo-admin.example
├── .env.prod.tinyship-demo-backend
├── .env.prod.tinyship-demo-backend.example
├── src/
│   ├── frontend/
│   │   ├── common.ts
│   │   ├── user.ts
│   │   └── admin.ts
│   └── backend/
│       └── api.ts
└── dist/
    ├── frontend/
    │   ├── user.js
    │   └── admin.js
    └── backend/
        └── api.js
```

`tinyship-demo-user` is deployed to the `frontend-host` localhost target, uses `NODE_ENV=prod.tinyship-demo-user`, and loads `.env.prod.tinyship-demo-user`.

`tinyship-demo-admin` is deployed to the `frontend-host` localhost target, uses `NODE_ENV=prod.tinyship-demo-admin`, and loads `.env.prod.tinyship-demo-admin`.

`tinyship-demo-backend` is deployed to the `backend-host` localhost target, uses `NODE_ENV=prod.tinyship-demo-backend`, and loads `.env.prod.tinyship-demo-backend`. Its `/api/env` endpoint returns the backend runtime env values.

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
```

TinyShip deploys into `/tmp/tinyship-demo/frontend` and `/tmp/tinyship-demo/backend`, which works on both macOS and Linux.
