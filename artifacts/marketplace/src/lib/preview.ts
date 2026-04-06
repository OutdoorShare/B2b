const KEY = "os_marketplace_preview";

export function initPreviewMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("preview") === "true") {
    sessionStorage.setItem(KEY, "true");
    return true;
  }
  return sessionStorage.getItem(KEY) === "true";
}

export function isPreviewMode(): boolean {
  return sessionStorage.getItem(KEY) === "true";
}

export function clearPreviewMode(): void {
  sessionStorage.removeItem(KEY);
}
