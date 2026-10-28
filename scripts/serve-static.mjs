// Tarjoaa valmiiksi käännetyn Snedo Aikataulun ilman Next.js-kehityspalvelinta.
// Käyttö: node24.exe scripts/serve-static.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "out");
const port = Number(process.env.PORT || 3000);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Valmista out/index.html-tiedostoa ei löydy.");
  console.error("Lataa CI:n Snedo-Aikataulu-offline-artifact ja pura sen sisältö out-kansioon.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
    const relative = pathname.endsWith("/") ? pathname + "index.html" : pathname;
    let target = path.resolve(root, "." + relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (!fs.existsSync(target) && !path.extname(target)) target += ".html";
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("Snedo Aikataulu – valmiiksi käännetty versio");
  console.log("Avaa: http://localhost:" + port);
  console.log("Pysäytä Ctrl+C. Työmaatiedot säilyvät selaimessasi.");
});
