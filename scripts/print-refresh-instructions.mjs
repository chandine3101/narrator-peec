#!/usr/bin/env node
// Points the user at REFRESH.md - the canonical Peec MCP refresh prompt.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const promptPath = resolve(here, "..", "REFRESH.md");
const prompt = readFileSync(promptPath, "utf8");

const sep = "─".repeat(72);

console.log(`
${sep}
Narrator - refresh data from Peec MCP
${sep}

This project ships a canonical prompt at REFRESH.md that regenerates
dashboard/data.json directly from your Peec AI account.

How to run it:

  1. Open Claude Code (or Claude Desktop) in this project directory.
  2. Make sure the Peec AI MCP connector is enabled.
     (see .mcp.json or the Connectors menu)
  3. Paste the prompt from REFRESH.md into a new Claude message.
  4. Claude will call the Peec tools and overwrite dashboard/data.json.

Prompt location: ${promptPath}

Then reload http://localhost:8080 to see your own brand's data.

${sep}
`);

if (process.argv.includes("--print")) {
  console.log(prompt);
}
