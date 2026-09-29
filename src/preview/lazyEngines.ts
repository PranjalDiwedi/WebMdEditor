/**
 * Lazy Engines for Mandrak:
 * Dynamically loads Mermaid.js and KaTeX ONLY when diagrams or math formulas are detected in preview.
 * 100% CSP-Safe DOM Script Injection (No eval, No new Function).
 * Initial cold bundle impact: 0 KB.
 */

declare global {
  interface Window {
    mermaid?: any;
    katex?: any;
  }
}

let mermaidLoadingPromise: Promise<any> | null = null;
let katexLoadingPromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already present
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

function loadStyleSheet(href: string, id: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

/**
 * Loads Mermaid engine on-demand via script tag
 */
async function getMermaidEngine(): Promise<any> {
  if (window.mermaid) return window.mermaid;
  if (mermaidLoadingPromise) return mermaidLoadingPromise;

  mermaidLoadingPromise = (async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js');
      if (window.mermaid) {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        return window.mermaid;
      }
      return null;
    } catch (err) {
      console.warn('Could not load Mermaid engine dynamically:', err);
      return null;
    }
  })();

  return mermaidLoadingPromise;
}

/**
 * Loads KaTeX engine on-demand via script tag
 */
async function getKaTeXEngine(): Promise<any> {
  if (window.katex) return window.katex;
  if (katexLoadingPromise) return katexLoadingPromise;

  katexLoadingPromise = (async () => {
    try {
      loadStyleSheet('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css', 'katex-css');
      await loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js');
      return window.katex || null;
    } catch (err) {
      console.warn('Could not load KaTeX engine dynamically:', err);
      return null;
    }
  })();

  return katexLoadingPromise;
}

/**
 * Renders all .mermaid-diagram containers inside a target DOM container
 */
export async function renderMermaidDiagrams(container: HTMLElement, isDark: boolean): Promise<void> {
  const elements = container.querySelectorAll<HTMLElement>('.mermaid-diagram:not([data-rendered="true"])');
  if (elements.length === 0) return;

  const mermaid = await getMermaidEngine();
  if (!mermaid) return;

  mermaid.initialize({
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: '#0f172a',
          primaryColor: '#3b82f6',
          primaryTextColor: '#f8fafc',
          lineColor: '#64748b',
        }
      : {
          darkMode: false,
          background: '#ffffff',
          primaryColor: '#2563eb',
          primaryTextColor: '#0f172a',
          lineColor: '#94a3b8',
        },
  });

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const code = el.getAttribute('data-mermaid') || el.textContent || '';
    const id = `mermaid-svg-${Date.now()}-${i}`;

    try {
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.setAttribute('data-rendered', 'true');
    } catch (err) {
      console.error('Mermaid render error:', err);
      el.innerHTML = `<div class="mermaid-error">⚠️ Diagram rendering error</div><pre>${code}</pre>`;
      el.setAttribute('data-rendered', 'true');
    }
  }
}

/**
 * Renders all .katex-block and .katex-inline containers inside a target DOM container
 */
export async function renderMathEquations(container: HTMLElement): Promise<void> {
  const elements = container.querySelectorAll<HTMLElement>('.katex-render:not([data-rendered="true"])');
  if (elements.length === 0) return;

  const katex = await getKaTeXEngine();
  if (!katex) return;

  elements.forEach((el) => {
    const math = el.getAttribute('data-math') || el.textContent || '';
    const isDisplay = el.classList.contains('katex-block');

    try {
      katex.render(math, el, {
        displayMode: isDisplay,
        throwOnError: false,
      });
      el.setAttribute('data-rendered', 'true');
    } catch (err) {
      console.error('KaTeX render error:', err);
      el.setAttribute('data-rendered', 'true');
    }
  });
}
