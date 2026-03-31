const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const OpenAI = require("openai");

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
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const baseDir = __dirname;
const pagesDir = path.join(baseDir, "pages");
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const upload = multer({ dest: path.join(baseDir, "uploads") });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const GPT5_MINI_PRICING = {
  inputPer1M: 0.25,
  outputPer1M: 2.0
};

let runningOpenAICost = 0;

function estimateGpt5MiniCost(usage) {
  const inputTokens = usage?.input_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const totalTokens = usage?.total_tokens || inputTokens + outputTokens;

  const inputCost = (inputTokens / 1_000_000) * GPT5_MINI_PRICING.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * GPT5_MINI_PRICING.outputPer1M;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputCost,
    outputCost,
    totalCost
  };
}


app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use("/assets", express.static(path.join(baseDir, "assets")));
app.use("/Scripts", express.static(path.join(baseDir, "Scripts")));

const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "SmartSpin"
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(baseDir, "style.css"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(pagesDir, "index.html"));
});

app.get(/^\/(index|accounts|chat|about|image|contact)\.html$/, (req, res) => {
  const page = req.params[0];
  res.sendFile(path.join(pagesDir, `${page}.html`));
});

const sessions = new Map();
const accounts = new Map();
let nextAccountId = 1;

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

function publicAccount(a) {
  if (!a) return null;
  return {
    AccountID: a.AccountID,
    Username: a.Username,
    Email: a.Email,
    CreatedAt: a.CreatedAt,
    LastLogin: a.LastLogin,
    IsActive: a.IsActive
  };
}


/*******
 * 
 *    API FOR CHAT GPT
 * 
 */

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: "Message is required" });
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are SmartSpin, a laundry care assistant. Give safe, simple clothing care advice."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message
            }
          ]
        }
      ]
    });

    const usageInfo = estimateGpt5MiniCost(response.usage);
    runningOpenAICost += usageInfo.totalCost;

    console.log("OpenAI usage:", {
      model: "gpt-5-mini",
      inputTokens: usageInfo.inputTokens,
      outputTokens: usageInfo.outputTokens,
      totalTokens: usageInfo.totalTokens,
      inputCostUSD: usageInfo.inputCost.toFixed(6),
      outputCostUSD: usageInfo.outputCost.toFixed(6),
      totalCostUSD: usageInfo.totalCost.toFixed(6),
      runningTotalUSD: runningOpenAICost.toFixed(6)
    });

    return res.json({ ok: true, reply: response.output_text });
  } catch (error) {
    console.error("OpenAI chat error:", error);
    return res.status(500).json({ ok: false, error: "Chat failed" });
  }
});


/***
 * 
 * SIGN UP API
 * 
 */


app.post("/api/signup", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!username || !email || !password) {
    return res.status(400).json({ ok: false, error: "username, email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "password must be at least 6 characters" });
  }
  if (accounts.has(email)) {
    return res.status(409).json({ ok: false, error: "email already exists" });
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const account = {
    AccountID: nextAccountId++,
    Username: username,
    Email: email,
    Password: password,
    CreatedAt: now,
    LastLogin: now,
    IsActive: 1
  };
  accounts.set(email, account);

  const sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessions.set(sid, { email, expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(res, sid);
  return res.status(201).json({ ok: true, account: publicAccount(account) });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email and password are required" });
  }
  const account = accounts.get(email);
  if (!account) {
    return res.status(404).json({ ok: false, error: "account not found" });
  }
  if (account.Password !== password) {
    return res.status(401).json({ ok: false, error: "invalid credentials" });
  }
  account.LastLogin = new Date().toISOString().slice(0, 19).replace("T", " ");
  const sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessions.set(sid, { email, expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(res, sid);
  return res.json({ ok: true, account: publicAccount(account) });
});

app.post("/api/logout", (req, res) => {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (sid) sessions.delete(sid);
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (!sid) return res.json({ ok: true, loggedIn: false });
  const session = sessions.get(sid);
  if (!session || session.expiresAt <= Date.now()) {
    if (sid) sessions.delete(sid);
    return res.json({ ok: true, loggedIn: false });
  }
  const account = accounts.get(session.email);
  if (!account) return res.json({ ok: true, loggedIn: false });
  return res.json({ ok: true, loggedIn: true, account: publicAccount(account) });
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
