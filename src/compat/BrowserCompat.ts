import type { BrowserType } from '@type/index';

export class BrowserCompat {
  private static instance: BrowserCompat;
  private _browser: BrowserType;
  private _manifestVersion: 2 | 3;

  private constructor() {
    this._browser = this.detectBrowser();
    this._manifestVersion = this.detectManifestVersion();
  }

  static getInstance(): BrowserCompat {
    if (!BrowserCompat.instance) {
      BrowserCompat.instance = new BrowserCompat();
    }
    return BrowserCompat.instance;
  }

  private detectBrowser(): BrowserType {
    if (typeof navigator === 'undefined') {
      return 'chrome';
    }

    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('firefox')) {
      return 'firefox';
    }
    if (ua.includes('edg')) {
      return 'edge';
    }
    if (ua.includes('brave')) {
      return 'brave';
    }

    return 'chrome';
  }

  private detectManifestVersion(): 2 | 3 {
    return 3;
  }

  get browser(): BrowserType {
    return this._browser;
  }

  get manifestVersion(): 2 | 3 {
    return this._manifestVersion;
  }

  isFirefox(): boolean {
    return this._browser === 'firefox';
  }

  isChromium(): boolean {
    return ['chrome', 'edge', 'brave', 'chromium'].includes(this._browser);
  }

  get supportsServiceWorkers(): boolean {
    return !this.isFirefox() || this._manifestVersion === 3;
  }

  get supportsESModules(): boolean {
    return !this.isFirefox();
  }

  getBrowserName(): string {
    const names: Record<BrowserType, string> = {
      chrome: 'Chrome',
      firefox: 'Firefox',
      edge: 'Edge',
      brave: 'Brave',
      chromium: 'Chromium',
    };
    return names[this._browser];
  }
}
