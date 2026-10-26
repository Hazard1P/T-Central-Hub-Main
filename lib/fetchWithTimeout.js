// Compatible with mobile browsers that have AbortController but no
// AbortSignal.timeout/any. Caller cancellation and our timeout share a signal.
export async function fetchWithTimeout(input, init = {}, timeoutMs = 8000) {
  const controller = new AbortController(),
    caller = init.signal;
  const abort = () => controller.abort();
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener("abort", abort);
  }
}
