// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Data layer ----------
const SEED = {
  banks: [
    { id: "capitec",  name: "Capitec",       color: "#0033a0", accounts: [
      { id: "cap_001", maskedNumber: "••••4821", status: "active",  dailyUsed: 42000, dailyCap: 50000, reason: "" },
      { id: "cap_002", maskedNumber: "••••7710", status: "active",  dailyUsed: 8000,  dailyCap: 50000, reason: "" },
      { id: "cap_003", maskedNumber: "••••3390", status: "paused",  dailyUsed: 0,     dailyCap: 50000, reason: "Pending KYC" },
    ]},
    { id: "fnb", name: "FNB", color: "#00a651", accounts: [
      { id: "fnb_001", maskedNumber: "••••1102", status: "limit_reached", dailyUsed: 50000, dailyCap: 50000, reason: "Resets at midnight" },
      { id: "fnb_002", maskedNumber: "••••9934", status: "blocked",       dailyUsed: 0,     dailyCap: 50000, reason: "Bank flagged" },
      { id: "fnb_003", maskedNumber: "••••5528", status: "stop_use",      dailyUsed: 0,     dailyCap: 50000, reason: "Ops hold" },
      { id: "fnb_004", maskedNumber: "••••2241", status: "active",        dailyUsed: 12000, dailyCap: 50000, reason: "" },
    ]},
    { id: "absa", name: "Absa", color: "#dc0028", accounts: [
      { id: "absa_001", maskedNumber: "••••3345", status: "active", dailyUsed: 5000, dailyCap: 40000, reason: "" },
      { id: "absa_002", maskedNumber: "••••7788", status: "paused", dailyUsed: 0,    dailyCap: 40000, reason: "Awaiting ops review" },
    ]},
    { id: "standard", name: "Standard Bank", color: "#0033a1", accounts: [
      { id: "std_001", maskedNumber: "••••9012", status: "active",  dailyUsed: 30000, dailyCap: 60000, reason: "" },
      { id: "std_002", maskedNumber: "••••4567", status: "blocked", dailyUsed: 0,     dailyCap: 60000, reason: "Bank flagged" },
    ]},
    { id: "tyme", name: "TymeBank", color: "#f5a623", accounts: [
      { id: "tyme_001", maskedNumber: "••••2211", status: "active",   dailyUsed: 2000, dailyCap: 20000, reason: "" },
      { id: "tyme_002", maskedNumber: "••••8833", status: "stop_use", dailyUsed: 0,    dailyCap: 20000, reason: "Under investigation" },
    ]},
  ],
};

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ---------- Auth ----------
const sessions = new Set();

function auth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.post("/api/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "wrong password" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.add(token);
  res.json({ token });
});

app.post("/api/logout", auth, (req, res) => {
  sessions.delete(req.headers["x-admin-token"]);
  res.json({ ok: true });
});

// ---------- Public API ----------
app.get("/api/banks", (req, res) => {
  res.json(load().banks);
});

// ---------- Admin API ----------
app.put("/api/banks/:bankId/accounts/:accountId", auth, (req, res) => {
  const data = load();
  const bank = data.banks.find(b => b.id === req.params.bankId);
  if (!bank) return res.status(404).json({ error: "bank not found" });
  const acc = bank.accounts.find(a => a.id === req.params.accountId);
  if (!acc) return res.status(404).json({ error: "account not found" });

  const allowed = ["maskedNumber", "status", "dailyUsed", "dailyCap", "reason"];
  for (const k of allowed) if (k in req.body) acc[k] = req.body[k];

  save(data);
  res.json(acc);
});

app.post("/api/banks/:bankId/accounts", auth, (req, res) => {
  const data = load();
  const bank = data.banks.find(b => b.id === req.params.bankId);
  if (!bank) return res.status(404).json({ error: "bank not found" });

  const acc = {
    id: req.params.bankId + "_" + crypto.randomBytes(3).toString("hex"),
    maskedNumber: req.body.maskedNumber || "••••0000",
    status: req.body.status || "active",
    dailyUsed: req.body.dailyUsed || 0,
    dailyCap: req.body.dailyCap || 50000,
    reason: req.body.reason || "",
  };
  bank.accounts.push(acc);
  save(data);
  res.json(acc);
});

app.delete("/api/banks/:bankId/accounts/:accountId", auth, (req, res) => {
  const data = load();
  const bank = data.banks.find(b => b.id === req.params.bankId);
  if (!bank) return res.status(404).json({ error: "bank not found" });
  bank.accounts = bank.accounts.filter(a => a.id !== req.params.accountId);
  save(data);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
