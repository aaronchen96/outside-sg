export async function api<T>(
  path: string,
  init: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    signal: init.signal,
    credentials: "omit",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.detail ||
        error?.title ||
        `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.json();
}
