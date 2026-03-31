export function getAdminSession(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("admin_session");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getAdminSlug(): string {
  const s = getAdminSession();
  return s?.tenantSlug ?? "";
}

export function adminPath(path: string): string {
  const slug = getAdminSlug();
  return slug ? `/${slug}/admin${path}` : `/admin${path}`;
}
