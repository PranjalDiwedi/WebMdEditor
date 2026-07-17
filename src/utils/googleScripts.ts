declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export function loadGisClient(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Identity Services')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gis = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export function loadGapiClient(): Promise<void> {
  if (window.gapi?.client) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gapi="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        window.gapi.load('client', () => resolve());
      }, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google API')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.gapi = 'true';
    script.onload = () => {
      window.gapi.load('client', () => resolve());
    };
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.head.appendChild(script);
  });
}

let driveClientReady: Promise<void> | null = null;

export function initDriveClient(apiKey?: string): Promise<void> {
  if (driveClientReady) {
    return driveClientReady;
  }

  driveClientReady = (async () => {
    await loadGapiClient();

    const initOptions: { discoveryDocs: string[]; apiKey?: string } = {
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    };

    // Empty string breaks gapi init — only pass a real API key
    if (apiKey) {
      initOptions.apiKey = apiKey;
    }

    await window.gapi.client.init(initOptions);
  })().catch((error) => {
    driveClientReady = null;
    throw error;
  });

  return driveClientReady;
}
