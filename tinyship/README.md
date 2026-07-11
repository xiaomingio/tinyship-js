# @xiaomingio/tinyship

CLI package for TinyShip. It validates and deploys Node.js / PM2 projects by syncing configured files to remote hosts, installing production dependencies, and reloading matching PM2 services.

For full project documentation, see the repository README: <https://github.com/xiaomingio/tinyship-js>.

## Installation

```bash
npm install -D @xiaomingio/tinyship
```

For PM2 services, use standard `NODE_ENV=production` and Node's native `--env-file=apps/<service>/.env.production`. TinyShip derives and validates that env path from the PM2 script path; application code only reads `process.env`.

Put shared deploy paths in `host.rsync` and app-specific paths in `service.rsync`. TinyShip merges and deduplicates selected paths, then runs rsync once per host.

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
