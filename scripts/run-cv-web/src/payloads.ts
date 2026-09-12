// What a human's terminal needs, fetched only once someone types their name.
//
// This is the file that makes the page anonymous: everything here would
// otherwise be inlined into `terminal.js` by the `virtual:run-cv-files` loader
// in `shims-plugin.ts`, where a single `curl` would hand over both CVs.
import path from "node:path";
import { hashHuman } from "../shared/human-hash.js";
import type { HumanFiles } from "./human-files.js";

export interface HumanPayload {
  /** The name, so a shared `?h=` link can boot without the visitor typing it. */
  human: string;
  /** `{ virtualPath: contents }`, ready for `Volume.fromJSON`. */
  files: HumanFiles;
  /** Filenames served under `<hash>/pdf/`. */
  pdfs: string[];
}

export interface PayloadPlan extends HumanPayload {
  /** Directory name under `payloadDir`, i.e. the hash of the human's name. */
  hash: string;
}

/**
 * Pure: pairs each human with their hash and their files. Writing the result is
 * `main.ts`'s job, mirroring how `licences.ts` splits collecting from
 * rendering.
 */
export async function planPayloads(
  filesByHuman: ReadonlyMap<string, HumanFiles>,
  pdfsByHuman: ReadonlyMap<string, readonly string[]>,
  salt: string,
): Promise<PayloadPlan[]> {
  const plans: PayloadPlan[] = [];
  for (const [human, files] of filesByHuman) {
    plans.push({
      hash: await hashHuman(human, salt),
      human,
      files,
      pdfs: [...(pdfsByHuman.get(human) ?? [])],
    });
  }
  return plans;
}

/** Every PDF a human's menu can ask for, by the basename run-cv will request. */
export function pdfsFor(human: string, available: readonly string[]): string[] {
  const prefix = `${human.toLowerCase()}-`;
  return available.filter((file) => path.basename(file).toLowerCase().startsWith(prefix)).sort();
}
