/**
 * System prompt assembly for Claude.
 *
 * Loads data/system_prompt.md, appends the compacted semantic catalog,
 * and returns system blocks with cache_control markers set for prompt
 * caching.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCatalogForSystemPrompt } from "./catalog";

let cachedBase: string | null = null;

function loadBase(): string {
  if (cachedBase) return cachedBase;
  cachedBase = readFileSync(
    join(process.cwd(), "data", "system_prompt.md"),
    "utf-8"
  );
  return cachedBase;
}

export function buildSystemPrompt(): Array<{
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}> {
  const base = loadBase();
  const catalogJson = getCatalogForSystemPrompt();

  return [
    {
      type: "text",
      text: base,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `\n\n## Live Semantic Catalog\n\nAuthoritative registry of available data layers for Hillsborough County, FL.\n\n\`\`\`json\n${catalogJson}\n\`\`\``,
      cache_control: { type: "ephemeral" },
    },
  ];
}
