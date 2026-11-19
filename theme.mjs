// Giao diện: tối, kem + đỏ, chữ grotesk lớn (tham khảo phong cách tomdekoning.work).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { esc, fancy, mixTitle, emptyEdits, normEdits } from './render.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MV_VER = '4.0.0';  // phiên bản <model-viewer> (Google) cho model 3D ở hero
const V = Date.now().toString(36);   // số phiên bản cho script: mỗi lần build trình duyệt tải bản mới
export { fancy, mixTitle };

const STAR = `<svg class="star" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 0l2.4 19.6L48 24l-21.6 4.4L24 48l-2.4-19.6L0 24l21.6-4.4z" fill="currentColor"/></svg>`;


// Biểu tượng solid chuyển động cho từng mục (SVG nội tuyến, chỉ dùng CSS transform)
export const ICONS = {
  work: '<svg class="ic ic-work" viewBox="0 0 48 48" aria-hidden="true"><path class="l3" d="M24 4 44 14 24 24 4 14z"/><path class="l2" d="M24 20 44 30 24 40 4 30z" opacity=".75"/><path class="l1" d="M24 28 44 38 24 48 4 38z" opacity=".5"/></svg>',
  brands: '<svg class="ic ic-brands" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 42 13v22L24 45 6 35V13z" opacity=".35"/><path class="g" d="M24 10 36 17v14l-12 7-12-7V17z"/><circle cx="24" cy="24" r="4.5" fill="var(--bg)"/></svg>',
  products: '<svg class="ic ic-products" viewBox="0 0 48 48" aria-hidden="true"><rect class="a" x="5" y="5" width="17" height="17" rx="5"/><rect class="b" x="26" y="5" width="17" height="17" rx="5"/><rect class="c" x="5" y="26" width="17" height="17" rx="5"/><rect class="d" x="26" y="26" width="17" height="17" rx="5"/></svg>',
  contact: '<svg class="ic ic-contact" viewBox="0 0 48 48" aria-hidden="true"><path class="pl" d="M45 4 3 21l14 6 4 15 6-9 9 7z"/><path d="M45 4 17 27" stroke="var(--bg)" stroke-width="2" fill="none"/></svg>',
  home: '<svg class="ic ic-home" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 0l2.4 19.6L48 24l-21.6 4.4L24 48l-2.4-19.6L0 24l21.6-4.4z"/></svg>'
};
export const secHead = (key, label, extra = '') => `<div class="sec-h"><span class="sec-ic">${ICONS[key]}</span><h2 class="sec-t">${fancy(label)}</h2>${extra}</div>`;

export const CSS = `
:root{--bg:#0b0b0b;--fg:#e7e1d7;--mut:#8d887f;--card:#151514;--line:#2b2a27;--red:#ff1d12;--paper:#f1ede4}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;touch-action:manipulation}
input,select,textarea,button{font-size:max(16px,1em)}
@media (max-width:760px){input,select,textarea{font-size:16px!important}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "Bai Jamjuree","Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--fg);text-decoration:none}
::selection{background:var(--red);color:#fff}
.wrap{max-width:1280px;margin:0 auto;padding:0 20px}
.star{width:44px;height:44px;color:var(--red);flex:none}

/* tiêu đề như trang mẫu: Host Grotesk VN (bản Việt hoá, OFL) + chữ O nghiêng Playfair Display; chữ thường: Bai Jamjuree */
@font-face{font-family:"Host Grotesk VN";src:url(fonts/HostGroteskVN-Regular.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Host Grotesk VN";src:url(fonts/HostGroteskVN-Medium.woff2) format("woff2");font-weight:500;font-style:normal;font-display:swap}
h1,h2,h3,h6,.mega,.menu a,.modal h3,.mq{font-family:"Host Grotesk VN","Bai Jamjuree",sans-serif}
.mega,.ph h1,article h1,.login h1,h2.sec,.menu a,.mq{font-weight:400}
.meta h3,article h2,.modal h3{font-weight:500}
.o{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-weight:400;letter-spacing:-.02em}
/* thanh điều hướng Liquid Glass: kính mờ + bão hoà màu nền, viền khúc xạ, vệt sáng bóng */
.nav{position:fixed;top:12px;left:50%;z-index:36;transform:translateX(-50%);width:min(1180px,calc(100% - 24px));display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 6px 6px 20px;border-radius:999px;isolation:isolate;color:#fff;font:500 14px "Host Grotesk VN","Bai Jamjuree",sans-serif;text-transform:uppercase;letter-spacing:.02em;text-shadow:0 1px 10px rgba(0,0,0,.35);background:linear-gradient(120deg,rgba(255,255,255,.15),rgba(255,255,255,.05) 35%,rgba(255,255,255,.03) 65%,rgba(255,255,255,.12));-webkit-backdrop-filter:blur(14px) saturate(170%);backdrop-filter:blur(14px) saturate(170%);box-shadow:inset 0 1px 1px rgba(255,255,255,.5),inset 0 -1px 1px rgba(255,255,255,.12),inset 0 0 22px rgba(255,255,255,.07),0 10px 36px rgba(0,0,0,.38);transition:transform .55s cubic-bezier(.16,1,.3,1),opacity .4s}
.nav::before{content:"";position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;background:radial-gradient(120% 160% at 12% -40%,rgba(255,255,255,.38),transparent 46%),radial-gradient(90% 140% at 100% 140%,rgba(255,255,255,.16),transparent 52%)}
.nav::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.75),rgba(255,255,255,.06) 38%,rgba(255,255,255,.04) 62%,rgba(255,255,255,.5));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.nav a{color:#fff}
.nav-logo{white-space:nowrap}
.nav-links{display:flex;gap:2px}
.nav-links a{padding:10px 16px;border-radius:999px;transition:background .3s,box-shadow .3s}
.nav-links a:hover,.nav-links a.on{background:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(255,255,255,.08)}
.nav-yr{padding:10px 14px;white-space:nowrap;opacity:.9}
@media (max-width:760px){.nav-links{display:none}.nav{padding:6px 6px 6px 16px;font-size:13px}}
@media (max-width:480px){.nav-yr{display:none}}

/* nút MENU */
.nav-menu{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.4);transition:background .3s}
.nav-menu:hover{background:rgba(255,255,255,.24)}
.nav-menu i{display:block;width:18px;height:2.5px;border-radius:2px;background:#fff;transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .25s,width .3s}
.nav-menu i:nth-child(2){width:12px;background:var(--red);align-self:flex-end;margin-right:13px}
.nav-menu:hover i:nth-child(2){width:18px;margin-right:13px}
.nav-menu.open i:nth-child(1){transform:translateY(7.5px) rotate(45deg)}
.nav-menu.open i:nth-child(2){opacity:0}
.nav-menu.open i:nth-child(3){transform:translateY(-7.5px) rotate(-45deg)}
.menu{position:fixed;inset:0;z-index:35;background:var(--bg);display:none;flex-direction:column;justify-content:center;padding:80px 20px 120px}
.menu.on{display:flex}
.menu a{display:block;font-size:clamp(44px,12vw,120px);line-height:1.02;letter-spacing:-.04em;text-transform:uppercase;padding:6px 0;border-bottom:1px solid var(--line)}
.menu a:hover{color:var(--red)}
.menu small{margin-top:22px;color:var(--mut);font-size:14px;text-transform:uppercase}

/* hero */
.hero{position:relative;min-height:100svh;overflow:hidden;display:flex;align-items:flex-end;padding:96px 0 110px}
.redpanel{position:absolute;top:0;left:13%;width:min(62vw,560px);height:78%;background:linear-gradient(#0b0b0b 0%,#7a0a05 38%,var(--red) 100%);border-radius:0 0 22px 22px;overflow:hidden;transform-origin:top}
.redpanel img{position:absolute;bottom:0;left:50%;height:92%;width:auto;max-width:none;transform:translateX(-50%);filter:contrast(1.05)}
.redpanel .hero3d{position:absolute;left:0;right:0;bottom:2%;top:12%;width:100%;height:auto;background:transparent;--poster-color:transparent;--progress-bar-color:transparent;outline:none}
.hero .wrap{position:relative;width:100%}
.tag{display:flex;gap:26px;align-items:center;padding-bottom:26px;margin-bottom:22px;border-bottom:1px solid var(--line);max-width:760px;margin-left:auto}
.tag p{margin:0;font-size:clamp(16px,2.2vw,22px);line-height:1.35;max-width:520px}
.mega{margin:0;text-align:right;text-transform:uppercase;font-weight:500;font-size:clamp(60px,15.5vw,230px);line-height:.88;letter-spacing:-.055em}
.mega .r{color:var(--red)}

/* tiêu đề trang con */
.ph{padding:150px 0 28px}
.ph h1{margin:0;text-transform:uppercase;font-weight:500;font-size:clamp(44px,9vw,128px);line-height:.92;letter-spacing:-.05em}
.ph p{margin:18px 0 0;color:var(--mut);font-size:18px;max-width:640px}
.secbar{display:flex;justify-content:space-between;align-items:center;gap:14px;border-top:1px solid var(--line);padding:14px 0;margin-top:26px;text-transform:uppercase;font-size:14px;color:var(--mut);letter-spacing:.04em}
.secbar input{background:transparent;border:1px solid var(--line);border-radius:999px;color:var(--fg);padding:9px 16px;font:inherit;text-transform:none;min-width:220px}
.secbar input:focus{outline:none;border-color:var(--fg)}
h2.sec{margin:46px 0 0;font-size:clamp(28px,5vw,56px);font-weight:500;letter-spacing:-.04em;text-transform:uppercase;line-height:1}

/* thẻ */
.grid,.cgrid{display:grid;gap:14px;padding:16px 0 60px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.cgrid{padding:16px 0 8px}
.card{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:border-color .2s,transform .2s}
.card:hover{border-color:var(--red);transform:translateY(-3px)}
.thumb{aspect-ratio:4/3;width:100%;min-height:0;overflow:hidden;background:var(--paper);display:flex;align-items:center;justify-content:center;padding:20px}
.thumb img{width:100%;height:100%;object-fit:contain}
.thumb.empty{color:#999;font-size:46px;font-weight:600}
.cgrid .thumb{aspect-ratio:3/2;padding:0;background:#222}
.cgrid .thumb img{width:100%;height:100%;object-fit:cover;max-height:none}
.meta{padding:14px 16px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.meta .no{color:var(--red);font-size:13px;letter-spacing:.06em}
.meta h3{margin:0;font-size:22px;letter-spacing:-.02em;text-transform:uppercase;line-height:1.1}
.meta p{margin:0;color:var(--mut);font-size:14px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dots{display:flex;gap:6px;margin-top:auto;padding-top:8px}
.dots i,.sw{display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.3)}
.sw{margin-right:6px;vertical-align:-2px}

/* bài viết */
.back{display:inline-block;margin-top:96px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.back:hover{color:var(--red)}
article{padding:20px 0 90px;max-width:820px}
article h1{font-size:clamp(40px,8vw,104px);font-weight:500;letter-spacing:-.05em;line-height:.95;margin:10px 0 18px;text-transform:uppercase}
.lead{font-size:20px;color:var(--mut);margin:0 0 28px}
article h2{margin:42px 0 10px;font-size:26px;letter-spacing:-.02em;text-transform:uppercase;border-top:1px solid var(--line);padding-top:18px}
article h3{margin:24px 0 8px}
article a{color:var(--red);border-bottom:1px solid currentColor}
article figure{margin:20px 0;background:var(--paper);border-radius:14px;padding:22px;text-align:center}
article img{max-width:100%;height:auto;border-radius:6px}
article p>img{display:block;margin:12px 0}
code{font:13.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.09);padding:2px 6px;border-radius:6px}
.tw{overflow-x:auto;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
blockquote{margin:16px 0;padding:4px 16px;border-left:3px solid var(--red);color:var(--mut)}
pre{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
/* chân trang như trang mẫu: khung tối, ánh đỏ từ dưới, ngôi sao lớn, chữ chạy ngang */
.ft{padding:0 12px 12px;margin-top:40px}
.ftbox{position:relative;overflow:hidden;border-radius:22px;border:1px solid var(--line);background:radial-gradient(120% 80% at 50% 115%,var(--red) 0%,#7a0a05 30%,#1a0605 55%,#0b0b0b 75%);min-height:min(92vh,760px);display:flex;flex-direction:column;justify-content:space-between}
.ftrow{display:flex;justify-content:space-between;gap:16px;padding:22px 24px;text-transform:uppercase;font-size:15px;letter-spacing:.02em}
.ftrow h6{margin:0;font-size:15px;font-weight:400}
.ftmid{position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:0 24px;flex:1}
.ftcol{display:flex;flex-direction:column;gap:14px;text-transform:uppercase;font-size:15px;z-index:2;padding-bottom:22px}
.ftcol.r{text-align:right;align-items:flex-end}
.ftcol small{display:block;color:var(--mut);font-size:12px;letter-spacing:.06em}
.ftstar{position:absolute;left:50%;top:46%;width:min(42vw,340px);height:min(42vw,340px);transform:translate(-50%,-50%);perspective:800px;pointer-events:none}
.ftstar svg{width:100%;height:100%;color:#1c0a08;animation:turn 9s linear infinite;will-change:transform}
@keyframes turn{to{transform:rotateY(360deg)}}
.sl{display:inline-block;overflow:hidden;vertical-align:top;line-height:1.25}
.sl b{display:block;font-weight:inherit;transition:transform .55s cubic-bezier(.16,1,.3,1)}
.sl b+b{position:absolute}.sl{position:relative}
.sl i{font-style:normal;display:inline-block;transition:transform .5s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i)*14ms)}
.sl b+b i{transform:translateY(110%)}
.sl:hover b:first-child i{transform:translateY(-110%)}.sl:hover b+b i{transform:none}
.marq{overflow:hidden;white-space:nowrap;padding:0 0 10px;position:relative;z-index:1}
.mq-track{display:inline-flex;animation:mq 26s linear infinite;will-change:transform}
.mq{font-size:clamp(70px,17vw,250px);line-height:.9;text-transform:uppercase;letter-spacing:-.05em;padding-right:.35em}
.mq .r{color:var(--red)}
@keyframes mq{to{transform:translateX(-50%)}}
@media (max-width:640px){.ftmid{flex-direction:column;align-items:flex-start;justify-content:flex-end}.ftcol.r{text-align:left;align-items:flex-start}.ftstar{top:30%}}
@media (prefers-reduced-motion:reduce){.mq-track,.ftstar svg{animation:none}}

/* carousel dự án (bản nhẹ) */
.gcar{position:relative;padding:20px 0 60px;outline:none}
.gc-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;text-transform:uppercase;font-size:14px;color:var(--mut);letter-spacing:.04em;border-top:1px solid var(--line);padding-top:14px}
.gc-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:999px;overflow-x:auto;max-width:100%;scrollbar-width:none}
.gc-tabs::-webkit-scrollbar{display:none}
.gc-tab{flex:none;background:none;border:0;color:var(--mut);padding:10px 18px;border-radius:999px;font:500 13px "Host Grotesk VN","Bai Jamjuree",sans-serif;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;transition:background .25s,color .25s}
.gc-tab:hover{color:var(--fg)}
.gc-tab.on{background:var(--fg);color:#0b0b0b}
.gc-tab sup{font-size:10px;margin-left:5px;opacity:.7}
.gc-hint{font-size:12px}
.gc-title{text-align:center;margin:34px 20px 22px;min-height:104px}
.gc-title h3{margin:0;font-size:clamp(34px,6vw,78px);line-height:1;text-transform:uppercase;font-weight:400;letter-spacing:-.04em}
.gc-title p{margin:10px 0 0;color:var(--mut);font-size:13px;text-transform:uppercase;letter-spacing:.08em}
.gcar.tt .gc-title h3,.gcar.tt .gc-title p{animation:gcin .55s cubic-bezier(.16,1,.3,1)}
@keyframes gcin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.gc-stage{position:relative;height:min(40vw,440px);perspective:1400px;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none;--w:560px}
.gc-stage.drag{cursor:grabbing}
.gc-track{position:absolute;inset:0;transform-style:preserve-3d;transition:opacity .22s}
.gc-track.out{opacity:0}
.gc-card{position:absolute;left:50%;top:0;width:var(--w);height:100%;margin-left:calc(var(--w) / -2);border-radius:22px;overflow:hidden;background:var(--bg,#f1ede4);will-change:transform,opacity;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.gc-card img{width:100%;height:100%;object-fit:contain;padding:6%;transition:opacity .25s;pointer-events:none;-webkit-user-drag:none}
.gc-card.cover img{object-fit:cover;padding:0}
.gc-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.28),rgba(255,255,255,0) 32%,rgba(255,255,255,0) 72%,rgba(255,255,255,.12));box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.gc-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--mut);font-size:15px;text-transform:uppercase;letter-spacing:.06em;padding:20px}
.gc-empty[hidden]{display:none}
.gc-foot{display:flex;justify-content:center;align-items:center;gap:22px;margin-top:26px;font-size:13px;letter-spacing:.1em}
.gc-nav{background:none;border:1px solid var(--line);color:var(--fg);width:46px;height:46px;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;transition:border-color .2s,background .2s}
.gc-nav:hover{border-color:var(--fg);background:rgba(255,255,255,.04)}
@media (max-width:640px){.gc-stage{height:76vw}.gc-hint{display:none}.gc-head{justify-content:center}.gc-head>.sec-t{display:none}.gc-tabs{width:100%;justify-content:space-between}.gc-tab{padding:9px 10px;font-size:11px;letter-spacing:.03em}.gc-tab sup{margin-left:3px}}

/* thư viện ảnh */
.masonry{columns:230px;column-gap:12px;padding:6px 0 48px}
.masonry>*{position:relative;display:block;margin:0 0 12px;break-inside:avoid;border-radius:10px;overflow:hidden;background:var(--card);border:1px solid var(--line)}
.masonry img{display:block;width:100%;height:auto}
h3.album{margin:34px 0 8px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;border-top:1px solid var(--line);padding-top:14px}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.94);display:none;align-items:center;justify-content:center;z-index:60;flex-direction:column;padding:16px}
.lb.on{display:flex}
.lb img{max-width:100%;max-height:calc(100vh - 90px);object-fit:contain;border-radius:6px}
.lb p{color:#ddd;margin:10px 0 0;font-size:14px;text-align:center;max-width:90vw}
.lb button{position:absolute;top:12px;right:14px;background:none;border:0;color:#fff;font-size:34px;cursor:pointer;line-height:1}
.lb .nv{position:absolute;top:50%;transform:translateY(-50%);font-size:40px;padding:8px 14px}
.lb .pv{left:6px;right:auto}.lb .nx{right:6px}

/* đăng nhập + quản trị */
.login{max-width:520px;padding:170px 0 90px}
.login h1{margin:0 0 14px;font-size:clamp(40px,9vw,88px);font-weight:500;letter-spacing:-.05em;line-height:.95;text-transform:uppercase}
.login p{color:var(--mut)}
.login label{display:block;margin:22px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.login input[type=password],.login input[type=text]{width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--fg);padding:16px;font:16px ui-monospace,Menlo,monospace}
.login input:focus{outline:none;border-color:var(--red)}
.login .row{display:flex;gap:10px;align-items:center;margin-top:14px;color:var(--mut);font-size:14px}
.btn{display:inline-flex;align-items:center;gap:10px;margin-top:22px;background:var(--red);color:#fff;border:0;border-radius:12px;padding:16px 26px;font:600 15px "Bai Jamjuree",sans-serif;text-transform:uppercase;cursor:pointer}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--fg)}
.btn:disabled{opacity:.5;cursor:wait}
.msg{margin-top:18px;font-size:15px}
.msg.err{color:#ff7a70}.msg.ok{color:#8fe08f}
.login ol{padding-left:20px;color:var(--mut);font-size:15px}
.login ol a{color:var(--red)}
.del{display:none;position:absolute;top:8px;right:8px;z-index:5;background:var(--red);color:#fff;border:0;border-radius:8px;padding:7px 12px;font:600 12px "Bai Jamjuree",sans-serif;text-transform:uppercase;cursor:pointer}
body.admin .del{display:block}
.adminbar{display:none;position:fixed;left:16px;bottom:16px;z-index:40;background:var(--red);color:#fff;border-radius:12px;padding:12px 16px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
body.admin .adminbar{display:block}
.modal{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:20px}
.modal.on{display:flex}
.modal .box{background:#161615;border:1px solid var(--line);border-radius:16px;padding:28px;max-width:460px;width:100%}
.modal h3{margin:0 0 10px;font-size:26px;letter-spacing:-.03em;text-transform:uppercase}
.modal p{margin:0;color:var(--mut)}.modal p b{color:var(--fg)}
.acts{display:flex;gap:10px;flex-wrap:wrap}.modal .acts{margin-top:24px;justify-content:flex-end}
.modal .btn{margin-top:0}.btn.safe{background:#2f8f46}
.trow{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line);padding:16px 0}
.trow small{display:block;color:var(--mut);margin-top:2px}.trow .btn{margin-top:0;padding:11px 18px}
.sub{color:var(--mut)}
.toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:70;background:#fff;color:#111;border-radius:10px;padding:12px 18px;font-size:14px;box-shadow:0 10px 40px rgba(0,0,0,.5);display:none;max-width:90vw}
.toast.on{display:block}

/* sửa tên, sắp xếp, gộp, chuyển (chỉ khi đăng nhập) */
.ctl{display:none;position:absolute;top:8px;left:8px;z-index:5;gap:4px;flex-wrap:wrap;max-width:calc(100% - 90px)}
body.admin .ctl{display:flex}
.ctl button,.pgbtn{background:rgba(11,11,11,.9);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font:600 12px "Bai Jamjuree",sans-serif;cursor:pointer;text-transform:uppercase}
.ctl button:hover,.pgbtn:hover{border-color:var(--fg)}
.gtools{display:none;gap:8px;flex-wrap:wrap;margin:6px 0 18px}
body.admin .gtools{display:flex}
.gtools .btn{margin-top:0;padding:11px 16px}
.selbar{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:45;background:#161615;border:1px solid var(--red);border-radius:14px;padding:10px 14px;display:none;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:94vw}
.selbar.on{display:flex}.selbar .btn{margin-top:0;padding:10px 14px}.selbar span{font-size:14px;color:var(--fg)}
body.selecting .masonry a{cursor:pointer}body.selecting .del{display:none}
.masonry a.picked{outline:3px solid var(--red);outline-offset:-3px}
.masonry a.picked::after{content:"✓";position:absolute;top:8px;left:8px;background:var(--red);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
.dragging{opacity:.35}
.dropb{box-shadow:-5px 0 0 var(--red)}.dropa{box-shadow:5px 0 0 var(--red)}
.dropb.y{box-shadow:0 -5px 0 var(--red)}.dropa.y{box-shadow:0 5px 0 var(--red)}
.fld{width:100%;margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:10px;color:var(--fg);padding:13px;font:16px "Bai Jamjuree",sans-serif}
.fld:focus{outline:none;border-color:var(--red)}
.del-page,.ren-page{margin-right:10px}

/* hiệu ứng chuyển động (học từ tomdekoning.work) */
.star{animation:spin 14s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cm{display:inline-block;overflow:clip;vertical-align:top;padding:.1em .06em .14em;margin:-.1em -.06em -.14em}
.w{display:inline-block;white-space:nowrap}
.fx .ch{display:inline-block;transform:translateY(112%)}
.fx .in .ch,.fx .ch.in{transform:none;transition:transform 1s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i)*22ms)}
.fx .mega.in .ch{transition-delay:calc(.45s + var(--i)*34ms)}
.fx .rv{opacity:0;transform:translateY(38px)}
.fx .rv.in{opacity:1;transform:none;transition:opacity .9s ease,transform 1s cubic-bezier(.16,1,.3,1),border-color .2s}
.fx .card.rv.in:hover{transform:translateY(-3px)}
.fx .redpanel{transform:scaleY(0)}
.fx-ready .redpanel{transform:none;transition:transform 1.3s cubic-bezier(.16,1,.3,1)}
.fx .redpanel img{opacity:0;margin-bottom:-40px}
.fx-ready .redpanel img{opacity:1;margin-bottom:0;transition:opacity 1.2s .5s,margin 1.4s .5s cubic-bezier(.16,1,.3,1)}
.fx .redpanel .hero3d{opacity:0;top:20%;bottom:-6%}
.fx-ready .redpanel .hero3d{opacity:1;top:12%;bottom:2%;transition:opacity 1.2s .5s,top 1.4s .5s cubic-bezier(.16,1,.3,1),bottom 1.4s .5s cubic-bezier(.16,1,.3,1)}
.fx-off .ch,.fx-off .rv,.fx-off .redpanel,.fx-off .redpanel img,.fx-off .redpanel .hero3d{transform:none!important;opacity:1!important;margin:0!important}
.fx-off .redpanel img{transform:translateX(-50%)!important}
.fx-off .redpanel .hero3d{top:12%!important;bottom:2%!important}
.menu.on a,.menu.on small{animation:mrise .8s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0)*80ms + 80ms)}
@keyframes mrise{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
.cursor-dot{position:fixed;left:0;top:0;z-index:90;width:16px;height:16px;border-radius:50%;background:var(--red);pointer-events:none;opacity:0;mix-blend-mode:difference;transition:opacity .3s,width .25s,height .25s}
.cursor-dot.on{opacity:1}.cursor-dot.big{width:58px;height:58px}
@media (prefers-reduced-motion:reduce){.star{animation:none}.menu.on a,.menu.on small{animation:none}}


/* biểu tượng solid chuyển động + tiêu đề từng mục */
.ic{width:100%;height:100%;fill:url(#lgi);overflow:visible}
.sec-h{display:flex;align-items:center;gap:16px;border-top:1px solid var(--line);padding-top:26px}
/* Liquid Glass (theo hướng dẫn Apple): ô vuông bo siêu elip, nền kính nhuộm màu, vệt sáng phản chiếu ở mép trên-trái, bóng đổ mềm; hình icon là lớp kính trong nằm nổi phía trên */
.sec-ic{width:64px;height:64px;flex:none;position:relative;display:grid;place-items:center;border-radius:30%;isolation:isolate;background:linear-gradient(150deg,rgba(255,86,70,.92),rgba(255,29,18,.42) 55%,rgba(110,8,4,.7));box-shadow:inset 1.5px 1.5px 1px rgba(255,255,255,.7),inset -1px -1px 1px rgba(255,255,255,.2),inset 0 0 20px rgba(255,255,255,.14),0 12px 26px rgba(255,29,18,.3),0 2px 6px rgba(0,0,0,.45)}
.sec-ic::before{content:"";position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;background:radial-gradient(110% 75% at 22% -5%,rgba(255,255,255,.6),transparent 56%),radial-gradient(80% 60% at 100% 110%,rgba(255,255,255,.2),transparent 60%)}
.sec-ic::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:linear-gradient(140deg,rgba(255,255,255,.85),rgba(255,255,255,0) 40%,rgba(255,255,255,0) 62%,rgba(255,255,255,.4));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.sec-ic svg{width:56%;height:56%;filter:drop-shadow(0 3px 3px rgba(80,0,0,.45))}
.sec-t{margin:0;font-size:clamp(34px,6vw,76px);line-height:1;text-transform:uppercase;font-weight:400;letter-spacing:-.04em}
.sec-r{margin-left:auto;display:flex;align-items:center;gap:12px;text-transform:uppercase;font-size:14px;color:var(--mut)}
.ic-work path{animation:lay 3.2s ease-in-out infinite}.ic-work .l2{animation-delay:.25s}.ic-work .l1{animation-delay:.5s}
@keyframes lay{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.ic-brands .g{transform-origin:24px 24px;animation:gem 3.6s ease-in-out infinite}
@keyframes gem{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.14) rotate(8deg)}}
.ic-products rect{transform-box:fill-box;transform-origin:center;animation:pop 2.8s ease-in-out infinite}
.ic-products .b{animation-delay:.2s}.ic-products .d{animation-delay:.4s}.ic-products .c{animation-delay:.6s}
@keyframes pop{0%,60%,100%{transform:scale(1)}30%{transform:scale(.72)}}
.ic-contact .pl{transform-box:fill-box;transform-origin:center;animation:fly 3s ease-in-out infinite}
@keyframes fly{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(3px,-4px) rotate(-6deg)}}
.ic-home{animation:spin 14s linear infinite}
.nav-links a svg{width:17px;height:17px;margin-right:7px;vertical-align:-3px;fill:url(#lgi);overflow:visible;filter:drop-shadow(0 0 5px rgba(255,29,18,.75))}
section[id],footer[id]{scroll-margin-top:84px}
.sect{padding:34px 0 40px}
.pgrid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));padding:22px 0 8px}
.pc{position:relative;display:block;border-radius:16px;overflow:hidden;background:#1a1a19;aspect-ratio:4/3;border:1px solid var(--line)}
.pc img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.16,1,.3,1)}
.pc:hover img{transform:scale(1.06)}
.pc span{position:absolute;left:0;right:0;bottom:0;padding:34px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.78));font-size:15px}
.pc small{display:block;color:#cfc9bf;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.more{display:inline-flex;align-items:center;gap:10px;margin-top:20px;border:1px solid var(--line);border-radius:999px;padding:13px 22px;text-transform:uppercase;font-size:13px;letter-spacing:.05em;transition:background .25s,color .25s}
.more:hover{background:var(--fg);color:#0b0b0b}
@media (prefers-reduced-motion:reduce){.ic *,.ic{animation:none!important}}


/* nút nổi: lên đầu trang + liên hệ Zalo / điện thoại */
.fab{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:38;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.fab-b{width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;padding:0;-webkit-backdrop-filter:blur(12px) saturate(170%);backdrop-filter:blur(12px) saturate(170%);box-shadow:inset 0 1px 1px rgba(255,255,255,.4),0 8px 24px rgba(0,0,0,.4);transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s}
.fab-b:active{transform:scale(.92)}
.fab-b svg{width:24px;height:24px;fill:url(#lgi);filter:drop-shadow(0 2px 3px rgba(60,0,0,.4))}
.fab-c{background:linear-gradient(150deg,rgba(255,96,80,.95),rgba(255,29,18,.55) 60%,rgba(120,8,4,.75));box-shadow:inset 1.5px 1.5px 1px rgba(255,255,255,.7),inset -1px -1px 1px rgba(255,255,255,.2),0 12px 26px rgba(255,29,18,.35),0 2px 6px rgba(0,0,0,.4)}
.fab-c svg{animation:wig 2.6s ease-in-out infinite;transform-origin:50% 60%}
@keyframes wig{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-14deg)}82%{transform:rotate(12deg)}88%{transform:rotate(-8deg)}94%{transform:rotate(5deg)}}
.fab-c::after{content:"";position:absolute;inset:-1px;border-radius:50%;border:2px solid var(--red);animation:ring 2.6s ease-out infinite;pointer-events:none}
.fab-c{position:relative}
@keyframes ring{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(1.55);opacity:0}}
.fab-up{background:linear-gradient(150deg,rgba(255,255,255,.28),rgba(255,255,255,.08));opacity:0;transform:translateY(12px);pointer-events:none}
.fab-up.on{opacity:1;transform:none;pointer-events:auto}
.fab-up svg{animation:upb 1.8s ease-in-out infinite}
@keyframes upb{0%,100%{transform:translateY(2px)}50%{transform:translateY(-3px)}}
.fab-m{display:flex;flex-direction:column;gap:10px;align-items:flex-end;opacity:0;transform:translateY(10px) scale(.9);transform-origin:bottom right;pointer-events:none;transition:opacity .25s,transform .35s cubic-bezier(.16,1,.3,1)}
.fab.open .fab-m{opacity:1;transform:none;pointer-events:auto}
.fab-m a{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;border-radius:999px;color:#fff;font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.fab-m a i{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800;font-size:12px}
.fab-m a svg{width:18px;height:18px;fill:currentColor}
.fab-z{background:linear-gradient(150deg,rgba(60,140,255,.95),rgba(0,104,255,.55));box-shadow:inset 1.5px 1.5px 1px rgba(255,255,255,.65),0 10px 24px rgba(0,104,255,.3)}.fab-p{background:linear-gradient(150deg,rgba(70,210,120,.95),rgba(31,168,85,.55));box-shadow:inset 1.5px 1.5px 1px rgba(255,255,255,.65),0 10px 24px rgba(31,168,85,.3)}
@media (prefers-reduced-motion:reduce){.fab-c svg,.fab-c::after,.fab-up svg{animation:none}}

/* đăng ký / đăng nhập thành viên */
.login input[type=email]{width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;color:var(--fg);padding:16px;font:16px "Bai Jamjuree",sans-serif}
.login input[type=email]:focus{outline:none;border-color:var(--red)}
.login input[type=text]:not(#tok){font-family:"Bai Jamjuree",sans-serif}
.tabs{display:flex;gap:6px;margin:6px 0 4px;border:1px solid var(--line);border-radius:12px;padding:4px}
.tabs button{flex:1;background:none;border:0;color:var(--mut);padding:11px;border-radius:9px;font:600 14px "Bai Jamjuree",sans-serif;text-transform:uppercase;cursor:pointer}
.tabs button.on{background:var(--fg);color:#0b0b0b}
.sbtn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;margin-top:12px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:12px;padding:15px;font:600 15px "Bai Jamjuree",sans-serif;cursor:pointer}
.sbtn:hover{border-color:var(--fg)}.sbtn svg{width:20px;height:20px}
.sbtn:disabled,.login .btn:disabled{opacity:.5;cursor:wait}
.or{display:flex;align-items:center;gap:12px;margin:26px 0 0;color:var(--mut);font-size:13px;text-transform:uppercase;letter-spacing:.05em}
.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.login .btn.full{width:100%;justify-content:center}
.login a.lnk{color:var(--mut);font-size:14px;border-bottom:1px solid currentColor}
.acct{display:flex;gap:16px;align-items:center;margin-top:10px}.acct img{width:64px;height:64px;border-radius:50%;object-fit:cover}
.acct b{display:block;font-size:20px}.acct span{color:var(--mut);font-size:14px}
.login code{word-break:break-all}
`;

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bai+Jamjuree:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,400;1,500&display=swap" rel="stylesheet">`;

// trang chủ: hero lớn
export function hero(cfg) {
  const img = cfg.heroImage ? `<img src="${esc(cfg.heroImage)}" alt="" data-speed="-0.06">` : '';
  const h3 = cfg.hero3d;  // model 3D thay ảnh trong khối đỏ (xem models/README.md)
  const mv = h3 && h3.src ? `<model-viewer class="hero3d" src="${esc(h3.src)}"${h3.poster ? ` poster="${esc(h3.poster)}"` : ''} alt="${esc(h3.alt || '')}"
 environment-image="${esc(h3.env || 'neutral')}" tone-mapping="neutral" exposure="${esc(String(h3.exposure ?? 1.1))}" shadow-intensity="0.3" shadow-softness="1"
 camera-orbit="-20deg 82deg auto" min-camera-orbit="auto 60deg auto" max-camera-orbit="auto 100deg auto" field-of-view="26deg"
 data-sway="${esc(String(h3.sway ?? 28))}" camera-controls disable-zoom disable-pan interaction-prompt="none" touch-action="pan-y" data-speed="-0.06"></model-viewer>
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@${MV_VER}/dist/model-viewer.min.js"></script>
<script>/* lắc chữ qua lại ±sway độ (luôn đọc được chữ), tạm dừng khi người xem kéo xoay, dừng khi cuộn khỏi hero hoặc khi bật giảm chuyển động */
(function(){var m=document.querySelector('.hero3d');if(!m||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var a=Number(m.dataset.sway)||28,t0=performance.now(),hold=0;
m.addEventListener('camera-change',function(e){if(e.detail.source==='user-interaction')hold=performance.now()+2500});
(function f(t){if(t>hold&&m.loaded&&scrollY<innerHeight)m.cameraOrbit=(-12+a*Math.sin((t-t0)/2600)).toFixed(2)+'deg 82deg auto';requestAnimationFrame(f)})(t0)})()</script>` : '';
  return `<section class="hero"><div class="redpanel">${mv || img}</div><div class="wrap">
<div class="tag">${STAR}<p>${esc(cfg.subtitle)}</p></div>
<h1 class="mega" data-speed="0.1">${fancy(cfg.heroLine1 || 'MY')}<br>${fancy(cfg.heroLine2 || 'PORTFOLIO')}<br><span class="r">${fancy(cfg.heroLine3 || '.2026')}</span></h1>
</div></section>`;
}

// link chữ cuộn lên khi rê chuột (như trang mẫu)
const roll = (href, text, ext) => { const ch = [...String(text)].map((c, i) => `<i style="--i:${i}">${c === ' ' ? '&nbsp;' : esc(c)}</i>`).join('');
  return `<a class="sl" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''} aria-label="${esc(text)}"><b aria-hidden="true">${ch}</b><b aria-hidden="true">${ch}</b></a>`; };

// carousel dự án: items = [{slug, href, title, cover, tags, fit, bg}] của tab Visual Identity;
// tab Social Media và UX/UI được carousel.js dựng từ thư viện ấn phẩm.
export function carousel(items) {
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  const tab = (k, l, on) => `<button class="gc-tab${on ? ' on' : ''}" type="button" role="tab" aria-selected="${on}" data-cat="${k}">${esc(l)}<sup>${on ? items.length : ''}</sup></button>`;
  return `<section class="gcar" id="work" tabindex="0" aria-label="Dự án"><div class="wrap">${secHead('work', 'Dự án')}<div class="gc-head"><div class="gc-tabs" role="tablist">${tab('visual', 'Visual Identity', true)}${tab('social', 'Social Media')}${tab('uxui', 'UX/UI')}</div><span class="gc-hint">Kéo · cuộn ngang · ‹ ›</span></div></div>
<div class="gc-title" aria-live="polite"><h3 id="gcName"></h3><p id="gcTags"></p></div>
<div class="gc-stage"><div class="gc-track"></div><div class="gc-empty" hidden>Dự án mục này đang được cập nhật</div></div>
<div class="gc-foot"><button class="gc-nav" type="button" data-d="-1" aria-label="Trước">‹</button><span id="gcNo">01/${String(items.length).padStart(2, '0')}</span><button class="gc-nav" type="button" data-d="1" aria-label="Sau">›</button></div>
<script type="application/json" id="gcData">${data}</script></section>`;
}


// nút nổi: lên đầu trang + liên hệ (Zalo / điện thoại lấy từ contact trong site.config.json)
function fab(cfg) {
  const c = cfg.contact || {};
  const num = String(c.phone || '').replace(/[^\d+]/g, '');
  const zl = String(c.zalo || c.phone || '').replace(/[^\d]/g, '');
  const m = [];
  if (zl) m.push(`<a class="fab-z" href="https://zalo.me/${zl}" target="_blank" rel="noopener">Zalo<i>Zalo</i></a>`);
  if (num) m.push(`<a class="fab-p" href="tel:${num}">Gọi<i><svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.250.2 2.450.6 3.600a1 1 0 0 1-.25 1z"/></svg></i></a>`);
  return `<div class="fab" id="fab"${m.length ? '' : ' data-solo="1"'}><div class="fab-m">${m.join('')}</div>
<button class="fab-b fab-c" id="fabc" type="button" aria-label="Liên hệ" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6 2 11c0 2.600 1.200 4.900 3.100 6.600L4 22l4.700-2.100c1 .3 2.100.4 3.300.4 5.500 0 10-4 10-9S17.500 2 12 2z"/></svg></button>
<button class="fab-b fab-up" id="fabup" type="button" aria-label="Lên đầu trang"><svg viewBox="0 0 24 24"><path d="M12 3 3 13h5v8h8v-8h5z"/></svg></button></div>`;
}

function footer(cfg) {
  const c = cfg.contact || {};
  const left = [], right = [];
  if (c.phone) left.push(`<div><small>Điện thoại</small>${roll('tel:' + String(c.phone).replace(/\s/g, ''), c.phone)}</div>`);
  if (c.email) left.push(`<div><small>Email</small>${roll('mailto:' + c.email, c.email)}</div>`);
  for (const [k, lab] of [['behance', 'Behance']])   // chân trang chỉ hiện email, điện thoại, Behance
    if (c[k]) right.push(`<div><small>${lab}</small>${roll(c[k], c[k].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), true)}</div>`);
  if (!left.length) left.push(`<div><small>Xem</small>${roll('index.html', 'Thương hiệu')}</div><div><small>Xem</small>${roll('gallery.html', 'Sản phẩm')}</div>`);
  if (!right.length) right.push(`<div><small>Cập nhật</small>${esc(new Date().toLocaleDateString('vi-VN'))}</div>`);
  const mq = `<span class="mq">${fancy(cfg.marqueeA || 'J Minh')}<span class="r">${fancy(cfg.marqueeB || '.Portfolio')}</span></span>`;
  return `<footer class="ft" id="contact"><div class="ftbox">
<div class="ftrow"><h6><span class="sec-ic" style="display:inline-grid;width:38px;height:38px;vertical-align:-11px;margin-right:12px">${ICONS.contact}</span>${fancy('Liên hệ')}</h6><h6>${fancy('Portfolio ' + new Date().getFullYear())}</h6></div>
<div class="ftmid"><div class="ftstar">${STAR.replace('class="star"', '')}</div><div class="ftcol">${left.join('')}</div><div class="ftcol r">${right.join('')}</div></div>
<div class="marq" aria-hidden="true"><div class="mq-track">${mq.repeat(4)}</div></div>
</div></footer>`;
}

// tiêu đề trang con
export const pageHead = (title, sub = '') => `<div class="wrap"><header class="ph"><h1>${fancy(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</header></div>`;

export function shell(cfg, title, desc, inner, active = 'brands', extra = {}) {
  const site = JSON.stringify({ repo: cfg.repo, branch: cfg.branch || 'main', out: cfg.out || 'docs', title: cfg.title, firebase: cfg.firebase || {}, v: V, car: cfg.carousel || {} });
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0b0b0b">${FONTS}
<script>if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('fx');setTimeout(function(){if(!window.__fx)document.documentElement.classList.add('fx-off')},4000)}</script>
<style>${CSS}</style></head><body${extra.pid ? ` data-pid="${esc(extra.pid)}"` : ''}${extra.page ? ` data-page="${esc(extra.page)}"` : ''}>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="lgi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".98"/><stop offset=".55" stop-color="#ffe3df" stop-opacity=".82"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient></defs></svg>
<nav class="nav" id="nav" aria-label="Điều hướng"><a class="nav-logo" href="index.html">${fancy(cfg.title)}</a>
<div class="nav-links"><a href="index.html#work" data-s="work">${ICONS.work}Dự án</a><a href="index.html#brands" data-s="brands"${active === 'brands' ? ' class="on"' : ''}>${ICONS.brands}Thương hiệu</a><a href="index.html#products" data-s="products"${active === 'gallery' ? ' class="on"' : ''}>${ICONS.products}Sản phẩm</a><a href="#contact" data-s="contact">${ICONS.contact}Liên hệ</a></div>
<span class="nav-yr">${fancy('Portfolio ' + new Date().getFullYear())}</span><button class="nav-menu" id="menubtn" type="button" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button></nav>
<div class="menu" id="menu"><a href="index.html#brands" style="--i:0">Thương hiệu</a><a href="index.html#products" style="--i:1">Sản phẩm</a><a href="signup.html" style="--i:2">Tài khoản</a><a href="admin.html" id="menu-admin" style="--i:3">Quản trị</a><a href="trash.html" id="menu-trash" style="display:none;--i:4">Thùng rác</a><small style="--i:5">${esc(cfg.subtitle)}</small></div>
${inner}
${footer(cfg)}
<div class="adminbar" id="adminbar">Chế độ quản trị · <a href="admin.html" style="text-decoration:underline">Tài khoản</a></div>
<div class="toast" id="toast"></div>
${fab(cfg)}
<script>window.SITE=${site};</script><script src="site.js?v=${V}" defer></script><script src="fx.js?v=${V}" defer></script><script src="carousel.js?v=${V}" defer></script>
</body></html>`;
}

// chép site.js vào thư mục web
export function writeSiteAssets(outDir) {
  fs.copyFileSync(path.join(HERE, 'site.js'), path.join(outDir, 'site.js'));
  fs.copyFileSync(path.join(HERE, 'render.js'), path.join(outDir, 'render.js'));
  fs.copyFileSync(path.join(HERE, 'fx.js'), path.join(outDir, 'fx.js'));
  fs.copyFileSync(path.join(HERE, 'auth.js'), path.join(outDir, 'auth.js'));
  fs.copyFileSync(path.join(HERE, 'carousel.js'), path.join(outDir, 'carousel.js'));
  fs.mkdirSync(path.join(outDir, 'fonts'), { recursive: true });   // Host Grotesk VN + giấy phép OFL
  for (const f of fs.readdirSync(path.join(HERE, 'fonts'))) if (/\.(woff2|txt|md)$/.test(f)) fs.copyFileSync(path.join(HERE, 'fonts', f), path.join(outDir, 'fonts', f));
  const md = path.join(HERE, 'models');  // model 3D (.glb), poster (.webp), ánh sáng studio (.jpg)
  if (fs.existsSync(md)) { fs.mkdirSync(path.join(outDir, 'models'), { recursive: true });
    for (const f of fs.readdirSync(md)) if (/\.(glb|webp|jpg|md)$/.test(f)) fs.copyFileSync(path.join(md, f), path.join(outDir, 'models', f)); }
  const hp = path.join(outDir, 'hero.svg');  // ảnh tạm; muốn đổi ảnh thật, xem heroImage trong site.config.json
  if (!fs.existsSync(hp)) fs.copyFileSync(path.join(HERE, 'hero-placeholder.svg'), hp);
  const f = path.join(outDir, 'deleted.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ projects: [], months: [], images: [], trash: [] }, null, 2));
  const e = path.join(outDir, 'edits.json');
  if (!fs.existsSync(e)) fs.writeFileSync(e, JSON.stringify(emptyEdits(), null, 2) + '\n');
}

export function readEdits(outDir) {
  try { return normEdits(JSON.parse(fs.readFileSync(path.join(outDir, 'edits.json'), 'utf8'))); } catch { return emptyEdits(); }
}

export function readDeleted(outDir) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(outDir, 'deleted.json'), 'utf8'));
    return { projects: d.projects || [], months: d.months || [], images: d.images || [] };
  } catch { return { projects: [], months: [], images: [] }; }
}
