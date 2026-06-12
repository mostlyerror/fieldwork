// Builds a self-contained comparison gallery: each direction embedded via
// <iframe srcdoc> (isolated + offline), with a segmented switcher, an "All"
// contact grid, and a desktop/mobile width toggle for the single view.
import { readFileSync, writeFileSync } from "node:fs";

const DIRS = [
  { file: "01-dossier.html", name: "The Dossier", desc: "Analyst intelligence file — dense, divider-grouped recon with a case-file rail." },
  { file: "02-collector-card.html", name: "Collector Card", desc: "Player as a premium foil trading card; badges as the collectible centerpiece." },
  { file: "03-the-arc.html", name: "The Arc", desc: "Rating chart as the hero spine + a chronological timeline of the season." },
  { file: "04-editorial.html", name: "The Editorial", desc: "Quiet magazine spread; The Read as a big pull-quote, generous whitespace." },
  { file: "05-command-center.html", name: "Command Center", desc: "Asymmetric bento dashboard; every module a tile, all visible at a glance." },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const figures = DIRS.map((d, i) => {
  const html = readFileSync(new URL(d.file, import.meta.url), "utf8");
  return `      <figure data-i="${i}">
        <div class="vp"><iframe loading="lazy" srcdoc="${esc(html)}"></iframe></div>
        <figcaption><b>${i + 1}. ${d.name}</b><span>${d.desc}</span></figcaption>
      </figure>`;
}).join("\n");

const tabs = ['<button data-m="all" class="on">All</button>']
  .concat(DIRS.map((d, i) => `<button data-m="${i}">${i + 1}. ${d.name}</button>`))
  .join("");

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PickleRadar · Player Profile — 5 Directions</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--cream:#FFFDF7;--ink:#13231c;--emer:#065F46;--line:#e7e3d8;}
  *{box-sizing:border-box}
  body{margin:0;background:#f3f1e9;color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  header{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:14px;
    padding:12px 18px;background:rgba(255,253,247,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .brand{font-weight:800;letter-spacing:-.02em;font-size:15px;margin-right:6px;white-space:nowrap}
  .brand span{color:var(--emer)}
  .seg{display:flex;flex-wrap:wrap;gap:4px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px}
  .seg button{font:inherit;font-weight:700;font-size:12.5px;border:0;background:transparent;color:#6b7280;
    padding:6px 12px;border-radius:999px;cursor:pointer;transition:.15s}
  .seg button.on{background:var(--emer);color:#fff}
  .seg button:not(.on):hover{background:#f0efe7;color:var(--ink)}
  .width{display:none;margin-left:auto;gap:4px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px}
  .g.mode-single .width{display:flex}
  .width button{font:inherit;font-weight:700;font-size:12.5px;border:0;background:transparent;color:#6b7280;padding:6px 12px;border-radius:999px;cursor:pointer}
  .width button.on{background:var(--ink);color:#fff}
  main{padding:26px 18px 80px}
  .stage{margin:0 auto}
  /* ALL = contact grid of scaled desktop renders */
  .g.mode-all .stage{display:grid;grid-template-columns:repeat(auto-fill,460px);justify-content:center;gap:30px}
  .g.mode-all figure{margin:0;width:460px;cursor:pointer}
  .g.mode-all .vp{position:relative;height:540px;overflow:hidden;border-radius:16px;border:1px solid var(--line);
    background:#fff;box-shadow:0 18px 40px -28px rgba(6,40,30,.3);transition:transform .15s}
  .g.mode-all figure:active .vp{transform:scale(.99)}
  .g.mode-all .vp iframe{width:1280px;height:2700px;border:0;transform:scale(.359);transform-origin:top left;pointer-events:none}
  .g.mode-all .vp::after{content:"";position:absolute;left:0;right:0;bottom:0;height:64px;background:linear-gradient(transparent,#fff)}
  .g.mode-all figcaption{margin-top:10px}
  .g.mode-all figcaption b{display:block;font-size:14px}
  .g.mode-all figcaption span{display:block;color:#6b7280;font-size:12.5px;font-weight:500;line-height:1.45;margin-top:2px}
  /* SINGLE = one full-size render at chosen width */
  .g.mode-single figure{display:none;margin:0}
  .g.mode-single figure.active{display:block}
  .g.mode-single .vp{display:flex;justify-content:center;overflow:auto}
  .g.mode-single .vp iframe{border:1px solid var(--line);border-radius:20px;background:#fff;
    box-shadow:0 40px 90px -50px rgba(6,40,30,.5);height:1400px}
  .g.mode-single.w-desktop .vp iframe{width:1280px}
  .g.mode-single.w-mobile  .vp iframe{width:392px}
  .g.mode-single figcaption{display:none}
  .hint{max-width:560px;margin:0 auto 20px;text-align:center;color:#6b7280;font-size:13px;font-weight:500}
  .g.mode-single .hint{display:none}
</style></head>
<body>
<div class="g mode-all w-desktop" id="g">
  <header>
    <div class="brand">Pickle<span>Radar</span> · Player Profile</div>
    <div class="seg" id="seg">${tabs}</div>
    <div class="width" id="width"><button data-w="desktop" class="on">Desktop</button><button data-w="mobile">Mobile</button></div>
  </header>
  <main>
    <p class="hint">Five directions for the player profile. Click any tile to view it full-size and toggle Desktop / Mobile.</p>
    <div class="stage" id="stage">
${figures}
    </div>
  </main>
</div>
<script>
  var g=document.getElementById('g'), figs=[].slice.call(document.querySelectorAll('figure'));
  function measure(){ if(!g.classList.contains('mode-single'))return;
    var f=document.querySelector('figure.active iframe'); if(!f)return;
    try{ var d=f.contentDocument||f.contentWindow.document; var h=d.body.scrollHeight; if(h>200)f.style.height=(h+40)+'px'; }catch(e){} }
  function setMode(m){
    if(m==='all'){ g.className='g mode-all '+widthClass(); }
    else { g.className='g mode-single '+widthClass(); figs.forEach(function(f,i){ f.classList.toggle('active', i===+m); });
      setTimeout(measure,80); setTimeout(measure,400); }
    [].slice.call(document.querySelectorAll('#seg button')).forEach(function(b){ b.classList.toggle('on', b.dataset.m===String(m)); });
    window.scrollTo(0,0);
  }
  function widthClass(){ return document.querySelector('#width button.on').dataset.w==='mobile'?'w-mobile':'w-desktop'; }
  document.getElementById('seg').addEventListener('click',function(e){ var b=e.target.closest('button'); if(b)setMode(b.dataset.m); });
  document.getElementById('width').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b)return;
    [].slice.call(document.querySelectorAll('#width button')).forEach(function(x){x.classList.toggle('on',x===b)});
    g.classList.toggle('w-mobile', b.dataset.w==='mobile'); g.classList.toggle('w-desktop', b.dataset.w!=='mobile'); setTimeout(measure,80); });
  document.getElementById('stage').addEventListener('click',function(e){ if(!g.classList.contains('mode-all'))return;
    var fig=e.target.closest('figure'); if(fig)setMode(fig.dataset.i); });
</script>
</body></html>`;

writeFileSync(new URL("gallery.html", import.meta.url), page);
console.log("gallery.html written (" + (page.length / 1024).toFixed(0) + " KB), embeds " + DIRS.length + " directions");
