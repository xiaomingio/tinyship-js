# @xiaomingio/tinyship

CLI package for TinyShip. It validates and deploys Node.js / PM2 projects by syncing configured files to remote hosts, installing production dependencies, and reloading matching PM2 services.

For full project documentation, see the repository README: <https://github.com/xiaomingio/tinyship-js>.

## Installation

```bash
npm install -D @xiaomingio/tinyship
```

For PM2 services, use standard `NODE_ENV=production` and Node's native `--env-file`. TinyShip reads the env path from PM2 `node_args`, falling back to `.env.production` inference, and validates that the file is included in rsync; application code only reads `process.env`.

Hosts use `ecosystem.config.cjs` by default and can select another PM2 config with `host.ecosystem`. Services match PM2 apps by service key by default and can target an existing app name with `service.pm2App`. This supports staging or device-specific startup configuration without custom PM2 post commands.

Put shared deploy paths in `host.rsync` and app-specific paths in `service.rsync`. TinyShip merges and deduplicates selected paths, then runs rsync once per host.

For existing PM2 processes, TinyShip first verifies that each same-name process belongs to the selected host `appDir`. It reloads unchanged services in one command, recreates only services whose PM2 topology changed, starts missing services, and saves the resulting PM2 process list once.

## Commands

| Command | Purpose |
| --- | --- |
| `tinyship validate` | Validate config, PM2 apps, env files, and local upload paths |
| `tinyship preflight` | Check SSH, remote tools, directory permissions, and local rsync |
| `tinyship deploy` | Print usage plus configured hosts and services without deploying |
| `tinyship dry-run host <hostName>` | Preview deployment commands for one host |
| `tinyship dry-run service <serviceName>` | Preview deployment commands for one service |
| `tinyship dry-run all` | Preview deployment commands for all hosts |
| `tinyship deploy host <hostName>` | Deploy one host and all services on it |
| `tinyship deploy service <serviceName>` | Deploy one service |
| `tinyship deploy all` | Deploy all hosts in config order |

## License

ISC
