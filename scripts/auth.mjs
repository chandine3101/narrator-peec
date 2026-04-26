#!/usr/bin/env node
// scripts/auth.mjs
//
// Performs the one-time OAuth handshake with the Peec MCP server and stores the
// resulting access token in .peec-session.json (gitignored). After this runs,
// scripts/agent.mjs can refresh data without prompting again until the token
// expires.
//
// Flow:
//   1. Connect to https://api.peec.ai/mcp (no auth - only meta tools available).
//   2. Call `authenticate` → server returns an OAuth authorization URL.
//   3. Spin up a local HTTP listener on the redirect port to capture the
//      callback URL Peec sends after the user signs in.
//   4. Open the URL in the user's default browser. They sign in once.
//   5. Capture the redirect URL from our local listener.
//   6. Call `complete_authentication({ callback_url })` → server returns a
//      session/access token.
//   7. Persist `{ access_token, obtained_at }` to .peec-session.json.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const SESSION_FILE = path.join(ROOT, ".peec-session.json");
const PEEC_MCP_URL = "https://api.peec.ai/mcp";

function openInBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", '""', url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function extractText(toolResult) {
  // MCP tool results can be either a single content array or wrapped in `content`.
  const content = toolResult?.content || toolResult || [];
  if (!Array.isArray(content)) return JSON.stringify(toolResult);
  return content
    .map((b) => (b.type === "text" ? b.text : JSON.stringify(b)))
    .join("\n");
}

function findUrlIn(text) {
  const m = text.match(/https?:\/\/[^\s<>'"]+/);
  return m ? m[0] : null;
}

function findCallbackPort(authUrl) {
  // Peec emits a redirect_uri pointing at http://localhost:<port>/callback.
  // Parse the redirect_uri parameter and return the port.
  try {
    const u = new URL(authUrl);
    const redirect = u.searchParams.get("redirect_uri");
    if (!redirect) return null;
    const r = new URL(redirect);
    return r.port ? Number(r.port) : null;
  } catch {
    return null;
  }
}

async function captureCallback(port, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const fullUrl = `http://localhost:${port}${req.url}`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body style=\"font-family:system-ui;padding:40px;text-align:center\"><h2>Peec authentication received.</h2><p>You can close this tab and return to the terminal.</p></body></html>"
      );
      server.close();
      resolve(fullUrl);
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1");
    setTimeout(() => {
      server.close();
      reject(new Error(`Auth callback timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });
}

async function main() {
  console.log("\nNarrator · authenticating with Peec MCP\n");

  const client = new Client({ name: "narrator-auth", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(PEEC_MCP_URL));
  await client.connect(transport);

  const tools = await client.listTools();
  const hasAuth = tools.tools.some((t) => t.name === "authenticate");
  if (!hasAuth) {
    console.log(
      "Peec MCP did not expose an `authenticate` tool. The connection may already be authenticated, or this MCP build does not require explicit auth.",
    );
    console.log("Existing tools:", tools.tools.map((t) => t.name).join(", "));
    await client.close();
    process.exit(0);
  }

  console.log("→ Calling `authenticate` …");
  const authStart = await client.callTool({ name: "authenticate", arguments: {} });
  const authText = extractText(authStart);
  const authUrl = findUrlIn(authText);

  if (!authUrl) {
    console.error("Could not find an authorization URL in the response.");
    console.error("Raw response:\n", authText);
    await client.close();
    process.exit(1);
  }

  const port = findCallbackPort(authUrl);
  if (!port) {
    console.error(
      "Could not find a callback port in the auth URL. Ensure the redirect_uri uses http://localhost:<port>/callback.",
    );
    console.error("Auth URL:", authUrl);
    await client.close();
    process.exit(1);
  }

  console.log(`→ Listening for the callback on http://localhost:${port}/callback …`);
  console.log("→ Opening your browser …");
  console.log("  If it doesn't open, paste this URL manually:\n");
  console.log("  " + authUrl + "\n");

  const callbackPromise = captureCallback(port).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
  openInBrowser(authUrl);
  const callbackUrl = await callbackPromise;

  console.log("→ Captured callback. Completing authentication …");
  const complete = await client.callTool({
    name: "complete_authentication",
    arguments: { callback_url: callbackUrl },
  });
  const completeText = extractText(complete);

  // Try to find an access token in the response. Different servers may format
  // it differently - we save the full text as a fallback.
  let accessToken = null;
  const jsonMatch = completeText.match(/\{[\s\S]+\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      accessToken =
        parsed.access_token ||
        parsed.token ||
        parsed.accessToken ||
        parsed.authorization_token ||
        null;
    } catch {
      // ignore, fall through
    }
  }
  if (!accessToken) {
    const tokenMatch = completeText.match(/[A-Za-z0-9_\-\.]{40,}/);
    accessToken = tokenMatch ? tokenMatch[0] : null;
  }

  if (!accessToken) {
    console.error(
      "Authentication completed but no access token could be extracted. Raw response:\n",
    );
    console.error(completeText);
    console.error(
      "\nIf Peec's MCP keeps the session server-side without returning a token, you'll need to run the agent from inside Claude Code/Desktop where the session is held by the connector. See REFRESH.md for that flow.",
    );
    await client.close();
    process.exit(1);
  }

  await fs.writeFile(
    SESSION_FILE,
    JSON.stringify(
      { access_token: accessToken, obtained_at: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`✓ Saved access token to ${path.relative(ROOT, SESSION_FILE)}`);
  console.log("✓ You can now run `npm run refresh` to regenerate the dashboard.");
  await client.close();
}

main().catch((err) => {
  console.error("\nAuthentication failed:", err?.message || err);
  process.exit(1);
});
