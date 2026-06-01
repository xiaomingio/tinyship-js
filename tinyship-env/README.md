# @xiaomingio/tinyship-env

Runtime env loader for TinyShip services. It loads the matching `.env` file before your application modules run.

For full project documentation, see the repository README: <https://github.com/xiaomingio/tinyship-js>.

## Installation

```bash
npm install @xiaomingio/tinyship-env
```

## Usage

Import the register module at the very start of your application entry file:

```ts
import '@xiaomingio/tinyship-env/register';
```

## Env Resolution

| Configuration | Loaded env file |
| --- | --- |
| `DOTENV_CONFIG_PATH` is set | File pointed to by `DOTENV_CONFIG_PATH` |
| `NODE_ENV` is `prod.demo-service-one` | `.env.prod.demo-service-one` |
| Neither `DOTENV_CONFIG_PATH` nor `NODE_ENV` is set | `.env` |

## License

ISC
