// WCAG contrast audit of the semantic pairs, computed from OKLCH.
// Run after ANY colour change: node design-system/contrast.mjs
// Brand is Prussian blue (H255); red is reserved for danger alone.
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

// LIGHT theme pairs: [name, fg, bg, minimum]
const light=[
 ['fg-primary / page',      c(18,0.028,265), c(97.4,0.005,265), 4.5],
 ['fg-secondary / page',    c(43,0.021,265), c(97.4,0.005,265), 4.5],
 ['fg-muted / page',        c(52,0.019,265), c(97.4,0.005,265), 4.5],
 ['success-fg / success-bg',c(49.5,0.096,160), c(96.8,0.020,165), 4.5],
 ['warning-fg / warning-bg',c(40,0.092,72),  c(97.2,0.028,92), 4.5],
 ['danger-fg / danger-bg',  c(49,0.170,26),  c(96.8,0.018,24), 4.5],
 ['info-fg / info-bg',      c(48.5,0.090,228),c(96.8,0.016,232), 4.5],
 ['white on brand blue-50',  c(99.2,0.003,265),c(52,0.150,255), 4.5],
 ['brand blue-50 / page',   c(52,0.150,255), c(97.4,0.005,265), 4.5],
 ['brand blue-50 / surface',c(52,0.150,255), c(99.2,0.003,265), 4.5],
 ['blue-60 link / page',    c(44,0.140,255), c(97.4,0.005,265), 4.5],
 ['hero figure / surface',  c(30,0.095,255), c(99.2,0.003,265), 4.5],
 ['fg-primary / accent wash',c(18,0.028,265),c(96.8,0.018,255), 4.5],
 ['fg-muted / accent wash', c(52,0.019,265), c(96.8,0.018,255), 4.5],
 ['danger-fg / inset alert',c(49,0.170,26),  c(94.6,0.007,265), 4.5],
 ['warning-fg / inset alert',c(40,0.092,72), c(94.6,0.007,265), 4.5],
 ['domain-finance / page',  c(46,0.130,262), c(97.4,0.005,265), 4.5],
 ['domain-inventory / page',c(50,0.100,200), c(97.4,0.005,265), 4.5],
 ['domain-clients / page',  c(53,0.135,310), c(97.4,0.005,265), 4.5],
 ['domain-vendors / page',  c(52,0.090,50),  c(97.4,0.005,265), 4.5],
 ['domain-admin / page',    c(46,0.012,265), c(97.4,0.005,265), 4.5],
 ['domain-projects / page', c(52.5,0.160,34),  c(97.4,0.005,265), 4.5],
 ['domain-attendance/page', c(48.5,0.110,155), c(97.4,0.005,265), 4.5],
 ['nav muted / inverse bg', c(74,0.014,265), c(13.5,0.030,265), 4.5],
];
const dark=[
 ['fg-primary / page',      c(97.4,0.005,265), c(9.5,0.032,265), 4.5],
 ['fg-secondary / page',    c(74,0.014,265),  c(9.5,0.032,265), 4.5],
 ['fg-muted / page',        c(62,0.017,265),  c(9.5,0.032,265), 4.5],
 ['success-fg / success-bg',c(76,0.090,163),  c(24,0.048,162), 4.5],
 ['warning-fg / warning-bg',c(82,0.115,85),   c(26,0.060,80), 4.5],
 ['danger-fg / danger-bg',  c(75,0.125,26),   c(25,0.080,26), 4.5],
 ['info-fg / info-bg',      c(76,0.078,230),  c(24,0.045,230), 4.5],
 ['brand blue-40 / page',   c(62,0.150,255),  c(9.5,0.032,265), 4.5],
 ['brand blue-40 / surface',c(62,0.150,255),  c(13.5,0.030,265), 4.5],
 ['ink on brand blue-40',   c(9.5,0.032,265), c(62,0.150,255), 4.5],
 ['hero figure / page',     c(74,0.115,255),  c(9.5,0.032,265), 4.5],
 ['domain-finance / page',  c(70,0.115,262),  c(9.5,0.032,265), 4.5],
 ['domain-inventory / page',c(72,0.090,200),  c(9.5,0.032,265), 4.5],
 ['domain-projects / page', c(72,0.135,40),   c(9.5,0.032,265), 4.5],
 ['domain-clients / page',  c(71,0.115,310),  c(9.5,0.032,265), 4.5],
 ['domain-vendors / page',  c(70,0.090,50),   c(9.5,0.032,265), 4.5],
];
let fails=0;
for(const [label,pairs] of [['LIGHT',light],['DARK',dark]]){
  console.log(`\n--- ${label} ---`);
  for(const [n,f,b,min] of pairs){
    const r=ratio(f,b); const ok=r>=min;
    if(!ok)fails++;
    console.log(`${ok?'PASS':'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${n}`);
  }
}
console.log(`\n${fails} failing pair(s)`);
