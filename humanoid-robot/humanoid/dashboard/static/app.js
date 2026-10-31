// Robot dashboard front-end. Plain JavaScript, no libraries, works on iPhone Safari.
"use strict";

const $ = (id) => document.getElementById(id);
let TOKEN = new URLSearchParams(location.search).get("token") || "";
try {
  if (TOKEN) sessionStorage.setItem("robotToken", TOKEN);
  else TOKEN = sessionStorage.getItem("robotToken") || "";
} catch (e) { /* storage blocked - fine */ }

let state = null;
let currentPlanId = null;
let logAfter = 0;
let failures = 0;

const EXAMPLES = [
  "Pick up the red cup and place it in the basket",
  "Bring the blue ball to the laundry basket",
  "Go to the kitchen",
  "Move forward 1 metre then turn left",
  'Say "Hello, I am your robot"',
  "Pick up the heavy box",
  "Cook dinner",
  "Go charge",
];

async function api(path, body) {
  const opts = { method: body === undefined ? "GET" : "POST",
                 headers: { "Content-Type": "application/json" } };
  if (TOKEN) opts.headers["X-Robot-Token"] = TOKEN;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({ ok: false, reasons: ["Bad response"] }));
  if (res.status === 401) showBanner(data.reasons[0]);
  return data;
}

function showBanner(text) {
  const b = $("banner");
  if (!text) { b.classList.add("hidden"); return; }
  b.textContent = text;
  b.classList.remove("hidden");
}

function toast(result, okText) {
  if (result && result.ok === false) alert((result.reasons || ["Refused"]).join("\n"));
  else if (okText) $("message").textContent = okText;
}

// ---------------------------------------------------------------- commands
$("estop").addEventListener("click", () => api("/api/stop", { reason: "STOP button pressed on dashboard" }));
$("cancel").addEventListener("click", () => api("/api/cancel", {}));
$("reset-btn").addEventListener("click", async () => toast(await api("/api/reset", {}), "E-stop reset."));
$("clear-btn").addEventListener("click", async () => toast(await api("/api/clear_faults", {})));
$("fault-btn").addEventListener("click", async () =>
  toast(await api("/api/fault", { code: $("fault-select").value })));
$("phys-estop").addEventListener("change", (e) =>
  api("/api/sim/physical_estop", { pressed: e.target.checked }));
$("batt-btn").addEventListener("click", async () =>
  toast(await api("/api/sim/battery", { percent: Number($("batt").value) })));
$("world-reset").addEventListener("click", async () => {
  if (confirm("Put every object back and return the robot to its dock?")) {
    $("phys-estop").checked = false;
    toast(await api("/api/sim/reset", {}));
  }
});

document.querySelectorAll("[data-cmd]").forEach((btn) => btn.addEventListener("click", async () => {
  const v = Number(btn.dataset.val);
  const params = btn.dataset.cmd === "move" ? { distance_m: v } : { degrees: v };
  toast(await api("/api/command", { type: btn.dataset.cmd, params }));
}));
$("goto-btn").addEventListener("click", async () =>
  toast(await api("/api/command", { type: "navigate_to", params: { target: $("goto").value } })));
$("charge-btn").addEventListener("click", async () => toast(await api("/api/command", { type: "charge", params: {} })));
$("say-btn").addEventListener("click", async () => {
  const text = $("say").value.trim();
  if (text) toast(await api("/api/command", { type: "speak", params: { text } }));
});

EXAMPLES.forEach((ex) => {
  const c = document.createElement("button");
  c.type = "button"; c.className = "chip"; c.textContent = ex;
  c.addEventListener("click", () => { $("instruction").value = ex; makePlan(); });
  $("examples").appendChild(c);
});

$("plan-form").addEventListener("submit", (e) => { e.preventDefault(); makePlan(); });
$("run-plan").addEventListener("click", async () => {
  if (currentPlanId == null) return;
  const r = await api("/api/execute", { plan_id: currentPlanId });
  if (r.ok) {
    $("plan-out").insertAdjacentHTML("beforeend", '<p class="okmsg">Running… watch the map.</p>');
    $("run-plan").disabled = true;
  } else toast(r);
});

async function makePlan() {
  const text = $("instruction").value.trim();
  const out = $("plan-out");
  out.textContent = "Planning…";
  const r = await api("/api/plan", { text });
  const p = r.plan;
  if (!p) { out.textContent = (r.reasons || ["Error"]).join(" "); return; }
  out.innerHTML = "";
  if (p.steps.length) {
    const ol = document.createElement("ol");
    p.steps.forEach((s) => { const li = document.createElement("li"); li.textContent = s.description; ol.appendChild(li); });
    out.appendChild(ol);
  }
  p.warnings.forEach((w) => { const el = document.createElement("p"); el.className = "wrn"; el.textContent = "⚠ " + w; out.appendChild(el); });
  p.errors.forEach((er) => { const el = document.createElement("p"); el.className = "err"; el.textContent = "✖ " + er; out.appendChild(el); });
  if (p.ok) { const el = document.createElement("p"); el.className = "okmsg"; el.textContent = "✔ Plan passed the safety checks. Press “Run plan”."; out.appendChild(el); }
  currentPlanId = p.ok ? p.id : null;
  $("run-plan").disabled = !p.ok;
}

// ---------------------------------------------------------------- rendering
function setOptions(select, items, keep) {
  const sig = items.map((i) => i.value).join("|");
  if (select.dataset.sig === sig) return;
  const prev = keep ? select.value : null;
  select.innerHTML = "";
  items.forEach((i) => { const o = document.createElement("option"); o.value = i.value; o.textContent = i.label; select.appendChild(o); });
  if (prev) select.value = prev;
  select.dataset.sig = sig;
}

function render(s) {
  $("robot-name").textContent = s.robot.name;
  $("robot-model").textContent = `${s.robot.model} · v${s.robot.version}`;
  $("sim-pill").classList.toggle("hidden", !s.robot.simulation_only);
  const mode = $("mode");
  mode.textContent = s.mode === "estopped" ? "E-STOP" : s.mode.toUpperCase();
  mode.className = "pill mode-" + s.mode;
  const b = s.battery;
  $("battery").textContent = `🔋 ${Math.round(b.percent)}%${b.charging ? " ⚡" : ""}`;
  $("battery").className = "pill " + (b.percent < 15 ? "bad" : "");
  $("pose").textContent = `x ${s.pose.x.toFixed(2)} m · y ${s.pose.y.toFixed(2)} m · facing ${Math.round(s.pose.heading_deg)}° · sim time ${s.sim_time.toFixed(0)} s`;
  $("message").textContent = s.message + (s.last_error ? "" : "");
  showBanner(s.mode === "estopped" ? `EMERGENCY STOP — ${s.safety.estop_reason}. Fix the cause, then press “Reset e-stop”.` : "");

  const kv = [
    ["Task", s.task ? `${s.task.label} (${s.task.done}/${s.task.total})` : "none"],
    ["Doing now", s.current_action ? s.current_action.description : "nothing"],
    ...Object.entries(s.arms).map(([side, a]) => [`${side} hand`, a.holding ? `holding ${a.holding}` : "empty"]),
    ["Last problem", s.last_error || "none"],
    ["Robot said", s.speech.length ? `“${s.speech[s.speech.length - 1].text}”` : "-"],
    ["Hardware", s.hardware.every((h) => h.simulated) ? "all simulated" : "REAL HARDWARE"],
  ];
  $("status").innerHTML = "";
  kv.forEach(([k, v]) => { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; $("status").append(dt, dd); });

  $("history").innerHTML = "";
  s.history.forEach((h) => { const li = document.createElement("li"); li.textContent = `${h.action.description} — ${h.result}`; if (h.result !== "done") li.className = "failed"; $("history").appendChild(li); });

  $("estop-state").textContent = s.safety.estop_engaged ? "ENGAGED" : "clear";
  $("estop-state").style.color = s.safety.estop_engaged ? "var(--danger)" : "var(--go)";
  $("faults").innerHTML = "";
  if (!s.safety.faults.length) $("faults").innerHTML = '<li class="muted">none</li>';
  s.safety.faults.forEach((f) => { const li = document.createElement("li"); li.className = f.severity; li.textContent = `${f.message} (${f.severity}) ${f.detail || ""}`; $("faults").appendChild(li); });
  $("phys-estop").checked = s.physical_estop_pressed;

  setOptions($("goto"), s.world.locations.map((l) => ({ value: l.name, label: l.label })), true);
  setOptions($("fault-select"), s.injectable_faults.map((f) => ({ value: f, label: f.replace(/_/g, " ") })), true);

  const logEl = $("log");
  const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 10;
  s.log.forEach((r) => {
    if (r.seq <= logAfter) return;
    logAfter = r.seq;
    const div = document.createElement("div");
    div.className = r.level;
    div.textContent = `${new Date(r.time * 1000).toLocaleTimeString()} ${r.level.padEnd(7)} ${r.message}`;
    logEl.appendChild(div);
  });
  while (logEl.childNodes.length > 300) logEl.removeChild(logEl.firstChild);
  if (atBottom) logEl.scrollTop = logEl.scrollHeight;

  drawMap(s);
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function drawMap(s) {
  const canvas = $("map");
  const w = s.world;
  const cssW = canvas.clientWidth;
  const cssH = cssW * (w.height_m / w.width_m);
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + "px";
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = cssW / w.width_m;
  const X = (x) => x * k, Y = (y) => cssH - y * k;
  const text = cssVar("--text"), muted = cssVar("--muted");

  ctx.fillStyle = cssVar("--floor"); ctx.fillRect(0, 0, cssW, cssH);
  ctx.strokeStyle = cssVar("--grid"); ctx.lineWidth = 1;
  for (let gx = 1; gx < w.width_m; gx++) { ctx.beginPath(); ctx.moveTo(X(gx), 0); ctx.lineTo(X(gx), cssH); ctx.stroke(); }
  for (let gy = 1; gy < w.height_m; gy++) { ctx.beginPath(); ctx.moveTo(0, Y(gy)); ctx.lineTo(cssW, Y(gy)); ctx.stroke(); }
  ctx.font = `${Math.max(10, k * 0.16)}px sans-serif`;
  // Draw a label centred (or left-aligned) at x, but never cut off at the map edge.
  const label = (str, x, y, centred) => {
    const tw = ctx.measureText(str).width;
    let left = centred ? x - tw / 2 : x;
    left = Math.max(2, Math.min(cssW - tw - 2, left));
    ctx.textAlign = "left";
    ctx.fillText(str, left, y);
  };

  w.obstacles.forEach((o) => {
    ctx.fillStyle = cssVar("--obstacle");
    ctx.fillRect(X(o.x_min), Y(o.y_max), (o.x_max - o.x_min) * k, (o.y_max - o.y_min) * k);
    ctx.fillStyle = text; ctx.textBaseline = "middle";
    label(o.name, X((o.x_min + o.x_max) / 2), Y((o.y_min + o.y_max) / 2), true);
  });
  w.locations.forEach((l) => {
    ctx.strokeStyle = cssVar("--loc"); ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(l.x), Y(l.y), k * 0.28, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = muted; ctx.textBaseline = "top";
    label(l.label, X(l.x), Y(l.y) + k * 0.3, true);
  });
  if (s.path.length) {
    ctx.strokeStyle = cssVar("--robot"); ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(s.pose.x), Y(s.pose.y));
    s.path.forEach(([px, py]) => ctx.lineTo(X(px), Y(py))); ctx.stroke(); ctx.setLineDash([]);
  }
  w.objects.filter((o) => !o.held_by).forEach((o) => {
    ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), k * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = text; ctx.textBaseline = "bottom";
    label(o.name, X(o.x) + k * 0.1, Y(o.y) - 2, false);
  });

  // robot
  const p = s.pose, r = s.body_radius_m * k;
  ctx.strokeStyle = cssVar("--robot"); ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), s.arm_reach_m * k, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = s.mode === "estopped" ? cssVar("--danger") : cssVar("--robot");
  ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y));
  ctx.lineTo(X(p.x + Math.cos(p.theta) * s.body_radius_m), Y(p.y + Math.sin(p.theta) * s.body_radius_m)); ctx.stroke();
  // hands: right hand is to the robot's right (heading - 90°)
  Object.entries(s.arms).forEach(([side, a]) => {
    const off = side === "left" ? Math.PI / 2 : -Math.PI / 2;
    let hx = p.x + Math.cos(p.theta + off) * s.body_radius_m * 0.9;
    let hy = p.y + Math.sin(p.theta + off) * s.body_radius_m * 0.9;
    if (a.target) { [hx, hy] = a.target; }
    const held = a.holding && w.objects.find((o) => o.name === a.holding);
    ctx.fillStyle = held ? held.color : "#cbd5e1";
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(hx), Y(hy), k * (held ? 0.1 : 0.07), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
}

// ---------------------------------------------------------------- polling
async function poll() {
  try {
    const s = await api(`/api/state?log_after=${logAfter}`);
    if (s.robot) { state = s; render(s); failures = 0; $("conn").textContent = "connected"; $("conn").className = "pill ok"; }
  } catch (e) {
    failures++;
    $("conn").textContent = "disconnected"; $("conn").className = "pill bad";
    if (failures > 3) showBanner("Lost connection to the robot software. Is run_robot still running on your PC?");
  }
  setTimeout(poll, 250);
}

async function loadInfo() {
  try {
    const info = await api("/api/info");
    const ul = $("features");
    ul.innerHTML = "";
    (info.features || []).forEach((f) => {
      const li = document.createElement("li");
      const cls = f.status.startsWith("working") ? "st-working" : f.status === "placeholder" ? "st-placeholder" : "st-not";
      const name = document.createElement("span"); name.textContent = f.name; name.title = f.notes;
      const st = document.createElement("span"); st.className = "st " + cls; st.textContent = f.status;
      li.append(name, st); ul.appendChild(li);
    });
  } catch (e) { /* retry on next load */ }
}

window.addEventListener("resize", () => state && drawMap(state));
loadInfo();
poll();
