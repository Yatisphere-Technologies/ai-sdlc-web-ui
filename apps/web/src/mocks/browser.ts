import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export async function startMockApi() {
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  console.info("[mock-api] Serving /api from the in-browser mock (MSW)");
}
