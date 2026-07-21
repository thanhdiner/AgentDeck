/**
 * Companion UI — pixel-close clone of AgentDeck desktop shell.
 * Grid: title | sidebar 240 · terminal · right 340–380 | status
 * ≤900px: one column + bottom Spaces / Terminal / Tasks tabs
 */
export function getCompanionHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#101010"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<title>AgentDeck</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
:root{
  color-scheme:dark;
  --bg:#101010;
  --subtle:#181818;
  --surf:#141416;
  --surf2:#1a1a1c;
  --elev:#1c1c1e;
  --border:rgba(255,255,255,.08);
  --border2:rgba(255,255,255,.12);
  --line:#262626;
  --text:#d7dee8;
  --bright:#fafafa;
  --zinc:#f4f4f5;
  --muted:#a1a1aa;
  --muted2:#71717a;
  --slate:#64748b;
  --sky:#38bdf8;
  --sky2:#7dd3fc;
  --vio:#a78bfa;
  --vio2:#c4b5fd;
  --gr:#34d399;
  --am:#fbbf24;
  --hi:#fca5a5;
  --red:#f87171;
  --safe-b:env(safe-area-inset-bottom,0px);
  --safe-t:env(safe-area-inset-top,0px);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--text);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:13px;line-height:1.45;font-synthesis:none;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
/* ── shell grid (matches .app-shell) ── */
.shell{display:none;height:100%;
  grid-template-rows:calc(38px + var(--safe-t)) minmax(0,1fr) 28px;
  grid-template-columns:240px minmax(0,1fr) minmax(300px,360px);
  grid-template-areas:"title title title" "sidebar center right" "status status status";
  background:var(--bg)}
.shell.on{display:grid}
/* title bar */
.titlebar{grid-area:title;display:flex;align-items:center;justify-content:space-between;gap:10px;
  min-width:0;padding:6px 10px;padding-top:calc(6px + var(--safe-t));
  background:var(--subtle);border-bottom:1px solid var(--border)}
.titlebar-l{display:flex;align-items:center;gap:8px;min-width:0}
.titlebar-l strong{color:var(--bright);font-size:13px;font-weight:700}
.titlebar-l .ver{color:#94a3b8;font-size:11px}
.titlebar-r{display:flex;align-items:center;gap:8px}
.titlebar-r button{padding:4px 8px;font-size:11px;border:1px solid var(--border2);
  background:transparent;color:var(--muted);border-radius:4px}
.titlebar-r button:hover{color:var(--zinc);background:var(--elev)}
.online{font-size:11px;font-weight:700;color:var(--gr);background:rgba(52,211,153,.1);
  border:1px solid rgba(52,211,153,.28);padding:3px 8px;border-radius:6px}
.online.off{color:var(--red);background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3)}
/* status bar */
.statusbar{grid-area:status;display:flex;align-items:center;gap:12px;min-width:0;
  overflow:hidden;padding:4px 10px;background:var(--subtle);border-top:1px solid var(--border);
  font-size:11px;color:#94a3b8}
.statusbar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.statusbar b{color:var(--zinc);font-weight:600}
/* left sidebar */
.sidebar{grid-area:sidebar;display:flex;flex-direction:column;min-width:0;overflow:hidden;
  background:var(--subtle);border-right:1px solid var(--border)}
.side-h{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:12px 14px;border-bottom:1px solid var(--line);min-height:48px}
.side-h h1{margin:0;font-size:15px;font-weight:700;color:var(--bright);line-height:1}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;
  padding:0;border:1px solid var(--border2);border-radius:6px;background:var(--elev);color:var(--muted)}
.icon-btn:hover{color:var(--sky);border-color:rgba(56,189,248,.35)}
.side-sec{padding:12px 14px 0}
.side-sec label{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.fake-select{display:flex;align-items:center;justify-content:space-between;width:100%;
  padding:7px 10px;border:1px solid var(--border2);border-radius:6px;background:#0e0e11;
  color:var(--zinc);font-size:12px;font-weight:500}
.side-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 14px 10px}
.side-actions button{padding:6px 7px;font-size:11px;font-weight:600;border:1px solid var(--border2);
  border-radius:6px;background:var(--elev);color:var(--muted)}
.side-actions button:hover{color:var(--sky2);border-color:rgba(56,189,248,.3)}
.ws-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:10px}
.ws{display:flex;flex-direction:column;gap:4px;padding:9px 10px;border:1px solid #262626;
  border-radius:6px;background:#1c1c1c;cursor:pointer;text-align:left}
.ws:hover{border-color:rgba(255,255,255,.14)}
.ws.on{border-color:var(--sky);background:rgba(56,189,248,.08);box-shadow:0 0 10px rgba(56,189,248,.2)}
.ws .n{font-size:13px;font-weight:700;color:var(--bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws .meta{display:flex;align-items:center;gap:4px;color:var(--slate);font-size:11px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws .meta svg{flex-shrink:0;opacity:.7}
.side-foot{padding:10px 12px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}
.side-foot b{color:var(--zinc)}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}
.stat{padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--surf)}
.stat .l{font-size:10px;font-weight:600;color:var(--muted)}
.stat .v{font-size:14px;font-weight:700;color:var(--bright);margin-top:2px}
.stat .v.sky{color:var(--sky2)}.stat .v.gr{color:var(--gr)}.stat .v.am{color:var(--am)}
/* center terminal */
.center{grid-area:center;display:flex;flex-direction:column;min-width:0;min-height:0;background:#0c0c0e}
/* workspace topbar (desktop match) */
.ws-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;
  height:48px;padding:8px 14px;border-bottom:1px solid var(--border);background:var(--subtle);
  flex-shrink:0;box-sizing:border-box}
.ws-info{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;flex:1}
.ws-info .ws-name{font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0}
.ws-info .ws-path{font-size:11px;color:var(--slate);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ws-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.ws-run-group{display:flex;align-items:center;gap:6px;flex-shrink:0}
.status-badge{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 2px;
  font-size:11px;font-weight:500;color:#71717a;line-height:1}
.status-badge .dot{width:6px;height:6px;border-radius:50%;background:#52525b;flex-shrink:0}
.status-badge.is-running,.status-badge.is-starting{color:var(--gr)}
.status-badge.is-running .dot,.status-badge.is-starting .dot{background:var(--gr);box-shadow:0 0 0 3px rgba(52,211,153,.2)}
.status-badge.is-failed{color:var(--hi)}
.status-badge.is-failed .dot{background:var(--red)}
.status-badge .cfg-name{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:10.5px}
.run-wrap{display:inline-flex;align-items:stretch;overflow:hidden;border-radius:6px;
  border:1px solid rgba(56,189,248,.32);background:rgba(56,189,248,.1);flex-shrink:0}
.run-wrap.is-stop{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.1)}
.run-btn{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 11px;border:none;
  background:transparent;color:#7dd3fc;font-size:12px;font-weight:600;line-height:1;cursor:pointer}
.run-wrap.is-stop .run-btn{color:#fca5a5}
.run-btn:hover{background:rgba(56,189,248,.12);color:#bae6fd}
.run-wrap.is-stop .run-btn:hover{background:rgba(239,68,68,.12);color:#fecaca}
.run-btn:disabled{opacity:.5;cursor:not-allowed}
.meta-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:4px;
  border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);
  font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap}
.btn-pane{background:transparent;border:1px solid rgba(56,189,248,.4);color:var(--sky);
  padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;height:22px;line-height:1}
.btn-pane:hover{background:rgba(56,189,248,.1);border-color:var(--sky)}
.pane-bar{display:flex;align-items:center;gap:8px;min-width:0;height:36px;padding:0 10px;
  border-bottom:1px solid var(--border);background:var(--surf);flex-shrink:0}
.pane-title{font-size:12px;font-weight:700;color:var(--bright);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:40%}
.chip{flex-shrink:0;font-size:11px;font-weight:500;padding:2px 6px;border-radius:4px;
  background:var(--elev);border:1px solid rgba(255,255,255,.1);color:var(--muted);
  font-family:ui-monospace,"Cascadia Code",Consolas,monospace}
.chip.tasks{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 7px;
  background:#1e1b2e;border:1px solid rgba(167,139,250,.4);color:#e9d5ff;font-weight:700;
  font-family:inherit;border-radius:6px}
.chip.live{display:inline-flex;align-items:center;gap:5px;color:#e4e4e7;font-family:inherit;font-weight:600}
.chip.live i{width:6px;height:6px;border-radius:50%;background:var(--gr)}
.pane-bar select{margin-left:auto;max-width:130px;font-size:11px;padding:3px 6px;
  background:var(--elev);border:1px solid var(--border2);border-radius:4px;color:var(--zinc)}
.term{flex:1;min-height:0;overflow:auto;padding:12px 14px;background:#0a0a0c;
  font:12.5px/1.5 ui-monospace,"Cascadia Code",Consolas,monospace;color:#d4d4d8;
  white-space:pre-wrap;word-break:break-word}
.composer-wrap{flex-shrink:0;padding:8px 10px 6px;background:var(--surf);border-top:1px solid var(--border)}
.composer{display:flex;align-items:flex-end;gap:6px;padding:5px 6px 5px 8px;
  background:var(--elev);border:1px solid var(--border2);border-radius:999px}
.composer textarea{flex:1;border:none;background:transparent;outline:none;resize:none;
  min-height:32px;max-height:100px;padding:7px 4px;font-size:13px;color:var(--bright);line-height:1.4}
.composer .ib{width:30px;height:30px;border:none;border-radius:50%;background:transparent;
  color:var(--muted);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.composer .ib.go{color:var(--sky)}
.composer .ib.go:hover{background:rgba(56,189,248,.12)}
.cmeta{display:flex;justify-content:space-between;padding:6px 8px 0;font-size:11px;color:var(--muted)}
.cmeta .busy{color:var(--am);font-weight:600}
.tpl{display:flex;gap:6px;overflow-x:auto;padding:8px 0 2px}
.tpl button{flex:0 0 auto;border:1px solid var(--border);background:var(--surf2);color:var(--muted);
  font-size:11px;font-weight:600;padding:5px 9px;border-radius:4px;white-space:nowrap}
.tpl button:hover{color:var(--sky2);border-color:rgba(56,189,248,.35)}
/* right panel */
.right{grid-area:right;display:flex;flex-direction:column;min-width:0;overflow:hidden;
  background:var(--subtle);border-left:1px solid var(--line)}
.right-h{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;
  padding:12px 12px 10px;border-bottom:1px solid var(--border);flex-shrink:0}
.right-h h2{margin:0;font-size:14px;font-weight:700;color:var(--bright);display:flex;align-items:center;gap:6px}
.right-h .sub{font-size:11px;color:var(--muted);margin-top:3px}
.right-h .sub b{color:var(--zinc)}
.btn{appearance:none;border:1px solid var(--border2);background:var(--elev);color:var(--zinc);
  font-size:11px;font-weight:700;border-radius:6px;padding:6px 10px}
.btn:disabled{opacity:.5}.btn:active{transform:scale(.98)}
.btn-primary{background:rgba(56,189,248,.14);border-color:rgba(56,189,248,.4);color:var(--sky2)}
.btn-run{background:rgba(56,189,248,.16);border-color:rgba(56,189,248,.45);color:var(--sky2)}
.btn-danger{background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.3);color:var(--hi)}
.btn-sm{padding:4px 8px;font-size:10.5px}
.right-scroll{flex:1;min-height:0;overflow:auto;padding:8px 10px 14px}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.chips button{border:1px solid var(--border);background:var(--surf2);color:var(--muted);
  font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:4px}
.chips button.on{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.35);color:var(--sky2)}
.col-h{display:flex;align-items:center;gap:6px;padding:10px 2px 6px;
  font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.col-h.todo{color:#93c5fd}.col-h.running{color:var(--sky2)}
.col-h.review{color:#fcd34d}.col-h.done{color:#6ee7b7}
.cc{min-width:16px;height:16px;padding:0 5px;border-radius:999px;font-size:10px;font-weight:700;
  background:rgba(255,255,255,.06);border:1px solid var(--border);color:#d4d4d8;
  display:inline-flex;align-items:center;justify-content:center}
/* task card */
.tc{padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:8px;
  background:#1a1a1c;margin-bottom:7px}
.tc:hover{background:#1e1e22;border-color:rgba(255,255,255,.14)}
.tc-h{display:flex;align-items:center;gap:8px}
.tc-c{width:15px;height:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,.3);
  flex-shrink:0;background:transparent}
.tc-c.done{background:#10b981;border-color:#10b981}
.tc-c.running{border-color:var(--sky);border-style:dashed}
.tc-c.review{border-color:#f59e0b;background:rgba(245,158,11,.12)}
.tc-t{flex:1;font-size:12px;font-weight:500;color:var(--zinc);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tc-t.done{text-decoration:line-through;color:var(--muted2);opacity:.65}
.tc-m{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;padding-left:23px}
.pri{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600}
.pri i{width:6px;height:6px;border-radius:50%}
.pri.high{color:var(--hi)}.pri.high i{background:#f87171;box-shadow:0 0 0 2px rgba(248,113,113,.18)}
.pri.medium{color:#fcd34d}.pri.medium i{background:#eab308;box-shadow:0 0 0 2px rgba(234,179,8,.18)}
.pri.low{color:var(--muted)}.pri.low i{background:#71717a}
.bdg{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;
  padding:2px 6px;border-radius:5px;background:#141416;border:1px solid var(--border2);color:#d4d4d8}
.bdg.ag{color:#e4e4e7}
.tc-a{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-left:23px}
/* agents / runs */
.agent{display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;
  background:var(--surf2);border:1px solid var(--border2);border-radius:8px}
.agent .ico{width:28px;height:28px;border-radius:6px;background:rgba(167,139,250,.14);
  color:var(--vio2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.agent .inf{flex:1;min-width:0}
.agent .inf strong{display:block;font-size:12px;font-weight:700;color:var(--bright)}
.agent .inf small{display:block;font-size:10.5px;color:var(--muted);margin-top:1px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.run{background:var(--surf2);border:1px solid var(--border2);border-radius:8px;padding:9px 10px;margin-bottom:6px}
.run-h{display:flex;justify-content:space-between;gap:8px;align-items:center}
.run-h strong{font-size:12px;font-weight:700;color:var(--bright)}
.st{font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:4px;
  background:rgba(255,255,255,.06);color:var(--muted)}
.st.running{color:var(--gr);background:rgba(52,211,153,.12)}
.st.finished{color:#60a5fa;background:rgba(96,165,250,.12)}
.st.cancelled,.st.failed{color:var(--hi);background:rgba(248,113,113,.12)}
.cmd{margin-top:5px;font:10.5px/1.4 ui-monospace,Consolas,monospace;color:#d4d4d8;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.empty{text-align:center;padding:20px 10px;color:var(--muted);font-size:12px;
  border:1px dashed rgba(255,255,255,.1);border-radius:8px;background:#141416}
/* new task drawer */
.drawer{display:none;border-bottom:1px solid var(--border);padding:10px 12px;background:#161618}
.drawer.on{display:block}
label.f{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
label.f>span{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
input,textarea,select{
  width:100%;background:#0a0a0c;border:1px solid var(--border2);border-radius:6px;
  color:var(--bright);font-size:13px;padding:8px 10px;outline:none}
textarea{min-height:56px;resize:vertical;line-height:1.4}
input:focus,textarea:focus,select:focus{border-color:rgba(56,189,248,.5);box-shadow:0 0 0 2px rgba(56,189,248,.12)}
.row{display:flex;gap:6px}.row>*{flex:1}
.err{display:none;margin:0;padding:8px 12px;font-size:12px;
  background:rgba(248,113,113,.1);border-bottom:1px solid rgba(248,113,113,.3);color:#fecaca}
.err.show{display:block}
.toast{position:fixed;left:50%;bottom:48px;transform:translateX(-50%);z-index:100;
  background:var(--elev);border:1px solid var(--border2);color:var(--zinc);padding:8px 14px;
  border-radius:6px;font-size:12px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .15s;
  box-shadow:0 8px 24px rgba(0,0,0,.45)}
.toast.show{opacity:1}
/* gate */
.gate{display:none;max-width:400px;margin:80px auto;padding:0 16px}
.gate.on{display:block}
.gate h1{font-size:18px;font-weight:700;margin:0 0 6px;color:var(--bright)}
.gate p{margin:0 0 16px;color:var(--muted);font-size:13px;line-height:1.5}
/* mobile column tabs */
.m-tabs{display:none}
@media (max-width:900px){
  .shell{grid-template-columns:1fr;grid-template-rows:calc(38px + var(--safe-t)) minmax(0,1fr) 28px calc(52px + var(--safe-b));
    grid-template-areas:"title" "main" "status" "tabs"}
  .sidebar,.center,.right{display:none;grid-area:main}
  .sidebar.on,.center.on,.right.on{display:flex}
  .sidebar{border-right:none}.right{border-left:none}
  .ws-topbar{height:auto;min-height:48px;flex-wrap:wrap;padding:8px 10px;gap:8px}
  .ws-info{flex:1 1 100%}
  .ws-actions{flex:1 1 100%;justify-content:flex-end;flex-wrap:wrap}
  .m-tabs{grid-area:tabs;display:grid;grid-template-columns:repeat(3,1fr);
    background:var(--subtle);border-top:1px solid var(--border2);padding-bottom:var(--safe-b)}
  .m-tabs button{border:none;background:transparent;color:var(--muted);font-size:10px;font-weight:700;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 0}
  .m-tabs button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2}
  .m-tabs button.on{color:var(--sky2);background:rgba(56,189,248,.08)}
  .composer textarea{font-size:16px}
  input,select{font-size:16px}
  .toast{bottom:calc(60px + var(--safe-b))}
}
@media (min-width:901px){
  .m-tabs{display:none!important}
  .sidebar,.center,.right{display:flex!important}
}
</style>
</head>
<body>
<div id="gate" class="gate">
  <h1>AgentDeck</h1>
  <p>Open token from desktop <b style="color:var(--bright)">Settings → Mobile Companion</b>.</p>
  <div class="err" id="gate-err"></div>
  <label class="f"><span>Token</span><input id="token-input" autocomplete="off" spellcheck="false"/></label>
  <button class="btn btn-primary" type="button" id="btn-save-token" style="width:100%;margin-top:8px;padding:12px">Connect</button>
</div>

<div id="shell" class="shell">
  <header class="titlebar">
    <div class="titlebar-l">
      <strong>AgentDeck</strong>
      <span class="ver">companion</span>
    </div>
    <div class="titlebar-r">
      <button type="button" id="btn-refresh">Refresh</button>
      <span class="online" id="conn">Online</span>
    </div>
  </header>

  <div class="err" id="app-err"></div>

  <!-- LEFT: Workspaces -->
  <aside class="sidebar on" id="col-side">
    <div class="side-h">
      <h1>Workspaces</h1>
      <button type="button" class="icon-btn" id="btn-ws-info" title="Refresh">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
      </button>
    </div>
    <div class="side-sec">
      <label>Template</label>
      <div class="fake-select"><span>Default Terminal</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
    <div class="side-actions">
      <button type="button" disabled title="Use desktop to create">Create workspace</button>
      <button type="button" disabled title="Use desktop to open">Open folder</button>
    </div>
    <div class="ws-list" id="ws-list"></div>
    <div class="side-foot">
      <div class="stats">
        <div class="stat"><div class="l">Open</div><div class="v sky" id="st-open">0</div></div>
        <div class="stat"><div class="l">Agents</div><div class="v gr" id="st-run">0</div></div>
        <div class="stat"><div class="l">Git</div><div class="v am" id="st-git">0</div></div>
        <div class="stat"><div class="l">Panes</div><div class="v" id="st-panes">0</div></div>
      </div>
      <div id="git-line">Git: —</div>
    </div>
  </aside>

  <!-- CENTER: Terminal -->
  <section class="center" id="col-center">
    <div class="ws-topbar" id="ws-topbar">
      <div class="ws-info">
        <strong class="ws-name" id="ws-name" style="color:var(--sky)">—</strong>
        <span class="ws-path" id="ws-path" title="">No workspace</span>
      </div>
      <div class="ws-actions">
        <div class="ws-run-group">
          <div class="status-badge is-stopped" id="proj-status">
            <span class="dot" aria-hidden></span>
            <span id="proj-status-text">Stopped</span>
            <span class="cfg-name" id="proj-cfg" style="display:none"></span>
          </div>
          <div class="run-wrap" id="run-wrap">
            <button type="button" class="run-btn" id="btn-project-run" title="Run project">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><polygon points="5 3 13 8 5 13 5 3"/></svg>
              <span id="btn-project-label">Run</span>
            </button>
          </div>
        </div>
        <span class="meta-chip" id="meta-panes">0 panes</span>
        <span class="meta-chip" id="meta-tasks">0 tasks</span>
        <button type="button" class="btn-pane" id="btn-add-pane">+ Pane</button>
      </div>
    </div>
    <div class="pane-bar">
      <span class="pane-title" id="pane-title">Terminal</span>
      <span class="chip" id="pane-shell">—</span>
      <span class="chip tasks" id="pane-tasks"><span id="pane-task-n">0</span> tasks</span>
      <span class="chip live"><i></i> live</span>
      <select id="pane-select"></select>
    </div>
    <div class="term" id="log-box">Waiting for log…</div>
    <div class="composer-wrap">
      <div class="composer">
        <button type="button" class="ib" id="btn-tpl" title="Templates">+</button>
        <textarea id="prompt-text" rows="1" placeholder="Send a prompt or command…"></textarea>
        <button type="button" class="ib go" id="btn-send" title="Send">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="cmeta"><span class="busy" id="agent-busy">Ready</span><span>Enter send · Shift+Enter newline</span></div>
      <div class="tpl" id="tpl-row"></div>
    </div>
  </section>

  <!-- RIGHT: Tasks -->
  <aside class="right" id="col-right">
    <div class="right-h">
      <div>
        <h2>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Tasks
        </h2>
        <div class="sub"><b id="tasks-open">0</b> open · <span id="tasks-total">0</span> total</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <select id="right-mode" style="font-size:11px;padding:5px 8px;background:var(--elev);border:1px solid var(--border2);border-radius:6px;width:auto">
          <option value="tasks">Tasks</option>
          <option value="agents">Agents</option>
          <option value="runs">Runs</option>
        </select>
        <button type="button" class="btn btn-primary btn-sm" id="btn-new">+ New task</button>
      </div>
    </div>
    <div class="drawer" id="new-task-box">
      <label class="f"><span>Title</span><input id="task-title" placeholder="Task title"/></label>
      <label class="f"><span>Body</span><textarea id="task-body" placeholder="Details or prompt (optional)"></textarea></label>
      <div class="row">
        <label class="f" style="margin:0"><span>Priority</span>
          <select id="task-priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select>
        </label>
        <label class="f" style="margin:0"><span>Agent</span>
          <select id="task-agent"><option value="">—</option></select>
        </label>
      </div>
      <div class="row" style="margin-top:8px">
        <button type="button" class="btn btn-sm" id="btn-create">Create</button>
        <button type="button" class="btn btn-run btn-sm" id="btn-create-run">▶ Run</button>
      </div>
    </div>
    <div class="right-scroll">
      <div id="panel-tasks">
        <div class="chips" id="task-filter"></div>
        <div id="task-list"></div>
      </div>
      <div id="panel-agents" style="display:none"><div id="agent-list"></div></div>
      <div id="panel-runs" style="display:none">
        <div class="chips" id="run-filter"></div>
        <div id="run-list"></div>
      </div>
    </div>
  </aside>

  <footer class="statusbar">
    <span><b id="sb-ws">—</b></span>
    <span id="sb-pane">No pane</span>
    <span style="margin-left:auto" id="sb-tasks">0 open tasks</span>
    <span>Local mode</span>
  </footer>

  <nav class="m-tabs" id="m-tabs">
    <button type="button" data-col="side" class="on">
      <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>
      Spaces
    </button>
    <button type="button" data-col="center">
      <svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
      Terminal
    </button>
    <button type="button" data-col="right">
      <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      Tasks
    </button>
  </nav>
</div>
<div class="toast" id="toast"></div>

<script>
(function(){
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let token = sessionStorage.getItem('ad_token') || params.get('token') || '';
let taskFilter = 'all';
let runFilter = 'all';
let panes = [];
let agents = [];
let selectedPaneId = '';
let activeWorkspaceId = '';
let projectRun = { status: 'stopped', activeConfigId: null, activeConfig: null };
let runConfigs = [];
let defaultConfigId = null;

const TEMPLATES = [
  {label:'Explain error', text:'Explain the last error in the terminal and suggest a fix.'},
  {label:'Summarize', text:'Summarize this session: progress, risks, next steps.'},
  {label:'git status', text:'git status'},
  {label:'Review diff', text:'Review the current git diff for bugs and missing tests.'},
  {label:'Continue', text:'Continue from where you left off with small safe steps.'},
  {label:'Report only', text:'Stop coding. Report progress, blockers, and next steps only.'}
];

function toast(m){
  const e = $('toast');
  e.textContent = m;
  e.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => e.classList.remove('show'), 2000);
}
function setErr(id, m){
  const e = $(id);
  if (!m) { e.classList.remove('show'); e.textContent = ''; return; }
  e.textContent = m;
  e.classList.add('show');
}
function esc(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(s){ return esc(s).replace(/'/g,'&#39;'); }
function fmtTime(ts){
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch { return ''; }
}
function relTime(ts){
  if (!ts) return '';
  const d = new Date(ts).getTime();
  if (!d) return '';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

async function api(path, opts = {}){
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(path, {...opts, headers});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

function showApp(){
  $('gate').classList.remove('on');
  $('shell').classList.add('on');
}
function showGate(err){
  $('shell').classList.remove('on');
  $('gate').classList.add('on');
  setErr('gate-err', err || '');
}

function setMobileCol(col){
  ['side','center','right'].forEach((c) => {
    const el = $('col-' + c);
    if (el) el.classList.toggle('on', c === col);
  });
  document.querySelectorAll('.m-tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.col === col);
  });
}

function buildTpl(){
  $('tpl-row').innerHTML = TEMPLATES.map((t,i) =>
    '<button type="button" data-i="'+i+'">'+esc(t.label)+'</button>'
  ).join('');
  $('tpl-row').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const t = TEMPLATES[+b.dataset.i];
      const ta = $('prompt-text');
      ta.value = (ta.value ? ta.value.trimEnd() + '\\n\\n' : '') + t.text;
      ta.focus();
    });
  });
}

function buildChips(el, items, cur, onPick){
  el.innerHTML = items.map(([id,l]) =>
    '<button type="button" data-id="'+escA(id)+'" class="'+(cur===id?'on':'')+'">'+esc(l)+'</button>'
  ).join('');
  el.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => onPick(b.dataset.id));
  });
}

function fillPanes(){
  const sel = $('pane-select');
  if (!panes.length) {
    sel.innerHTML = '<option value="">No panes</option>';
    return;
  }
  sel.innerHTML = panes.map((p) =>
    '<option value="'+escA(p.id)+'"'+(p.id===selectedPaneId?' selected':'')+'>'+
    esc(p.title)+(p.active?' ★':'')+'</option>'
  ).join('');
}

function updatePaneChrome(){
  const p = panes.find((x) => x.id === selectedPaneId);
  $('pane-title').textContent = p?.title || 'Terminal';
  $('pane-shell').textContent = p?.shell || 'shell';
  $('sb-pane').textContent = p?.title || 'No pane';
  $('pane-task-n').textContent = $('st-open').textContent;
}

function fillWs(list){
  const root = $('ws-list');
  if (!list.length) {
    root.innerHTML = '<div class="empty">No workspaces</div>';
    return;
  }
  root.innerHTML = list.map((w) => {
    const path = w.rootPath || '';
    const short = path.length > 42 ? '…' + path.slice(-40) : path;
    const ago = relTime(w.lastOpenedAt || w.updatedAt || w.createdAt);
    return '<div class="ws'+(w.active?' on':'')+'" data-id="'+escA(w.id)+'">'+
      '<div class="n">'+esc(w.name)+'</div>'+
      '<div class="meta">'+
        '<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3.5v9a1 1 0 001 1h11a1 1 0 001-1v-7a1 1 0 00-1-1H7.5l-2-2h-3a1 1 0 00-1 1z"/></svg>'+
        esc(short)+
      '</div>'+
      (ago ? '<div class="meta"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><polyline points="8 4.5 8 8 10.5 9.5"/></svg>'+esc(ago)+'</div>' : '')+
      '<div class="meta">'+(w.active ? 'Active workspace' : ((w.paneCount||0)+' panes'))+'</div>'+
    '</div>';
  }).join('');
  root.querySelectorAll('.ws').forEach((el) => {
    if (el.classList.contains('on')) return;
    el.addEventListener('click', async () => {
      try {
        await api('/api/workspaces/active', {
          method:'POST',
          body: JSON.stringify({workspaceId: el.dataset.id})
        });
        toast('Workspace switched');
        await refreshAll();
      } catch (e) { toast(e.message); }
    });
  });
}

function updateProjectChrome(s){
  const ws = s.workspace;
  const color = ws?.color || '#38bdf8';
  const name = ws?.name || 'No workspace';
  const path = ws?.rootPath || '';
  activeWorkspaceId = ws?.id || '';
  runConfigs = ws?.runConfigs || [];
  defaultConfigId = ws?.defaultConfigId || null;
  projectRun = s.projectRun || { status: 'stopped', activeConfigId: null, activeConfig: null };

  $('ws-name').textContent = name;
  $('ws-name').style.color = color;
  $('ws-path').textContent = path || 'No workspace';
  $('ws-path').title = path;
  $('sb-ws').textContent = name;

  const paneCount = ws?.paneCount ?? (s.panes || []).length;
  const openTasks = s.openTasks ?? 0;
  $('meta-panes').textContent = paneCount + (paneCount === 1 ? ' pane' : ' panes');
  $('meta-tasks').textContent = openTasks + (openTasks === 1 ? ' task' : ' tasks');
  $('btn-add-pane').style.borderColor = color + '99';
  $('btn-add-pane').style.color = color;

  const st = projectRun.status || 'stopped';
  const badge = $('proj-status');
  badge.className = 'status-badge is-' + st;
  const labels = {
    stopped: 'Stopped',
    running: 'Running',
    starting: 'Starting',
    stopping: 'Stopping',
    failed: 'Failed'
  };
  $('proj-status-text').textContent = labels[st] || st;
  const cfg = projectRun.activeConfig;
  const cfgEl = $('proj-cfg');
  if (st !== 'stopped' && cfg?.name) {
    cfgEl.style.display = '';
    cfgEl.textContent = cfg.name;
  } else {
    cfgEl.style.display = 'none';
    cfgEl.textContent = '';
  }

  const wrap = $('run-wrap');
  const btn = $('btn-project-run');
  const lab = $('btn-project-label');
  const isStop = st === 'running' || st === 'starting' || st === 'stopping';
  wrap.classList.toggle('is-stop', isStop);
  lab.textContent = st === 'stopping' ? 'Stopping…' : (isStop ? 'Stop' : 'Run');
  btn.disabled = st === 'stopping' || st === 'starting';
  btn.title = isStop ? 'Stop project' : (runConfigs.length ? 'Run project' : 'No run config — set on desktop');
}

async function refreshStatus(){
  const s = await api('/api/status');
  $('conn').textContent = 'Online';
  $('conn').className = 'online';
  $('st-open').textContent = String(s.openTasks ?? 0);
  $('st-run').textContent = String(s.runningAgents ?? 0);
  $('st-panes').textContent = String((s.panes || []).length);
  $('tasks-open').textContent = String(s.openTasks ?? 0);
  $('tasks-total').textContent = String(s.taskCount ?? 0);
  $('sb-tasks').textContent = (s.openTasks ?? 0) + ' open tasks';
  $('agent-busy').textContent = (s.runningAgents > 0) ? 'Agent Busy' : 'Ready';
  $('agent-busy').className = (s.runningAgents > 0) ? 'busy' : '';
  panes = s.panes || [];
  selectedPaneId = s.activePaneId || panes[0]?.id || '';
  fillPanes();
  fillWs(s.workspaces || []);
  updatePaneChrome();
  updateProjectChrome(s);
}

async function refreshGit(){
  try {
    const g = await api('/api/git');
    if (!g.ok) {
      $('st-git').textContent = '—';
      $('git-line').textContent = g.error || 'No git';
      return;
    }
    $('st-git').textContent = String(g.changedCount || 0);
    $('git-line').textContent = 'Git: ' + (g.branch || '—') + ' · ' + (g.changedCount || 0) + ' changed';
  } catch (e) {
    $('git-line').textContent = e.message;
  }
}

function tcHtml(t){
  const pri = t.priority || 'medium';
  const ck = t.status === 'done' ? ' done' : (t.status === 'running' ? ' running' : (t.status === 'review' ? ' review' : ''));
  const agent = t.agentId ? agents.find((a) => a.id === t.agentId) : null;
  return '<div class="tc" data-id="'+escA(t.id)+'">'+
    '<div class="tc-h"><span class="tc-c'+ck+'"></span><div class="tc-t'+(t.status==='done'?' done':'')+'">'+esc(t.title)+'</div></div>'+
    '<div class="tc-m"><span class="pri '+pri+'"><i></i>'+pri.charAt(0).toUpperCase()+pri.slice(1)+'</span>'+
    (agent ? '<span class="bdg ag"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg> '+esc(agent.name)+'</span>' : '')+
    '</div><div class="tc-a">'+
    '<button type="button" class="btn btn-run btn-sm b-run" data-id="'+escA(t.id)+'">▶ Run</button>'+
    (t.status !== 'done' ? '<button type="button" class="btn btn-sm b-done" data-id="'+escA(t.id)+'">Done</button>' : '')+
    (t.status === 'done' ? '<button type="button" class="btn btn-sm b-re" data-id="'+escA(t.id)+'">Reopen</button>' : '')+
    '<button type="button" class="btn btn-danger btn-sm b-del" data-id="'+escA(t.id)+'">Del</button>'+
    '</div></div>';
}

function bindTasks(root){
  root.querySelectorAll('.b-run').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api('/api/tasks/'+encodeURIComponent(b.dataset.id)+'/run', {method:'POST', body:'{}'});
        toast('Run queued');
      } catch (e) { toast(e.message); }
      finally { b.disabled = false; }
    });
  });
  root.querySelectorAll('.b-done').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await api('/api/tasks/'+encodeURIComponent(b.dataset.id), {method:'PATCH', body:JSON.stringify({status:'done'})});
        await refreshTasks();
        await refreshStatus();
      } catch (e) { toast(e.message); }
    });
  });
  root.querySelectorAll('.b-re').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await api('/api/tasks/'+encodeURIComponent(b.dataset.id), {method:'PATCH', body:JSON.stringify({status:'todo'})});
        await refreshTasks();
        await refreshStatus();
      } catch (e) { toast(e.message); }
    });
  });
  root.querySelectorAll('.b-del').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete task?')) return;
      try {
        await api('/api/tasks/'+encodeURIComponent(b.dataset.id), {method:'DELETE'});
        toast('Deleted');
        await refreshTasks();
        await refreshStatus();
      } catch (e) { toast(e.message); }
    });
  });
}

async function refreshTasks(){
  const q = taskFilter === 'all' ? '' : '?status=' + encodeURIComponent(taskFilter);
  const {tasks} = await api('/api/tasks' + q);
  buildChips(
    $('task-filter'),
    [['all','All'],['todo','Todo'],['running','Run'],['review','Review'],['done','Done']],
    taskFilter,
    async (id) => { taskFilter = id; await refreshTasks(); }
  );
  const root = $('task-list');
  if (!tasks.length) {
    root.innerHTML = '<div class="empty">No tasks</div>';
    return;
  }
  if (taskFilter === 'all') {
    let html = '';
    for (const st of ['todo','running','review','done']) {
      const list = tasks.filter((t) => t.status === st);
      if (!list.length) continue;
      html += '<div class="col-h '+st+'">'+st+' <span class="cc">'+list.length+'</span></div>';
      html += list.map(tcHtml).join('');
    }
    root.innerHTML = html;
  } else {
    root.innerHTML = tasks.map(tcHtml).join('');
  }
  bindTasks(root);
}

async function refreshAgents(){
  const data = await api('/api/agents');
  agents = data.agents || [];
  const sel = $('task-agent');
  const cur = sel.value;
  sel.innerHTML = '<option value="">—</option>' + agents.map((a) =>
    '<option value="'+escA(a.id)+'">'+esc(a.name)+'</option>'
  ).join('');
  if (cur) sel.value = cur;
  const root = $('agent-list');
  if (!agents.length) {
    root.innerHTML = '<div class="empty">No agents</div>';
    return;
  }
  root.innerHTML = agents.map((a) =>
    '<div class="agent">'+
      '<div class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg></div>'+
      '<div class="inf"><strong>'+esc(a.name)+'</strong><small>'+esc(a.providerType||'cli')+(a.description?' · '+esc(a.description):'')+'</small></div>'+
      '<button type="button" class="btn btn-run btn-sm b-ag" data-id="'+escA(a.id)+'">▶ Run</button>'+
    '</div>'
  ).join('');
  root.querySelectorAll('.b-ag').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api('/api/agents/'+encodeURIComponent(b.dataset.id)+'/run', {
          method:'POST',
          body: JSON.stringify({paneId: $('pane-select').value || selectedPaneId || undefined})
        });
        toast('Agent started');
      } catch (e) { toast(e.message); }
      finally { b.disabled = false; }
    });
  });
}

async function refreshRuns(){
  const q = runFilter === 'all' ? '' : '?status=' + encodeURIComponent(runFilter);
  const {runs} = await api('/api/runs' + q);
  buildChips(
    $('run-filter'),
    [['all','All'],['running','Run'],['finished','Done'],['cancelled','Cancel'],['failed','Fail']],
    runFilter,
    async (id) => { runFilter = id; await refreshRuns(); }
  );
  const root = $('run-list');
  if (!runs.length) {
    root.innerHTML = '<div class="empty">No runs</div>';
    return;
  }
  root.innerHTML = runs.map((r) =>
    '<div class="run"><div class="run-h"><strong>'+esc(r.agentProfileId)+'</strong><span class="st '+escA(r.status)+'">'+esc(r.status)+'</span></div>'+
    (r.taskTitle ? '<div style="font-size:11px;color:var(--muted);margin-top:3px">'+esc(r.taskTitle)+'</div>' : '')+
    '<div class="cmd">'+esc(r.command||'')+'</div>'+
    '<div style="font-size:10px;color:var(--muted);margin-top:4px">'+esc(fmtTime(r.startedAt))+'</div></div>'
  ).join('');
}

async function refreshLog(){
  try {
    const paneId = $('pane-select').value || selectedPaneId || '';
    const q = paneId
      ? '?paneId=' + encodeURIComponent(paneId) + '&lines=150'
      : '?lines=150';
    const data = await api('/api/logs/tail' + q);
    const el = $('log-box');
    el.textContent = data.lines || '(empty)';
    el.scrollTop = el.scrollHeight;
  } catch (e) {
    $('log-box').textContent = e.message;
  }
}

async function refreshAll(){
  setErr('app-err', '');
  try {
    await Promise.all([
      refreshStatus(),
      refreshGit(),
      refreshTasks(),
      refreshAgents(),
      refreshRuns(),
      refreshLog()
    ]);
  } catch (e) {
    setErr('app-err', e.message);
    $('conn').textContent = 'Offline';
    $('conn').className = 'online off';
  }
}

async function sendPrompt(submit){
  const text = $('prompt-text').value;
  if (!text.trim()) return;
  const btn = $('btn-send');
  btn.disabled = true;
  try {
    await api('/api/prompt', {
      method:'POST',
      body: JSON.stringify({
        text,
        submit,
        paneId: $('pane-select').value || undefined
      })
    });
    toast(submit ? 'Sent' : 'Pasted');
    if (submit) $('prompt-text').value = '';
    setTimeout(() => refreshLog().catch(() => {}), 400);
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; }
}

async function createTask(run){
  const title = $('task-title').value.trim();
  const body = $('task-body').value.trim();
  const priority = $('task-priority').value;
  const agentId = $('task-agent').value || null;
  if (!title) { toast('Title required'); return; }
  const btn = run ? $('btn-create-run') : $('btn-create');
  btn.disabled = true;
  try {
    await api('/api/tasks', {
      method:'POST',
      body: JSON.stringify({title, body, run, priority, agentId})
    });
    $('task-title').value = '';
    $('task-body').value = '';
    $('new-task-box').classList.remove('on');
    toast(run ? 'Created & run' : 'Created');
    await refreshTasks();
    await refreshStatus();
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; }
}

async function boot(){
  if (!token) { showGate(); return; }
  try {
    await api('/api/status');
    sessionStorage.setItem('ad_token', token);
    if (params.has('token')) history.replaceState(null, '', location.pathname);
    showApp();
    buildTpl();
    if (window.matchMedia('(max-width:900px)').matches) setMobileCol('center');
    await refreshAll();
  } catch (e) {
    showGate(e.message || 'Auth failed');
  }
}

/* events */
document.querySelectorAll('.m-tabs button').forEach((b) => {
  b.addEventListener('click', () => setMobileCol(b.dataset.col));
});
$('btn-save-token').addEventListener('click', () => {
  token = $('token-input').value.trim();
  if (!token) { setErr('gate-err', 'Token required'); return; }
  boot();
});
$('btn-refresh').addEventListener('click', () => refreshAll());
$('btn-ws-info').addEventListener('click', () => refreshAll());
$('btn-send').addEventListener('click', () => sendPrompt(true));
$('prompt-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendPrompt(true);
  }
});
$('pane-select').addEventListener('change', async () => {
  selectedPaneId = $('pane-select').value;
  updatePaneChrome();
  try {
    await api('/api/panes/active', {
      method:'POST',
      body: JSON.stringify({paneId: selectedPaneId})
    });
  } catch {}
  refreshLog().catch(() => {});
});
$('btn-new').addEventListener('click', () => $('new-task-box').classList.toggle('on'));
$('btn-create').addEventListener('click', () => createTask(false));
$('btn-create-run').addEventListener('click', () => createTask(true));
$('right-mode').addEventListener('change', () => {
  const m = $('right-mode').value;
  $('panel-tasks').style.display = m === 'tasks' ? 'block' : 'none';
  $('panel-agents').style.display = m === 'agents' ? 'block' : 'none';
  $('panel-runs').style.display = m === 'runs' ? 'block' : 'none';
  $('btn-new').style.display = m === 'tasks' ? '' : 'none';
});
$('btn-tpl').addEventListener('click', () => {
  const row = $('tpl-row');
  row.style.display = row.style.display === 'none' ? 'flex' : (row.children.length ? 'flex' : 'flex');
});

$('btn-project-run').addEventListener('click', async () => {
  const st = projectRun.status || 'stopped';
  const btn = $('btn-project-run');
  btn.disabled = true;
  try {
    if (st === 'running' || st === 'starting') {
      await api('/api/project/stop', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: activeWorkspaceId || undefined })
      });
      toast('Stop requested');
    } else {
      if (!runConfigs.length) {
        toast('No run config — set on desktop first');
        return;
      }
      const configId = defaultConfigId || runConfigs[0]?.id;
      await api('/api/project/run', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: activeWorkspaceId || undefined, configId })
      });
      toast('Run started');
    }
    setTimeout(() => refreshStatus().catch(() => {}), 600);
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
});

$('btn-add-pane').addEventListener('click', async () => {
  try {
    await api('/api/panes', { method: 'POST', body: JSON.stringify({}) });
    toast('Pane added');
    setTimeout(() => refreshAll().catch(() => {}), 500);
  } catch (e) {
    toast(e.message);
  }
});

setInterval(() => {
  if ($('shell').classList.contains('on')) refreshStatus().catch(() => {});
}, 4000);

boot();
})();
</script>
</body>
</html>`;
}
