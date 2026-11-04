import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

async function availablePort() {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

function identity(secret, companyId, role = "edit") {
  const context = Buffer.from(JSON.stringify({
    userId: "mika", userName: "Mika", companyId, role, expiresAt: Date.now() + 30_000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(context).digest("hex");
  return { "x-tjt-schedule-context": context, "x-tjt-schedule-signature": signature };
}

test("portal identity isolates company data and denies unauthenticated requests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "snedo-api-"));
  const secret = randomBytes(48).toString("hex");
  const port = await availablePort();
  await writeFile(join(directory, "index.html"), "<h1>Snedo</h1>");
  const child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, SNEDO_AIKATAULU_PORT: String(port), TJT_PORTAL_SCHEDULE_SECRET: secret,
      SNEDO_AIKATAULU_DATA_DIR: join(directory, "data"), SNEDO_AIKATAULU_OUT_DIR: directory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await Promise.race([
      once(child.stdout, "data"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Server did not start")), 6_000)),
    ]);
    const url = `http://127.0.0.1:${port}/aikataulu`;
    assert.equal((await fetch(url)).status, 401);
    const project = { version: 1, projectNumber: "2701", projectName: "Raudikkokuja", tasks: [{ id: 1, name: "A" }] };
    const create = await fetch(`${url}/api/projects`, { method: "POST", headers: identity(secret, "tjt"), body: JSON.stringify(project) });
    assert.equal(create.status, 201);
    const created = await create.json();
    const tjt = await fetch(`${url}/api/projects`, { headers: identity(secret, "tjt") });
    assert.equal((await tjt.json()).projects.length, 1);
    const previmek = await fetch(`${url}/api/projects`, { headers: identity(secret, "previmek") });
    assert.equal((await previmek.json()).projects.length, 0);
    const wrongTenant = await fetch(`${url}/api/projects/${created.id}`, { headers: identity(secret, "previmek") });
    assert.equal(wrongTenant.status, 404);
    const readonly = await fetch(`${url}/api/projects`, { method: "POST", headers: identity(secret, "tjt", "read"), body: JSON.stringify(project) });
    assert.equal(readonly.status, 403);
    const unsigned = await fetch(`${url}/api/context`, { headers: { ...identity(secret, "tjt"), "x-tjt-schedule-signature": "0".repeat(64) } });
    assert.equal(unsigned.status, 401);
    const html = await fetch(url, { headers: identity(secret, "tjt") });
    assert.equal(html.status, 200);
  } finally {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  }
});
