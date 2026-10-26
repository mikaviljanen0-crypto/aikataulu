import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 31337;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
let exited = false;
server.stdout.on("data", (part) => {
  output = (output + part.toString()).slice(-12000);
});
server.stderr.on("data", (part) => {
  output = (output + part.toString()).slice(-12000);
});
server.on("exit", () => {
  exited = true;
});

let lastIssue = "ei vastausta";
let passed = false;

try {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (exited) throw new Error("Next.js-palvelin pysähtyi yllättäen.");
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      if (res.ok && html.includes("snedo-shell") && html.includes("Snedo Aikataulu")) {
        passed = true;
        console.log("Windows localhost smoke test passed: GET / 200 and Snedo markup rendered.");
        break;
      }
      lastIssue = `HTTP ${res.status}; Snedo-markup: ${html.includes("snedo-shell")}`;
    } catch (error) {
      lastIssue = String(error);
    }
    await delay(1500);
  }
  if (!passed) {
    throw new Error(`Localhost page did not render: ${lastIssue}`);
  }
} catch (error) {
  console.error(String(error));
  console.error("Next.js output:\n" + output);
  process.exitCode = 1;
} finally {
  server.kill();
}
