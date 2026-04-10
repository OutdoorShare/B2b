import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Global fetch credential injection ─────────────────────────────────────────
// Automatically include cookies on every API request so httpOnly session
// cookies are sent without needing credentials: 'include' on each call site.
const _fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  if (url.includes("/api/")) {
    init = { credentials: "include", ...init };
  }
  return _fetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
