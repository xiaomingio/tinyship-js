/**
 * File purpose: Derives the demo staging PM2 topology while loading staging env files.
 */
const productionConfig = require('./ecosystem.config.cjs');

module.exports = {
  apps: productionConfig.apps.map(app => ({
    ...app,
    node_args: app.node_args?.replace('.env.production', '.env.staging'),
  })),
};
