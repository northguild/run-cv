// Order matters twice over. The terminal and the process bridge must exist
// before run-cv's CLI evaluates, because it renders as soon as it is imported —
// and under the gate the CLI must not evaluate until a name has been typed and
// the filesystem seeded, which is why the import is dynamic rather than static.
import { runGate } from "./gate.js";
import "./setup.js";

await runGate();
await import("run-cv-program");
