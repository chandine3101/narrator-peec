#!/usr/bin/env node
// scripts/agent.mjs
//
// Headless refresh: regenerate dashboard/data.json by orchestrating Claude over
// the Peec MCP. Reads .peec-session.json (created by `npm run auth`) and the
// REFRESH.md prompt, calls Anthropic's Messages API with Peec configured as an
// MCP server, parses the agent's structured output, and writes the result.
//
// Run:
//   ANTHROPIC_API_KEY=sk-... npm run refresh
//
// Optional env:
//   ANTHROPIC_MODEL    (default: claude-sonnet-4-5)
//   PEEC_ACCESS_TOKEN  (overrides .peec-session.json)
//   PEEC_MCP_URL       (default: https://api.peec.ai/mcp)

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const SESSION_FILE = path.join(ROOT, ".peec-session.json");
const REFRESH_PROMPT = path.join(ROOT, "REFRESH.md");
const DATA_OUT = path.join(ROOT, "dashboard", "data.json");
const REPORT_OUT = path.join(ROOT, "dashboard", "report.md");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const PEEC_MCP_URL = process.env.PEEC_MCP_URL || "https://api.peec.ai/mcp";

async function readToken() {
  if (process.env.PEEC_ACCESS_TOKEN) return process.env.PEEC_ACCESS_TOKEN;
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.access_token) return parsed.access_token;
  } catch {
    /* fall through */
  }
  console.error(
    "No Peec access token found. Run `npm run auth` first, or set PEEC_ACCESS_TOKEN in your environment.",
  );
  process.exit(1);
}

function extractFencedJson(text) {
  // Look for a ```json … ``` block; fall back to the largest top-level JSON object.
  const fenced = text.match(/```json\s*([\s\S]+?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is required. Get one at https://console.anthropic.com.",
    );
    process.exit(1);
  }

  const accessToken = await readToken();
  const refreshPrompt = await fs.readFile(REFRESH_PROMPT, "utf8");

  const client = new Anthropic();

  const userMessage =
    refreshPrompt +
    `

---

When you finish, return EXACTLY one fenced \`\`\`json\`\`\` block and nothing else. The block must contain:

{
  "data": { ...the full dashboard/data.json contents matching the schema in step 8 of the prompt above... },
  "report_md": "...a 500-700 word client-style markdown briefing of the same insights, ready to email...",
  "summary": "...one short sentence confirming the run, e.g. 'Refreshed HP for window Apr 17-23, alt index 50%, 4 chats classified.'"
}

Do not include any prose outside the fenced JSON block. Use the same key names exactly. The schema must validate.`;

  console.log("\nNarrator agent starting…");
  console.log(`  Model:    ${MODEL}`);
  console.log(`  Peec MCP: ${PEEC_MCP_URL}`);
  console.log(`  Output:   ${path.relative(ROOT, DATA_OUT)} + ${path.relative(ROOT, REPORT_OUT)}`);
  console.log("  Working… (typically 30-90s)\n");

  const t0 = Date.now();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["mcp-client-2025-04-04"],
    mcp_servers: [
      {
        type: "url",
        url: PEEC_MCP_URL,
        name: "peec",
        authorization_token: accessToken,
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const textBlocks = res.content.filter((b) => b.type === "text").map((b) => b.text);
  const fullText = textBlocks.join("\n");
  const jsonText = extractFencedJson(fullText);

  if (!jsonText) {
    console.error("Could not find a JSON block in the agent's response.");
    console.error("Raw response:\n", fullText.slice(0, 4000));
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (err) {
    console.error("Failed to parse the agent's JSON output:", err.message);
    console.error("Raw JSON:\n", jsonText.slice(0, 4000));
    process.exit(1);
  }

  if (!payload.data || typeof payload.data !== "object") {
    console.error("Agent output missing required `data` field.");
    process.exit(1);
  }

  await fs.writeFile(DATA_OUT, JSON.stringify(payload.data, null, 2) + "\n", "utf8");
  if (payload.report_md) {
    await fs.writeFile(REPORT_OUT, payload.report_md, "utf8");
  }

  console.log(`  ✓ Wrote ${path.relative(ROOT, DATA_OUT)}`);
  if (payload.report_md) {
    console.log(`  ✓ Wrote ${path.relative(ROOT, REPORT_OUT)}`);
  }
  console.log(`  ✓ Done in ${elapsed}s.`);
  if (payload.summary) console.log(`\n  ${payload.summary}`);
  console.log("\n  Dashboard: http://localhost:8080");
  console.log("  Report:    http://localhost:8080/report.html\n");
}

main().catch((err) => {
  console.error("\nAgent failed:", err?.message || err);
  if (err?.status) console.error("HTTP status:", err.status);
  process.exit(1);
});
