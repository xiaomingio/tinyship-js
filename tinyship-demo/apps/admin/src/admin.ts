/**
 * File purpose: Starts the admin frontend using environment variables supplied by the process layer.
 */
import { startFrontendPage } from '../../shared/src/common.js';

startFrontendPage({
  appName: 'tinyship-demo-admin',
  defaultPort: 3001,
  defaultTitle: 'TinyShip Admin',
  defaultEnvLabel: 'local-admin',
  audience: 'Admin',
  extraEnv: {
    'Admin audit mode': process.env.ADMIN_AUDIT_MODE || 'disabled',
  },
});
