const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const bcrypt = require("bcrypt");
//const OpenAI = require("openai");

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
/*
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});*/

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

app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true, credentials: true }));
app.use("/assets", express.static(path.join(baseDir, "assets")));
app.use("/Scripts", express.static(path.join(baseDir, "Scripts")));
app.use(express.static(path.join(baseDir, "pages")));
app.get("/", (req, res) => res.redirect("/index.html"));

const dbPool = mysql.createPool({
  host: process.env.MYSQLHOST || "127.0.0.1",
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER || "smartadmin",
  password: process.env.MYSQLPASSWORD || "admin",
  database: process.env.MYSQLDATABASE || "SmartSpin"
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(baseDir, "style.css"));
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

async function getLoggedInAccountId(req) {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session || session.expiresAt <= Date.now()) {
    if (sid) sessions.delete(sid);
    return null;
  }
  // Look up AccountID from email
  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT AccountID FROM Accounts WHERE Email = ?",
      [session.email]
    );
    return rows.length > 0 ? rows[0].AccountID : null;
  } finally {
    connection.release();
  }
}


/*******
 * 
 *    API FOR CHAT GPT
 * 
 
    app.post("/api/chat", async (req, res) => {
      try {
        const message = String(req.body?.message || "").trim();
        const image = req.body?.image || null;
        const imageType = req.body?.imageType || "image/jpeg";

        if (!message && !image) {
          return res.status(400).json({ ok: false, error: "Message or image is required" });
        }

        const userContent = [];

        if (image) {
          userContent.push({
            type: "input_image",
            image_url: `data:${imageType};base64,${image}`  // ← plain string, not an object
          });
        }

        if (message) {
          userContent.push({
            type: "input_text",
            text: message
          });
        }

        const response = await openai.responses.create({
          model: "gpt-4o-mini",  // ← correct model name
          input: [
            {
              role: "system",
              content: "You are SmartSpin, a laundry care assistant. Give safe, simple clothing care advice."
            },
            {
              role: "user",
              content: userContent
            }
          ]
        });

        const usageInfo = estimateGpt5MiniCost(response.usage);
        runningOpenAICost += usageInfo.totalCost;

        return res.json({ ok: true, reply: response.output_text });
      } catch (error) {
        console.error("OpenAI chat error:", error);
        return res.status(500).json({ ok: false, error: "Chat failed" });
      }
    });*/


/***
 * 
 * SIGN UP API
 * 
 */


app.post("/api/signup", async (req, res) => {
  try{ 
    
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!username || !email || !password) {
    return res.status(400).json({ ok: false, error: "username, email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "password must be at least 6 characters" });
  }
  /*
  if (accounts.has(email)) {
    return res.status(409).json({ ok: false, error: "email already exists" });
  }*/
  
  /*
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
  */
  const connection = await dbPool.getConnection();
  try{
    const [existing] = await connection.execute("SELECT AccountID FROM Accounts WHERE Email = ?",[email]);
    if(existing.length>0){
      return res.status(409).json({ok:false,error:"email already exists"});
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      "INSERT INTO Accounts (Username, Email, PasswordHash, Salt, IsActive) VALUES (?, ?, ?, ?, 1)",
      [username, email, hash, "nosalt"]
    );
    const sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessions.set(sid, { email, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, sid);
    return res.status(201).json({ok: true,accountId: result.insertId});
  }finally{
    connection.release();
  }

  
  }catch(err){
    console.error("signup error:", err);
    return res.status(500).json({ ok:false,error:err.message});
  }
});

app.post("/api/login",async (req, res) => {
  try{
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "email and password are required" });
  }
  /*
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
});*/
      const connection = await dbPool.getConnection();
  try{
    const [rows] = await connection.execute("SELECT AccountID, Username, Email, PasswordHash, CreatedAt, LastLogin, IsActive FROM Accounts WHERE Email = ?",[email]);
    if(rows.length===0){
      return res.status(404).json({ok:false,error:"account not found"});
    }
const logAccount = rows[0];

    const match = await bcrypt.compare(password, logAccount.PasswordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: "incorrect password" });
    }
    const sid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessions.set(sid, { email, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, sid);
    return res.json({ok: true, account:publicAccount(logAccount) });
  }finally{
    connection.release();
  }

  }catch(err){
    return res.status(500).json({ok:false,error:err.message});
  }


});

app.post("/api/logout", (req, res) => {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (sid) sessions.delete(sid);
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const sid = parseCookies(req.headers.cookie || "").sid;
  if (!sid) return res.json({ ok: true, loggedIn: false });

  const session = sessions.get(sid);
  if (!session || session.expiresAt <= Date.now()) {
    if (sid) sessions.delete(sid);
    clearSessionCookie(res);
    return res.json({ ok: true, loggedIn: false });
  }

  //Fetch account data for the accoutns page
  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT AccountID, Username, Email, CreatedAt, LastLogin, IsActive FROM Accounts WHERE Email = ?",
      [session.email]
    );
    if (rows.length === 0) return res.json({ ok: true, loggedIn: false });
    return res.json({ ok: true, loggedIn: true, account: rows[0] });
  } finally {
    connection.release();
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

// GET all calendar loads for the logged-in user
app.get("/api/calendar", async (req, res) => {
  try {
    const accountId = await getLoggedInAccountId(req);
    if (!accountId) {
      return res.status(401).json({ ok: false, error: "not logged in" });
    }
    const connection = await dbPool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT LoadID, LoadDate, TypeID, Label, Notes FROM LaundryLoads WHERE AccountID = ? ORDER BY LoadDate",
        [accountId]
      );
      // Group by date to match the frontend's existing shape
      const grouped = {};
      for (const r of rows) {
        const date = r.LoadDate instanceof Date
          ? r.LoadDate.toISOString().slice(0, 10)
          : String(r.LoadDate).slice(0, 10);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push({
          id: r.LoadID,
          typeId: r.TypeID,
          label: r.Label || "",
          notes: r.Notes || ""
        });
      }
      return res.json({ ok: true, data: grouped });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("calendar GET error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST a new calendar load
app.post("/api/calendar", async (req, res) => {
  try {
    const accountId = await getLoggedInAccountId(req);
    if (!accountId) {
      return res.status(401).json({ ok: false, error: "not logged in" });
    }
    const date = String(req.body?.date || "").trim();
    const typeId = String(req.body?.typeId || "").trim();
    const label = String(req.body?.label || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!date || !typeId) {
      return res.status(400).json({ ok: false, error: "date and typeId are required" });
    }

    const connection = await dbPool.getConnection();
    try {
      const [result] = await connection.execute(
        "INSERT INTO LaundryLoads (AccountID, LoadDate, TypeID, Label, Notes) VALUES (?, ?, ?, ?, ?)",
        [accountId, date, typeId, label || null, notes || null]
      );
      return res.json({ ok: true, id: result.insertId });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("calendar POST error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE a calendar load (verifies ownership)
app.delete("/api/calendar/:id", async (req, res) => {
  try {
    const accountId = await getLoggedInAccountId(req);
    if (!accountId) {
      return res.status(401).json({ ok: false, error: "not logged in" });
    }
    const loadId = Number(req.params.id);
    if (!loadId) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const connection = await dbPool.getConnection();
    try {
      const [result] = await connection.execute(
        "DELETE FROM LaundryLoads WHERE LoadID = ? AND AccountID = ?",
        [loadId, accountId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ ok: false, error: "load not found" });
      }
      return res.json({ ok: true });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("calendar DELETE error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


app.listen(PORT, HOST, () => {
  console.log(`SmartSpin server running at http://${HOST}:${PORT}/index.html`);
});