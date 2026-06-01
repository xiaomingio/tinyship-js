/**
 * File purpose: Admin frontend entry that loads the prod.tinyship-demo-admin env and starts the admin page.
 */
import '@xiaomingio/tinyship-env/register';

import { startFrontendPage } from './common.js';

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
