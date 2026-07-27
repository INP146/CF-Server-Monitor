import { loadSettings, DEFAULT_SITE_TITLE } from '../utils/settings.js';
import type { SiteSettings } from '../utils/settings.js';
import {
  parseCspOrigins,
  buildApiDomainsWithWs,
  buildCspHeader,
  buildBackgroundStyle,
  stripCspMeta
} from '../utils/csp.js';

let filesCache: Record<string, string> | null = null;

async function loadFrontendFiles(env: Env): Promise<Record<string, string>> {
  if (filesCache) return filesCache;

  try {
    const files: Record<string, string> = {};

    if (env.ASSETS) {
      try {
        const mainFiles = ['dashboard.html', 'style.css'];
        for (const filename of mainFiles) {
          try {
            const res = await env.ASSETS.fetch(new Request(`http://static/${filename}`));
            if (res.ok) {
              files[filename] = await res.text();
            }
          } catch (e) {
            // ignore missing asset binding files
          }
        }
      } catch (e) {
        console.log('[INFO] No ASSETS binding');
      }
    }

    filesCache = files;
    return filesCache;
  } catch (e) {
    console.error('[ERROR] Failed to load frontend files:', e);
    return {};
  }
}

function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function insertBeforeHeadClose(html: string, content: string): string {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${content}\n</head>`);
  }
  return `${content}\n${html}`;
}

function injectTitle(html: string, title: unknown): string {
  const safeTitle = escapeHtml(title || DEFAULT_SITE_TITLE);
  if (/<title>.*?<\/title>/is.test(html)) {
    return html.replace(/<title>.*?<\/title>/is, `<title>${safeTitle}</title>`);
  }
  return insertBeforeHeadClose(html, `<title>${safeTitle}</title>`);
}

function injectAppearanceSettings(html: string, settings: SiteSettings): { html: string; csp: string } {
  let modifiedHtml = stripCspMeta(html);

  modifiedHtml = injectTitle(modifiedHtml, settings.site_title || DEFAULT_SITE_TITLE);

  const cspStatic = settings.csp_static || '';
  const cspApi = settings.csp_api || '';
  const staticDomains = parseCspOrigins(cspStatic);
  const rawApiDomains = parseCspOrigins(cspApi);
  const apiDomains = buildApiDomainsWithWs(rawApiDomains);
  const csp = buildCspHeader({ staticDomains, apiDomains });

  if (settings.custom_head) {
    modifiedHtml = insertBeforeHeadClose(modifiedHtml, settings.custom_head);
  }

  if (settings.custom_script) {
    if (/<\/body>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(/<\/body>/i, `<script>${settings.custom_script}</script>\n</body>`);
    } else {
      modifiedHtml += `\n<script>${settings.custom_script}</script>`;
    }
  }

  if (settings.custom_bg) {
    modifiedHtml = insertBeforeHeadClose(modifiedHtml, buildBackgroundStyle(settings.custom_bg));
  }

  return {
    html: modifiedHtml,
    csp
  };
}

function buildHtmlResponse(
  html: string,
  settings: SiteSettings
): Response {
  const rendered = injectAppearanceSettings(html, settings);
  const headers = new Headers({
    'Content-Type': 'text/html;charset=UTF-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': rendered.csp
  });

  return new Response(rendered.html, { headers });
}

export async function serveFrontend(
  env: Env,
  settings: SiteSettings | null = null
): Promise<Response> {
  if (!settings) {
    settings = await loadSettings(env.DB);
  }

  const files = await loadFrontendFiles(env);
  const html = files['dashboard.html'];

  if (html) {
    return buildHtmlResponse(html, settings);
  }

  return new Response('Frontend not available. Please build the frontend first with `npm run build:frontend`.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
  });
}
