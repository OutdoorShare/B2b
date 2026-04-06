import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPreviewMode } from "./lib/preview";

initPreviewMode();

createRoot(document.getElementById("root")!).render(<App />);
