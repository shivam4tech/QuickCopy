import { readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const DIST_CHROME = resolve(ROOT, 'dist');
const DIST_FIREFOX = resolve(ROOT, 'dist-firefox');

function buildForFirefox(): void {
  console.log('Building for Chrome first...');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  if (!existsSync(DIST_CHROME)) {
    throw new Error('Chrome build not found at dist/');
  }

  if (existsSync(DIST_FIREFOX)) {
    rmSync(DIST_FIREFOX, { recursive: true });
  }

  cpSync(DIST_CHROME, DIST_FIREFOX, { recursive: true });

  // Bundle background script into a single IIFE file for Firefox
  execSync(
    `npx esbuild service-worker-loader.js --bundle --format=iife --global-name=QuickCopyBackground --outfile=background.js`,
    { cwd: DIST_FIREFOX, stdio: 'inherit' },
  );

  // Remove files replaced by bundled background.js
  rmSync(resolve(DIST_FIREFOX, 'service-worker-loader.js'));

  // Patch manifest for Firefox compatibility
  const manifestPath = resolve(DIST_FIREFOX, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // Firefox uses background.scripts (classic scripts), not service_worker
  manifest.background = { scripts: ['background.js'] };

  // Add Firefox-specific settings
  manifest.browser_specific_settings = {
    gecko: {
      id: 'helloquickcopy@gmail.com',
      strict_min_version: '121.0',
      data_collection_permissions: {
        required: ['none'],
      },
    },
  };

  // Remove Chrome-only keys
  delete manifest.minimum_chrome_version;

  // Remove permissions that Firefox doesn't support
  if (manifest.permissions) {
    manifest.permissions = manifest.permissions.filter(
      (p: string) => p !== 'commands' && p !== 'contextMenus' && p !== 'offscreen',
    );
  }

  // Remove use_dynamic_url from web_accessible_resources (Firefox doesn't support it)
  if (manifest.web_accessible_resources) {
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(
      (entry: Record<string, unknown>) => {
        const clean = { ...entry };
        delete clean.use_dynamic_url;
        return clean;
      },
    );
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Firefox build complete at dist-firefox/');
}

buildForFirefox();
