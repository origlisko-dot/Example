import { buildOrchestrator } from "./orchestratorApp.js";
import { startServer } from "./server.js";

export { buildOrchestrator } from "./orchestratorApp.js";

try {
  startServer(buildOrchestrator());
} catch (e) {
  console.error(`orchestrator config error: ${(e as Error).message}`);
  process.exit(1);
}
