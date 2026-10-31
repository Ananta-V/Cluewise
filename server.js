import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./api/[...route].js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:" + PORT}`);
  let pathname = parsedUrl.pathname;

  // Route API requests to the serverless API handler
  if (pathname.startsWith("/api/") || pathname === "/api") {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("API Error:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  // Rewrites
  if (pathname === "/admin117" || pathname === "/admin117/" || pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  // Static files in public
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    fs.createReadStream(filePath).pipe(res);
  });
});

let currentPort = PORT;

function startServer(port) {
  currentPort = port;
  server.listen(port, () => {
    console.log(`\n  ======================================================`);
    console.log(`  Cluewise running at: http://localhost:${port}`);
    console.log(`  Admin dashboard:     http://localhost:${port}/admin`);
    console.log(`  Initial password:    12345`);
    console.log(`  ======================================================\n`);
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
    startServer(currentPort + 1);
  } else {
    console.error("Server error:", err);
  }
});

startServer(PORT);

