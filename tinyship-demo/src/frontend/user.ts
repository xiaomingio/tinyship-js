/**
 * File purpose: Starts the user frontend using environment variables supplied by the process layer.
 */
import { startFrontendPage } from './common.js';

startFrontendPage({
  appName: 'tinyship-demo-user',
  defaultPort: 3000,
  defaultTitle: 'TinyShip User',
  defaultEnvLabel: 'local-user',
  audience: 'User',
});
