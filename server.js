// ============================================================
// Payment Accounts Board — single-file app
// - Serves the HTML page
// - Provides the API
// - Stores data in memory (resets on restart)
// ============================================================

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

app.use(express.json());

// ---------- In-memory data ----------
let banks = [
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
];

// ---------- Auth ----------
const sessions = new Set();
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.post("/api/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "wrong password" });
  const token = crypto.randomBytes(24).toString("hex");
  sessions.add(token);
  res.json({ token });
});
app.post("/api/logout", requireAdmin, (req, res) => {
  sessions.delete(req.headers["x-admin-token"]);
  res.json({ ok: true });
});

// ---------- Public API ----------
app.get("/api/banks", (req, res) => res.json(banks));

// ---------- Admin API ----------
app.put("/api/banks/:bankId/accounts/:accountId", requireAdmin, (req, res) => {
  const bank = banks.find(b => b.id === req.params.bankId);
  if (!bank) return res.status(404).json({ error: "bank not found" });
  const acc = bank.accounts.find(a => a.id === req.params.accountId);
  if (!acc) return res.status(404).json({ error: "account not found" });
  const allowed = ["maskedNumber", "status", "dailyUsed", "dailyCap", "reason"];
  for (const k of allowed) if (k in req.body) acc[k] = req.body[k];
  res.json(acc);
});

app.post("/api/banks/:bankId/accounts", requireAdmin, (req, res) => {
  const bank = banks.find(b => b.id === req.params.bankId);
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
  res.json(acc);
});

app.delete("/api/banks/:bankId/accounts/:accountId", requireAdmin, (req, res) => {
  const bank = banks.find(b => b.id === req.params.bankId);
  if (!bank) return res.status(404).json({ error: "bank not found" });
  bank.accounts = bank.accounts.filter(a => a.id !== req.params.accountId);
  res.json({ ok: true });
});

// ---------- The whole frontend, inline ----------
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Payment Accounts</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #f6f7f9; color: #222; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 20px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0; }
  .btn { padding: 7px 12px; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 13px; }
  .btn:hover { background: #f0f0f0; }
  .btn.primary { background: #111; color: #fff; border-color: #111; }
  .btn.danger  { color: #c5221f; border-color: #f2c2c0; }
  .btn.small   { padding: 4px 8px; font-size: 12px; }

  .bank-card { background: #fff; border: 1px solid #e5e5e5; border-left: 4px solid #ccc;
               border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
  .bank-card.ok   { border-left-color: #34a853; }
  .bank-card.warn { border-left-color: #f5a623; }
  .bank-card.bad  { border-left-color: #dc3545; }

  .bank-header { display: flex; align-items: center; gap: 12px; width: 100%;
                 padding: 14px 16px; background: none; border: none; cursor: pointer; text-align: left; }
  .bank-header:hover { background: #fafafa; }
  .dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
  .bank-info { flex: 1; }
  .bank-info h3 { margin: 0; font-size: 15px; font-weight: 600; }
  .bank-info p { margin: 2px 0 0; font-size: 12px; color: #777; }
  .pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .pill { font-size: 11px; padding: 3px 8px; border-radius: 999px; font-weight: 500; }
  .pill.ok   { background: #e6f4ea; color: #137333; }
  .pill.warn { background: #fef7e0; color: #b06000; }
  .pill.bad  { background: #fce8e6; color: #c5221f; }

  .accounts { border-top: 1px solid #eee; }
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 16px;
         border-bottom: 1px solid #f3f3f3; font-size: 13px; flex-wrap: wrap; }
  .row:last-child { border-bottom: none; }
  .row.bad-row { background: #fafafa; }

  .status-pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
  .status-pill.ok   { background: #e6f4ea; color: #137333; }
  .status-pill.warn { background: #fef7e0; color: #b06000; }
  .status-pill.bad  { background: #fce8e6; color: #c5221f; }

  .acct { font-family: ui-monospace, monospace; font-size: 12px; min-width: 80px; cursor: default; }
  .acct.blurred { filter: blur(4px); cursor: pointer; }

  .usage { display: flex; flex-direction: column; gap: 3px; min-width: 130px; }
  .usage-text { font-size: 11px; color: #666; }
  .progress { width: 100%; height: 5px; background: #eee; border-radius: 3px; overflow: hidden; }
  .progress .fill { height: 100%; background: #34a853; transition: width .3s; }
  .row.warn .progress .fill { background: #f5a623; }
  .row.bad .progress .fill  { background: #dc3545; }

  .reason { font-size: 11px; color: #888; font-style: italic; flex: 1; }

  .admin-bar { display: none; gap: 6px; margin-left: auto; }
  body.admin .admin-bar { display: flex; }

  .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: none;
              align-items: center; justify-content: center; z-index: 50; padding: 16px; }
  .modal-bg.open { display: flex; }
  .modal { background: #fff; border-radius: 12px; width: 100%; max-width: 400px; padding: 20px; }
  .modal h3 { margin: 0 0 12px; font-size: 16px; }
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 12px; color: #555; margin-bottom: 4px; }
  .field input, .field select { width: 100%; padding: 8px 10px; border: 1px solid #ccc;
                                border-radius: 6px; font-size: 13px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
  .error { color: #c5221f; font-size: 12px; margin-top: 6px; min-height: 14px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Payment Accounts</h1>
    <div style="display:flex; gap:8px;">
      <button class="btn" id="adminToggle">Admin</button>
      <button class="btn primary" id="loginBtn" style="display:none;">Log in</button>
      <button class="btn" id="logoutBtn" style="display:none;">Log out</button>
    </div>
  </header>
  <div id="board"></div>
</div>

<div class="modal-bg" id="loginModal">
  <div class="modal">
    <h3>Admin login</h3>
    <div class="field">
      <label>Password</label>
      <input type="password" id="passwordInput" autocomplete="current-password" />
    </div>
    <div class="error" id="loginError"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeLogin()">Cancel</button>
      <button class="btn primary" onclick="doLogin()">Log in</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="editModal">
  <div class="modal">
    <h3 id="editTitle">Edit account</h3>
    <div class="field"><label>Account number (masked)</label><input id="f_number" /></div>
    <div class="field"><label>Status</label>
      <select id="f_status">
        <option value="active">✅ Active</option>
        <option value="paused">⏸️ Paused</option>
        <option value="limit_reached">⚠️ Limit reached</option>
        <option value="stop_use">🛑 Stop use</option>
        <option value="blocked">🚫 Blocked</option>
      </select>
    </div>
    <div class="field"><label>Daily used (R)</label><input id="f_used" type="number" /></div>
    <div class="field"><label>Daily cap (R)</label><input id="f_cap" type="number" /></div>
    <div class="field"><label>Reason / note</label><input id="f_reason" /></div>
    <div class="error" id="editError"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeEdit()">Cancel</button>
      <button class="btn primary" onclick="saveEdit()">Save</button>
    </div>
  </div>
</div>

<script>
const STATUS = {
  active:        { icon: "✅", label: "Active",         cls: "ok"   },
  paused:        { icon: "⏸️", label: "Paused",         cls: "warn" },
  limit_reached: { icon: "⚠️", label: "Limit Reached",  cls: "warn" },
  stop_use:      { icon: "🛑", label: "Stop Use",       cls: "bad"  },
  blocked:       { icon: "🚫", label: "Blocked",        cls: "bad"  },
};

let banks = [];
let openId = null;
let token = localStorage.getItem("adminToken") || null;
let editing = null;

async function loadBanks() {
  const r = await fetch("/api/banks");
  banks = await r.json();
  render();
}

function render() {
  const board = document.getElementById("board");
  const admin = document.body.classList.contains("admin") && token;
  board.innerHTML = "";

  banks.forEach(bank => {
    const counts = bank.accounts.reduce((a, x) => (a[x.status] = (a[x.status]||0)+1, a), {});
    const worst = (counts.blocked || counts.stop_use) ? "bad"
                : (counts.limit_reached || counts.paused) ? "warn" : "ok";
    const card = document.createElement("div");
    card.className = "bank-card " + worst;

    const header = document.createElement("button");
    header.className = "bank-header";
    header.innerHTML = \`
      <span class="dot" style="background:\${bank.color}"></span>
      <div class="bank-info">
        <h3>\${esc(bank.name)}</h3>
        <p>\${bank.accounts.length} accounts</p>
      </div>
      <div class="pills">
        \${counts.active        ? \`<span class="pill ok">\${counts.active} usable</span>\` : ""}
        \${counts.paused        ? \`<span class="pill warn">\${counts.paused} paused</span>\` : ""}
        \${counts.limit_reached ? \`<span class="pill warn">\${counts.limit_reached} at limit</span>\` : ""}
        \${counts.stop_use      ? \`<span class="pill bad">\${counts.stop_use} stop</span>\` : ""}
        \${counts.blocked       ? \`<span class="pill bad">\${counts.blocked} blocked</span>\` : ""}
      </div>\`;
    header.onclick = () => { openId = openId === bank.id ? null : bank.id; render(); };
    card.appendChild(header);

    if (openId === bank.id) {
      const list = document.createElement("div");
      list.className = "accounts";

      bank.accounts.forEach(acc => {
        const cfg = STATUS[acc.status];
        const pct = acc.dailyCap ? Math.min(100, Math.round((acc.dailyUsed/acc.dailyCap)*100)) : 0;
        const blurred = acc.status === "blocked" || acc.status === "stop_use";

        const row = document.createElement("div");
        row.className = "row " + cfg.cls + (blurred ? " bad-row" : "");

        row.innerHTML = \`
          <span class="status-pill \${cfg.cls}">\${cfg.icon} \${cfg.label}</span>
          <span class="acct \${blurred ? "blurred" : ""}">\${esc(acc.maskedNumber)}</span>
          <span class="usage">
            <span class="usage-text">R\${(acc.dailyUsed||0).toLocaleString()} / R\${(acc.dailyCap||0).toLocaleString()}</span>
            <span class="progress"><span class="fill" style="width:\${pct}%"></span></span>
          </span>
          <span class="reason">\${esc(acc.reason || "")}</span>
          \${admin ? \`
            <span class="admin-bar">
              <button class="btn small" data-action="edit">Edit</button>
              <button class="btn small danger" data-action="del">Delete</button>
            </span>\` : ""}
        \`;

        const numEl = row.querySelector(".acct");
        if (blurred) numEl.onclick = () => numEl.classList.toggle("blurred");

        if (admin) {
          row.querySelector('[data-action="edit"]').onclick = () => openEdit(bank.id, acc);
          row.querySelector('[data-action="del"]').onclick  = () => deleteAccount(bank.id, acc.id);
        }
        list.appendChild(row);
      });

      if (admin) {
        const addRow = document.createElement("div");
        addRow.className = "row";
        addRow.innerHTML = \`<button class="btn small" data-action="add">+ Add account</button>\`;
        addRow.querySelector("button").onclick = () => openEdit(bank.id, null);
        list.appendChild(addRow);
      }

      card.appendChild(list);
    }

    board.appendChild(card);
  });
}

const adminToggle = document.getElementById("adminToggle");
const loginBtn    = document.getElementById("loginBtn");
const logoutBtn   = document.getElementById("logoutBtn");

function refreshAuthUI() {
  const inAdmin = document.body.classList.contains("admin");
  adminToggle.style.display = inAdmin ? "none" : "inline-block";
  loginBtn.style.display    = inAdmin && !token ? "inline-block" : "none";
  logoutBtn.style.display   = inAdmin && token  ? "inline-block" : "none";
}

adminToggle.onclick = () => {
  document.body.classList.add("admin");
  refreshAuthUI();
  render();
};
logoutBtn.onclick = async () => {
  await fetch("/api/logout", { method: "POST", headers: { "x-admin-token": token } });
  token = null;
  localStorage.removeItem("adminToken");
  document.body.classList.remove("admin");
  refreshAuthUI();
  render();
};
loginBtn.onclick = () => {
  document.getElementById("loginModal").classList.add("open");
  document.getElementById("passwordInput").focus();
};
window.closeLogin = () => {
  document.getElementById("loginModal").classList.remove("open");
  document.getElementById("loginError").textContent = "";
  document.getElementById("passwordInput").value = "";
};
window.doLogin = async () => {
  const password = document.getElementById("passwordInput").value;
  const r = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    document.getElementById("loginError").textContent = "Wrong password";
    return;
  }
  const { token: t } = await r.json();
  token = t;
  localStorage.setItem("adminToken", token);
  closeLogin();
  refreshAuthUI();
  render();
};

window.openEdit = (bankId, acc) => {
  editing = { bankId, accountId: acc ? acc.id : null };
  document.getElementById("editTitle").textContent = acc ? "Edit account" : "Add account";
  document.getElementById("f_number").value = acc ? acc.maskedNumber : "••••";
  document.getElementById("f_status").value = acc ? acc.status : "active";
  document.getElementById("f_used").value   = acc ? acc.dailyUsed : 0;
  document.getElementById("f_cap").value    = acc ? acc.dailyCap  : 50000;
  document.getElementById("f_reason").value = acc ? (acc.reason || "") : "";
  document.getElementById("editModal").classList.add("open");
};
window.closeEdit = () => {
  editing = null;
  document.getElementById("editModal").classList.remove("open");
  document.getElementById("editError").textContent = "";
};
window.saveEdit = async () => {
  const body = {
    maskedNumber: document.getElementById("f_number").value,
    status:       document.getElementById("f_status").value,
    dailyUsed:    Number(document.getElementById("f_used").value),
    dailyCap:     Number(document.getElementById("f_cap").value),
    reason:       document.getElementById("f_reason").value,
  };
  const url = editing.accountId
    ? \`/api/banks/\${editing.bankId}/accounts/\${editing.accountId}\`
    : \`/api/banks/\${editing.bankId}/accounts\`;
  const method = editing.accountId ? "PUT" : "POST";

  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    document.getElementById("editError").textContent = "Save failed. Are you still logged in?";
    return;
  }
  closeEdit();
  await loadBanks();
};

async function deleteAccount(bankId, accountId) {
  if (!confirm("Delete this account?")) return;
  await fetch(\`/api/banks/\${bankId}/accounts/\${accountId}\`, {
    method: "DELETE",
    headers: { "x-admin-token": token },
  });
  loadBanks();
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

document.getElementById("passwordInput").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
refreshAuthUI();
loadBanks();
</script>
</body>
</html>`;

// ---------- Serve the single page ----------
app.get("/", (req, res) => res.type("html").send(HTML));

app.listen(PORT, () => console.log("Listening on " + PORT));
