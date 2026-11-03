import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import Schema from '@deepseek-ai/schemastery';

export const name = 'dsh-whalepaper';
export const inject = ['webServer'];

const root = fileURLToPath(new URL('./wallpaper/', import.meta.url));
const prefix = '/ascii-orca';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8' };

const themes = ['auto', 'night', 'predawn', 'sunrise', 'day', 'afternoon', 'golden', 'sunset', 'dusk'];
const compositions = ['immersive', 'balanced', 'golden'];

/**
 * Every field is volatile: the settings subsystem projects volatile fields into
 * this profile entry's form, and a write commits the new value into the running
 * plugin's config reference instead of remounting the entry. The defaults are
 * the values already tuned for the Harness UI (33% water, 97% brightness,
 * 111% saturation, .3px blur), so a fresh install looks finished and the user
 * can still drag the controls under 插件 → 配置.
 */
export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('显示壁纸').volatile(),
  theme: Schema.union(themes).default('auto').description('海洋时刻（auto 随系统时间）').volatile(),
  composition: Schema.union(compositions).default('balanced').description('海天比例').volatile(),
  brightness: Schema.percent().default(0.97).description('壁纸亮度').volatile(),
  saturation: Schema.number().step(0.01).min(0.3).max(1.15).role('slider').default(1.11).description('壁纸饱和度').volatile(),
  blur: Schema.number().min(0).max(4).step(0.1).default(0.3).description('壁纸柔化（px）').volatile(),
  quiet: Schema.boolean().default(true).description('安静游动').volatile(),
  paused: Schema.boolean().default(false).description('暂停动画').volatile(),
});

/**
 * Tell the Host that this bundle ships a hand-written configuration page, so no
 * client should try to generate one from {@link Config}. That contribution does
 * not change the bundle's Config: the forms still come from the schema above.
 */
function applySettingsPresentation(ctx) {
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), 'whalepaper: hand-written configuration page');
  });
}

/** Only files listed by our build manifest are exposed. */
export async function createAssetHandler(assetRoot = root) {
  const files = new Set(JSON.parse(await readFile(resolve(assetRoot, 'asset-manifest.json'), 'utf8')));
  return async (req, res) => {
    const finish = (status, headers = {}, body) => { res.writeHead(status, { 'x-content-type-options': 'nosniff', ...headers }); res.end(body); };
    if (req.method !== 'GET' && req.method !== 'HEAD') { finish(405, { allow: 'GET, HEAD' }); return; }
    let path;
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? prefix, 'http://localhost').pathname);
      if (pathname !== prefix && !pathname.startsWith(prefix + '/')) { finish(404); return; }
      path = pathname.slice(prefix.length).replace(/^\/+/, '') || 'index.html';
    } catch { finish(400); return; }
    if (!files.has(path)) { finish(404); return; }
    try {
      const data = await readFile(resolve(assetRoot, path));
      finish(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'content-length': String(data.length),
        'cache-control': path.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' }, req.method === 'HEAD' ? undefined : data);
    } catch { finish(404); }
  };
}

export async function apply(ctx) {
  applySettingsPresentation(ctx);
  const handler = await createAssetHandler();
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: prefix, handler }), 'whalepaper: packaged wallpaper assets');
}
