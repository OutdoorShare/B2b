/**
 * Shared API helper for all superadmin pages.
 *
 * IMPORTANT: Superadmin pages are served under /superadmin which means
 * import.meta.env.BASE_URL resolves to "/superadmin/". Using that as a
 * prefix for API calls results in /superadmin/api/... which the Replit
 * proxy routes to the vite dev server (404) rather than the API server.
 *
 * Always call /api/... directly — the Replit proxy routes that prefix
 * straight to the API server on port 8080 regardless of the page path.
 */

export async function saApiFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
}
