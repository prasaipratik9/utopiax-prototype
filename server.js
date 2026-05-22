const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const CONTENT_FILE = path.join(ROOT, "content.json");
const CONFIG_FILE = path.join(ROOT, "config.json");
const sessions = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2e6) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("utopiax_session="));
  return cookie ? cookie.split("=")[1] : null;
}

function isAuthed(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) return false;
  const session = sessions.get(token);
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function send(res, status, data, extraHeaders = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": typeof data === "string" && !data.startsWith("{") && !data.startsWith("[")
      ? "text/plain; charset=utf-8"
      : "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(body);
}

function serveStatic(filePath, res) {
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === "/api/content" && req.method === "GET") {
      send(res, 200, readJson(CONTENT_FILE));
      return;
    }

    if (pathname === "/api/content" && req.method === "PUT") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "Unauthorized" });
        return;
      }
      const body = await parseBody(req);
      writeJson(CONTENT_FILE, body);
      send(res, 200, { ok: true, message: "Content saved." });
      return;
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await parseBody(req);
      const config = readJson(CONFIG_FILE);
      if (body.username === config.adminUser && body.password === config.adminPassword) {
        const token = crypto.randomBytes(32).toString("hex");
        const hours = config.sessionHours || 24;
        sessions.set(token, {
          user: config.adminUser,
          expires: Date.now() + hours * 60 * 60 * 1000,
        });
        send(res, 200, { token, user: config.adminUser });
        return;
      }
      send(res, 401, { error: "Invalid username or password" });
      return;
    }

    if (pathname === "/api/auth/me" && req.method === "GET") {
      if (!isAuthed(req)) {
        send(res, 401, { error: "Unauthorized" });
        return;
      }
      const token = getToken(req);
      send(res, 200, { user: sessions.get(token).user });
      return;
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      const token = getToken(req);
      if (token) sessions.delete(token);
      send(res, 200, { ok: true });
      return;
    }

    let filePath = path.join(ROOT, pathname === "/" ? "index.html" : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStatic(filePath, res);
      return;
    }

    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, 500, { error: e.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`UtopiaX running at http://localhost:${PORT}`);
  console.log(`Admin CMS at http://localhost:${PORT}/admin/`);
});
