/**
 * File purpose: User frontend entry that loads the prod.tinyship-demo-user env and starts the user page.
 */
import '@xiaomingio/tinyship-env/register';

import { startFrontendPage } from './common.js';

startFrontendPage({
  appName: 'tinyship-demo-user',
  defaultPort: 3000,
  defaultTitle: 'TinyShip User',
  defaultEnvLabel: 'local-user',
  audience: 'User',
});
