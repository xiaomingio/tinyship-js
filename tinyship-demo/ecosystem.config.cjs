/**
 * File purpose: Defines the PM2 service topology for tinyship-demo.
 * Service names must stay aligned with tinyship.config.yml.
 */
module.exports = {
  apps: [
    {
      name: 'tinyship-demo-user',
      script: 'dist/frontend/user.js',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'prod.tinyship-demo-user',
      },
    },
    {
      name: 'tinyship-demo-admin',
      script: 'dist/frontend/admin.js',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'prod.tinyship-demo-admin',
      },
    },
    {
      name: 'tinyship-demo-backend',
      script: 'dist/backend/api.js',
      interpreter: 'node',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'prod.tinyship-demo-backend',
      },
    },
  ],
};
