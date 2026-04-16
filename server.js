const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const bcrypt_rounds = 12;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const app = express();
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const baseDir = __dirname;
const pagesDir = path.join(baseDir, "pages");
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use("/assets", express.static(path.join(baseDir, "assets")));

const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "SmartSpin",
  waitForConnections: true,
  connectionLimit: 10,
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(baseDir, "style.css"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(pagesDir, "index.html"));
});

app.get(/^\/(index|accounts|chat|image)\.html$/, (req, res) => {
  const page = req.params[0];
  res.sendFile(path.join(pagesDir, `${page}.html`));
});

async function createSession(accountId, email) {
  const sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await dbPool.query(
    `INSERT INTO Sessions (SessionToken, AccountID, ExpiresAt) VALUES (?, ?, ?)`,
    [sid, accountId, expiresAt]
  );
  return sid;
}

async function getSession(sid) {
  if (!sid) return null;
  const [rows] = await dbPool.query(
    `SELECT s.AccountID, a.Email, a.IsActive
     FROM Sessions s
     JOIN Accounts a ON a.AccountID = s.AccountID
     WHERE s.SessionToken = ? AND s.ExpiresAt > NOW()
     LIMIT 1`,
    [sid]
  );
  return rows[0] || null;
}

function parseCookies(header = "") {
  return header
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const i = pair.indexOf("=");
      if (i === -1) return acc;
      acc[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
      return acc;
    }, {});
}

function setSessionCookie(res, sid) {
  res.setHeader(
    "Set-Cookie",
    `sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function publicAccountRow(row) {
  if (!row) return null;
  return {
    AccountID: row.AccountID,
    Username: row.Username,
    Email: row.Email,
    CreatedAt: row.CreatedAt,
    LastLogin: row.LastLogin,
    IsActive: row.IsActive,
  };
}

app.post("/api/signup", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: "username, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: "password must be at least 6 characters" });
    }

    const [existing] = await dbPool.query(
      "SELECT AccountID FROM Accounts WHERE Email = ? LIMIT 1",
      [email]
    );
    if (existing.length) {
      return res.status(409).json({ ok: false, error: "email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, bcrypt_rounds);

    const [result] = await dbPool.query(
      `INSERT INTO Accounts (Username, Email, PasswordHash, IsActive)
       VALUES (?, ?, ?, 1)`,
      [username, email, passwordHash]
    );

    const newId = result.insertId;

    const [rows] = await dbPool.query(
      `SELECT AccountID, Username, Email, CreatedAt, LastLogin, IsActive
       FROM Accounts
       WHERE AccountID = ?
       LIMIT 1`,
      [newId]
    );

    const account = publicAccountRow(rows[0]);

    const sid = await createSession(newId, email);
    setSessionCookie(res, sid);

    return res.status(201).json({ ok: true, account });
  } catch (err) {
    console.error("Signup DB error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }

    const [rows] = await dbPool.query(
      `SELECT AccountID, Username, Email, PasswordHash, CreatedAt, LastLogin, IsActive
       FROM Accounts
       WHERE Email = ?
       LIMIT 1`,
      [email]
    );

    const row = rows[0];
    if (!row) {
      await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection000000000000000000000000");
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }
    if (!row.IsActive) {
      return res.status(403).json({ ok: false, error: "account disabled" });
    }

    const valid = await bcrypt.compare(password, row.PasswordHash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "invalid credentials" });
    }

    await dbPool.query("UPDATE Accounts SET LastLogin = CURRENT_TIMESTAMP WHERE AccountID = ?", [
      row.AccountID,
    ]);

    const sid = await createSession(row.AccountID, email);
    setSessionCookie(res, sid);

    const [fresh] = await dbPool.query(
      `SELECT AccountID, Username, Email, CreatedAt, LastLogin, IsActive
       FROM Accounts
       WHERE AccountID = ?
       LIMIT 1`,
      [row.AccountID]
    );

    return res.json({ ok: true, account: publicAccountRow(fresh[0]) });
  } catch (err) {
    console.error("Login DB error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.post("/api/logout", async (req, res) => {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (sid) await dbPool.query(`DELETE FROM Sessions WHERE SessionToken = ?`, [sid]);
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  try {
    const sid = parseCookies(req.headers.cookie || "").sid;
    const session = await getSession(sid);
    if (!session || !session.IsActive) {
      return res.json({ ok: true, loggedIn: false });
    }

    const [rows] = await dbPool.query(
      `SELECT AccountID, Username, Email, CreatedAt, LastLogin, IsActive
       FROM Accounts
       WHERE AccountID = ?
       LIMIT 1`,
      [session.AccountID]
    );

    const row = rows[0];
    if (!row) return res.json({ ok: true, loggedIn: false });
    if (!row.IsActive) return res.json({ ok: true, loggedIn: false });

    return res.json({ ok: true, loggedIn: true, account: publicAccountRow(row) });
  } catch (err) {
    console.error("Me DB error:", err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await dbPool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "error", error: err.code || "DB_ERROR" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`SmartSpin server running at http://${HOST}:${PORT}`);
});