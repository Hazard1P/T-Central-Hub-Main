export function buildPayPalSdkSrc({ clientId, currency, mode }) {
  const params = new URLSearchParams({ 'client-id': clientId, components: 'buttons', currency });
  if (mode === 'subscription') { params.set('vault', 'true'); params.set('intent', 'subscription'); }
  else params.set('intent', 'capture');
  return `https://www.paypal.com/sdk/js?${params}`;
}

// Share an in-progress load. Each SDK configuration has its own namespace so
// changing frequency cannot replace an SDK which is still serving an open flow.
export function createPayPalSdkLoader({ document, window, timeoutMs = 15000 }) {
  const loads = new Map(); let sequence = 0;
  return function load(options) {
    const src = buildPayPalSdkSrc(options);
    if (loads.has(src)) return loads.get(src);
    const namespace = 'tcentralPayPal' + (++sequence);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let timer, settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); script.remove(); loads.delete(src);
        reject(new Error('PayPal could not load. Retry checkout or use the direct PayPal link below. No payment was submitted here.'));
      };
      script.src = src; script.async = true; script.setAttribute('data-namespace', namespace);
      script.onload = () => {
        if (settled) return;
        if (typeof window[namespace]?.Buttons !== 'function') { fail(); return; }
        settled = true; clearTimeout(timer); resolve(window[namespace]);
      };
      script.onerror = fail;
      timer = setTimeout(fail, timeoutMs);
      document.body.appendChild(script);
    });
    loads.set(src, promise);
    return promise;
  };
}
let browserLoader;
export function loadPayPalSdk(options) {
  browserLoader ||= createPayPalSdkLoader({ document, window });
  return browserLoader(options);
}
