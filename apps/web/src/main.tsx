import "@throughline/tokens/fonts";
import "./styles/app.css";
import "./theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { config } from "./app/config";

async function boot() {
  if (config.useMocks) {
    const { startMockApi } = await import("./mocks/browser");
    await startMockApi();
  }
  const root = document.getElementById("root");
  if (!root) throw new Error("#root is missing from index.html");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
