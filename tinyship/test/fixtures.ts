/**
 * 文件说明: 提供 TinyShip 测试共享的最小 deploy config、ecosystem config 和 rsync 清单。
 */
export const requiredRsync = ['dist/', 'package.json', 'package-lock.json', 'ecosystem.config.cjs', 'tinyship.config.yml'];

export function exampleEcosystemConfig({ script = 'dist/src/server.js', nodeEnv = 'prod.example-server' } = {}) {
  return {
    apps: [
      {
        name: 'example-server',
        script,
        env: { NODE_ENV: nodeEnv },
      },
    ],
  };
}

export function exampleDeployConfig({ hostName = 'web', ssh = { target: 'root@example.com' }, rsync = [...requiredRsync, '.env.prod.example-server'] } = {}) {
  return {
    hosts: {
      [hostName]: {
        ssh,
        appDir: '/var/www/example',
        rsync,
      },
    },
    services: {
      'example-server': { host: hostName },
    },
  };
}
