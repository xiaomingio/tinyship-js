/**
 * File purpose: Defines the PM2 service topology for tinyship-demo.
 * Service names must stay aligned with tinyship.config.yml.
 */
module.exports = {
  apps: [
    {
      name: 'tinyship-demo-user',
      script: 'apps/user/dist/user.js',
      node_args: '--env-file=apps/user/.env.production',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'tinyship-demo-admin',
      script: 'apps/admin/dist/admin.js',
      node_args: '--env-file=apps/admin/.env.production',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'tinyship-demo-backend',
      script: 'apps/backend/dist/api.js',
      node_args: '--env-file=apps/backend/.env.production',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
