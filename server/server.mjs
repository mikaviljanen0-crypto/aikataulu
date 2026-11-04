import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, companyId, COMPANIES, StoreError } from "./store.mjs";

const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = resolve(process.env.SNEDO_AIKATAULU_DATA_DIR || join(defaultRoot, "server-data"));
const staticDir = resolve(process.env.SNEDO_AIKATAULU_OUT_DIR || join(defaultRoot, "out"));
const host = process.env.SNEDO_AIKATAULU_HOST || "127.0.0.1";
const port = Number(process.env.SNEDO_AIKATAULU_PORT || 4183);
const secret = process.env.TJT_PORTAL_SCHEDULE_SECRET;

if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error("TJT_PORTAL_SCHEDULE_SECRET must be set (at least 32 bytes). Never publish the server without portal authentication.");
}

const store = createStore(dataDir, { strict: process.env.SNEDO_STRICT_STORAGE === "1" });
const basePath = "/aikataulu";
const maxBody = 5_500_000;

function auth(request) {
  const token = request.headers["x-tjt-schedule-context"];
  const signature = request.headers["x-tjt-schedule-signature"];
  if (typeof token !== "string" || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw new StoreError(401, "Kirjautuminen vaaditaan.");
  }
  const expected = createHmac("sha256", secret).update(token).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new StoreError(401, "Virheellinen kirjautuminen.");
  let context;
  try { context = JSON.parse(Buffer.from(token, "base64url").toString("utf8")); } catch { throw new StoreError(401, "Virheellinen kirjautuminen."); }
  if (!context || !companyId(context.companyId) || !context.userId || !context.userName ||
      !["read", "edit", "admin"].includes(context.role) ||
      !Number.isSafeInteger(context.expiresAt) || context.expiresAt < Date.now() || context.expiresAt > Date.now() + 120_000) {
    throw new StoreError(401, "Kirjautuminen on vanhentunut tai virheellinen.");
  }
  return context;
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(body);
}

async function bodyJson(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk); size += chunk.length;
    if (size > maxBody) throw new StoreError(413, "Liian suuri tiedosto.");
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new StoreError(400, "Virheellinen JSON."); }
}

async function api(request, response, pathname) {
  const actor = auth(request);
  const company = actor.companyId;
  const method = request.method || "GET";
  const route = pathname.slice(`${basePath}/api`.length).split("/").filter(Boolean);
  const editable = actor.role === "edit" || actor.role === "admin";
  if (route.length === 1 && route[0] === "context" && method === "GET") {
    return json(response, 200, { companyId: company, companyName: COMPANIES[company], userId: actor.userId, userName: actor.userName, role: actor.role });
  }
  if (route[0] !== "projects") throw new StoreError(404, "Tuntematon osoite.");
  if (route.length === 1 && method === "GET") return json(response, 200, { projects: await store.list(company) });
  if (route.length === 1 && method === "POST") {
    if (!editable) throw new StoreError(403, "Ei muokkausoikeutta.");
    const data = await bodyJson(request);
    return json(response, 201, await store.create(company, actor, data));
  }
  const id = route[1];
  if (!id || !/^[a-zA-Z0-9-]{1,90}$/.test(id)) throw new StoreError(404, "Tuntematon projekti.");
  if (route.length === 2 && method === "GET") return json(response, 200, await store.get(company, id));
  if (route.length === 2 && method === "PUT") {
    if (!editable) throw new StoreError(403, "Ei muokkausoikeutta.");
    const payload = await bodyJson(request);
    return json(response, 200, await store.update(company, id, actor, payload.expectedRevision, payload.data));
  }
  if (route.length === 3 && route[2] === "lock") {
    if (method === "POST") {
      if (!editable) throw new StoreError(403, "Ei muokkausoikeutta.");
      const options = await bodyJson(request);
      return json(response, 200, { lock: await store.acquire(company, id, actor, actor.role === "admin" && options.takeover === true) });
    }
    if (method === "DELETE") return json(response, 200, { lock: await store.release(company, id, actor, actor.role === "admin") });
  }
  throw new StoreError(404, "Tuntematon osoite.");
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
async function staticFile(response, pathname) {
  const relative = pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
  if (relative.includes("..") || relative.includes("\\") || relative.startsWith(".")) throw new StoreError(404, "Tiedostoa ei löytynyt.");
  let file = resolve(staticDir, normalize(relative));
  if (!file.startsWith(staticDir + sep) && file !== staticDir) throw new StoreError(404, "Tiedostoa ei löytynyt.");
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const data = await readFile(file);
    response.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream", "x-content-type-options": "nosniff", "cache-control": "no-cache" });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new StoreError(404, "Tiedostoa ei löytynyt.");
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (!pathname.startsWith(basePath + "/") && pathname !== basePath) throw new StoreError(404, "Tuntematon osoite.");
    // Authenticate static HTML as well. The portal must proxy this service and set signed identity headers.
    if (pathname.startsWith(`${basePath}/api/`)) return await api(request, response, pathname);
    auth(request);
    if (request.method !== "GET" && request.method !== "HEAD") throw new StoreError(405, "Menetelmä ei ole sallittu.");
    return await staticFile(response, pathname);
  } catch (error) {
    json(response, error instanceof StoreError ? error.status : 500, { error: error instanceof StoreError ? error.message : "Palvelinvirhe.", ...(error instanceof StoreError ? error.details : {}) });
    if (!(error instanceof StoreError)) console.error(error);
  }
});

server.listen(port, host, () => console.log(`Snedo Aikataulu v1.6 listening on http://${host}:${port}${basePath}`));

