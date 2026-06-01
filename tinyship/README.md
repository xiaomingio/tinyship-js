# @xiaomingio/tinyship

CLI package for TinyShip. It validates and deploys Node.js / PM2 projects by syncing configured files to remote hosts, installing production dependencies, and reloading matching PM2 services.

For full project documentation, see the repository README: <https://github.com/xiaomingio/tinyship-js>.

## Installation

```bash
npm install -D @xiaomingio/tinyship
```

Install `@xiaomingio/tinyship-env` as a runtime dependency when your services need TinyShip env loading:

```bash
npm install @xiaomingio/tinyship-env
```

## Commands

| Command | Purpose |
| --- | --- |
| `tinyship validate` | Validate config, PM2 apps, env files, and local upload paths |
| `tinyship preflight` | Check SSH, remote tools, directory permissions, and local rsync |
| `tinyship dry-run <hostName>` | Preview deployment commands for one host |
| `tinyship dry-run all` | Preview deployment commands for all hosts |
| `tinyship deploy <hostName>` | Deploy one host |
| `tinyship deploy all` | Deploy all hosts in config order |

## License

ISC
