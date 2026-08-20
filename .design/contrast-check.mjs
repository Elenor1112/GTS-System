// WCAG audit of the DIRECTION A (Prussian) palette, reusing the
// OKLCH->sRGB maths from design-system/contrast.mjs unchanged.
//
// Direction A: blue is the brand and the structure; red stays purely
// semantic (danger only). Ink foundation H265 is unchanged.
function oklchToSrgb(L,C,H){
  const h=H*Math.PI/180,a=C*Math.cos(h),b=C*Math.sin(h);
  const l=(L+0.3963377774*a+0.2158037573*b)**3;
  const m=(L-0.1055613458*a-0.0638541728*b)**3;
  const s=(L-0.0894841775*a-1.2914855480*b)**3;
  let r= 4.0767416621*l-3.3077115913*m+0.2309699292*s;
  let g=-1.2684380046*l+2.6097574011*m-0.3413193965*s;
  let bl=-0.0041960863*l-0.7034186147*m+1.7076147010*s;
  const f=v=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(Math.max(v,0),1/2.4)-0.055;return Math.min(1,Math.max(0,v));};
  return [f(r),f(g),f(bl)];
}
const lum=([r,g,b])=>{const c=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;return 0.2126*c(r)+0.7152*c(g)+0.0722*c(b);};
const ratio=(x,y)=>{const a=lum(x),b=lum(y);return ((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05));};
const c=(L,C,H)=>oklchToSrgb(L/100,C,H);

/* ---------- Surfaces: ink foundation, unchanged ---------- */
const pageL   = c(97.4,0.005,265);   // ink-05
const surfL   = c(99.2,0.003,265);   // ink-00
const insetL  = c(94.6,0.007,265);   // ink-10
const railBg  = c(13.5,0.030,265);   // ink-95
const pageD   = c(9.5,0.032,265);    // ink-100
const surfD   = c(13.5,0.030,265);   // ink-95
const raisedD = c(18.0,0.028,265);   // ink-90

/* ---------- Direction A: Prussian blue brand ---------- */
const blue50  = c(52.0,0.150,255);   // brand primary, light
const blue40  = c(62.0,0.150,255);   // brand bright / dark-theme brand
const blue30  = c(74.0,0.115,255);
const blue60  = c(44.0,0.140,255);
const blue80  = c(30.0,0.095,255);   // hero figure ink-blue
const blueWash= c(96.8,0.018,255);   // slab tint

/* Danger: sharpened red, kept purely semantic */
const dangerFgL = c(49.0,0.170,26);
const dangerBgL = c(96.8,0.018,24);
const dangerFgD = c(75.0,0.125,26);
const dangerBgD = c(25.0,0.080,26);

const light=[
 /* foundation */
 ['fg-primary / page',            c(18,0.028,265),  pageL, 4.5],
 ['fg-secondary / page',          c(43,0.021,265),  pageL, 4.5],
 ['fg-muted / page',              c(52,0.019,265),  pageL, 4.5],
 ['fg-muted / surface',           c(52,0.019,265),  surfL, 4.5],
 /* brand blue */
 ['brand blue-50 / page',         blue50,  pageL, 4.5],
 ['brand blue-50 / surface',      blue50,  surfL, 4.5],
 ['blue-60 link / page',          blue60,  pageL, 4.5],
 ['hero figure blue-80 / surface',blue80,  surfL, 4.5],
 ['white on blue-50 (btn/avatar)',c(99.2,0.003,265), blue50, 4.5],
 /* slab: blue wash band */
 ['fg-primary / blue wash slab',  c(18,0.028,265),  blueWash, 4.5],
 ['fg-muted / blue wash slab',    c(52,0.019,265),  blueWash, 4.5],
 ['blue-60 / blue wash slab',     blue60,  blueWash, 4.5],
 /* semantic */
 ['danger-fg / page',             dangerFgL, pageL, 4.5],
 ['danger-fg / danger-bg',        dangerFgL, dangerBgL, 4.5],
 ['danger-fg / inset alert',      dangerFgL, insetL, 4.5],
 ['success-fg / success-bg',      c(49.5,0.096,160), c(96.8,0.020,165), 4.5],
 ['warning-fg / warning-bg',      c(40,0.092,72),    c(97.2,0.028,92), 4.5],
 ['warning-fg / inset alert',     c(40,0.092,72),    insetL, 4.5],
 ['info-fg / info-bg',            c(48.5,0.090,228), c(96.8,0.016,232), 4.5],
 /* domain accents, re-tuned to live under a blue brand */
 ['domain-finance / page',        c(46,0.130,262),  pageL, 4.5],
 ['domain-inventory / page',      c(50,0.100,200),  pageL, 4.5],
 ['domain-projects / page',       c(52.5,0.160,34), pageL, 4.5],
 ['domain-clients / page',        c(53,0.135,310),  pageL, 4.5],
 ['domain-vendors / page',        c(52,0.090,50),   pageL, 4.5],
 ['domain-attendance / page',     c(48.5,0.110,155),pageL, 4.5],
 ['domain-admin / page',          c(46,0.012,265),  pageL, 4.5],
 /* rail (dark chrome on light workspace) */
 ['rail muted / rail bg',         c(74,0.014,265),  railBg, 4.5],
 ['rail overline / rail bg',      c(62,0.017,265),  railBg, 4.5],
 ['rail marker blue-40 / rail bg',blue40,  railBg, 3.0],
 ['btn-primary text / ink-90',    c(99.2,0.003,265),c(18,0.028,265), 4.5],
];

const dark=[
 ['fg-primary / page',            c(97.4,0.005,265), pageD, 4.5],
 ['fg-secondary / page',          c(74,0.014,265),   pageD, 4.5],
 ['fg-muted / page',              c(62,0.017,265),   pageD, 4.5],
 ['fg-secondary / surface',       c(74,0.014,265),   surfD, 4.5],
 ['fg-primary / raised',          c(97.4,0.005,265), raisedD, 4.5],
 /* brand blue brightens on dark */
 ['brand blue-40 / page',         blue40,  pageD, 4.5],
 ['brand blue-40 / surface',      blue40,  surfD, 4.5],
 ['blue-30 link / page',          blue30,  pageD, 4.5],
 ['ink on blue-40 (btn)',         c(9.5,0.032,265), blue40, 4.5],
 /* semantic */
 ['danger-fg / page',             dangerFgD, pageD, 4.5],
 ['danger-fg / danger-bg',        dangerFgD, dangerBgD, 4.5],
 ['success-fg / success-bg',      c(76,0.090,163),  c(24,0.048,162), 4.5],
 ['warning-fg / warning-bg',      c(82,0.115,85),   c(26,0.060,80), 4.5],
 ['info-fg / info-bg',            c(76,0.078,230),  c(24,0.045,230), 4.5],
 /* domain accents on dark */
 ['domain-finance / page',        c(70,0.115,262),  pageD, 4.5],
 ['domain-inventory / page',      c(72,0.090,200),  pageD, 4.5],
 ['domain-projects / page',       c(72,0.135,40),   pageD, 4.5],
 ['domain-clients / page',        c(71,0.115,310),  pageD, 4.5],
 ['domain-vendors / page',        c(70,0.090,50),   pageD, 4.5],
 ['domain-attendance / page',     c(72,0.100,152),  pageD, 4.5],
 ['domain-admin / page',          c(68,0.012,265),  pageD, 4.5],
];

let fails=0;
for(const [label,pairs] of [['LIGHT',light],['DARK',dark]]){
  console.log(`\n--- ${label} ---`);
  for(const [n,f,b,min] of pairs){
    const r=ratio(f,b); const ok=r>=min;
    if(!ok)fails++;
    console.log(`${ok?'PASS':'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${n}${min!==4.5?`  (min ${min})`:''}`);
  }
}
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'} — ${light.length + dark.length} pairs checked`);
process.exit(fails ? 1 : 0);
