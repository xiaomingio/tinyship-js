/**
 * 文件说明: 提供 TinyShip 测试共享的最小 deploy config、ecosystem config 和 rsync 清单。
 */
export const requiredRsync = ['package.json', 'package-lock.json', 'ecosystem.config.cjs', 'tinyship.config.yml'];

export function exampleEcosystemConfig({ script = 'dist/src/server.js', nodeEnv = 'production' } = {}) {
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

export function exampleDeployConfig({
  hostName = 'web',
  ssh = { target: 'root@example.com' },
  rsync = ['dist/', ...requiredRsync, '.env.production'],
  npmInstall = true,
  pm2Restart = true,
  postCommand = [],
} = {}) {
  return {
    hosts: {
      [hostName]: {
        ssh,
        appDir: '/var/www/example',
        rsync,
      },
    },
    services: {
      'example-server': {
        host: hostName,
        npmInstall,
        pm2Restart,
        postCommand,
      },
    },
  };
}
