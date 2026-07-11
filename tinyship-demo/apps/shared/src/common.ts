/**
 * File purpose: Provides shared HTML rendering and HTTP server setup for the user and admin frontend apps.
 */
import { createServer } from 'node:http';

export type FrontendPageOptions = {
  appName: string;
  defaultPort: number;
  defaultTitle: string;
  defaultEnvLabel: string;
  audience: string;
  extraEnv?: Record<string, string>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function startFrontendPage(options: FrontendPageOptions): void {
  const port = Number(process.env.PORT || options.defaultPort);
  const title = process.env.FRONTEND_TITLE || options.defaultTitle;
  const frontendEnv = process.env.FRONTEND_ENV_LABEL || options.defaultEnvLabel;
  const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3002';
  const extraEnv = options.extraEnv ?? {};

  function renderPage(): string {
    const safeTitle = escapeHtml(title);
    const safeFrontendEnv = escapeHtml(frontendEnv);
    const safeNodeEnv = escapeHtml(process.env.NODE_ENV || 'development');
    const safeApiBaseUrl = escapeHtml(apiBaseUrl);
    const safeAudience = escapeHtml(options.audience);
    const extraPanels = Object.entries(extraEnv)
      .map(([label, value]) => `
        <div class="panel">
          <div class="label">${escapeHtml(label)}</div>
          <div class="value">${escapeHtml(value)}</div>
        </div>`)
      .join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f5ef;
        color: #202124;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }

      main {
        width: min(920px, calc(100vw - 40px));
        display: grid;
        gap: 18px;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 6vw, 4.5rem);
        line-height: 1;
      }

      p {
        margin: 0;
        color: #5c5d62;
        font-size: 1rem;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .panel {
        border: 1px solid #d9d3c4;
        border-radius: 8px;
        background: #fffdfa;
        padding: 18px;
      }

      .label {
        color: #71727a;
        font-size: 0.78rem;
        text-transform: uppercase;
      }

      .value {
        margin-top: 8px;
        font-size: 1.2rem;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      pre {
        min-height: 160px;
        margin: 0;
        overflow: auto;
        white-space: pre-wrap;
        font-size: 0.9rem;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        body {
          place-items: start center;
          padding: 28px 0;
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeAudience} frontend runs on the frontend host and reads its own TinyShip env file.</p>
      <section class="grid" aria-label="Runtime env">
        <div class="panel">
          <div class="label">Frontend NODE_ENV</div>
          <div class="value">${safeNodeEnv}</div>
        </div>
        <div class="panel">
          <div class="label">Frontend label</div>
          <div class="value">${safeFrontendEnv}</div>
        </div>
        <div class="panel">
          <div class="label">Backend API</div>
          <div class="value">${safeApiBaseUrl}</div>
        </div>
        ${extraPanels}
        <div class="panel">
          <div class="label">Backend response</div>
          <pre id="backend-result">Loading...</pre>
        </div>
      </section>
    </main>
    <script>
      const result = document.querySelector('#backend-result');
      fetch(${JSON.stringify(`${apiBaseUrl}/api/env`)})
        .then(response => response.json())
        .then(data => {
          result.textContent = JSON.stringify(data, null, 2);
        })
        .catch(error => {
          result.textContent = 'Backend request failed: ' + error.message;
        });
    </script>
  </body>
</html>`;
  }

  const server = createServer((request, response) => {
    if (request.url !== '/' && request.url !== '/index.html') {
      response.writeHead(302, { location: '/' });
      response.end();
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderPage());
  });

  server.listen(port, () => {
    console.info(`${options.appName} listening on :${port}`);
  });
}
