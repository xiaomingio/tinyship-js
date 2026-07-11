/**
 * File purpose: Backend API entry that returns the runtime env loaded by the backend service.
 */
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3002);
const backendEnv = process.env.BACKEND_ENV_LABEL || 'local-backend';
const backendRegion = process.env.BACKEND_REGION || 'local';
const backendRelease = process.env.BACKEND_RELEASE || 'dev';

const server = createServer((request, response) => {
  if (request.url !== '/api/env') {
    response.writeHead(404, {
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(`${JSON.stringify({ ok: false, message: 'Not found' })}\n`);
    return;
  }

  response.writeHead(200, {
    'access-control-allow-origin': '*',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(`${JSON.stringify({
    ok: true,
    service: 'tinyship-demo-backend',
    nodeEnv: process.env.NODE_ENV || 'development',
    backendEnv,
    backendRegion,
    backendRelease,
  }, null, 2)}\n`);
});

server.listen(port, () => {
  console.info(`tinyship-demo-backend listening on :${port}`);
});
