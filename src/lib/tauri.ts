/**
 * Tauri invoke wrapper
 * Lazily initializes the invoke function from @tauri-apps/api/core
 */

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getInvoke(): Promise<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>> {
  if (_invoke) return _invoke;

  // In Tauri v2 the runtime exposes window.__TAURI_INTERNALS__. When running in a
  // plain browser (e.g. Vite dev server without the desktop shell), that global is
  // absent and @tauri-apps/api/core's invoke() throws at call time, so use a mock.
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (inTauri) {
    try {
      const mod = await import('@tauri-apps/api/core');
      if (typeof mod.invoke === 'function') {
        _invoke = mod.invoke;
        return _invoke;
      }
    } catch {
      // fall through to the mock below
    }
  }

  // Fallback for browser dev (no Tauri runtime available). Only the commands the
  // first-run flow needs return values; everything else rejects so the app's own
  // `.catch()`/try-catch error handling keeps working exactly as it does against
  // a real (absent) backend.
  _invoke = async (cmd: string, args?: Record<string, unknown>) => {
    console.log(`[Tauri Mock] ${cmd}`, args);

    if (cmd === 'create_company') {
      return {
        id: 1,
        name: (args?.name as string) ?? 'شرکت پیش‌فرض',
        nationalId: (args?.nationalId as string) ?? null,
        economicCode: (args?.economicCode as string) ?? null,
        fiscalYearStart: '01/01',
        createdAt: new Date().toISOString(),
      };
    }

    if (cmd === 'get_companies') {
      return [];
    }

    throw new Error(`[Tauri Mock] command not available without the desktop runtime: ${cmd}`);
  };
  return _invoke;
}

export async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const fn = await getInvoke();
  return fn(cmd, args) as Promise<T>;
}
