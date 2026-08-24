// WCAG contrast audit of the semantic pairs, computed from OKLCH.
// Run after ANY colour change: node design-system/contrast.mjs
// Brand is Ember (H45, "Paper" direction); red is reserved for danger alone.
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
 ['fg-primary / page',      c(17.5,0.016,38), c(97.3,0.006,75), 4.5],
 ['fg-secondary / page',    c(42.5,0.017,45), c(97.3,0.006,75), 4.5],
 ['fg-muted / page',        c(51.5,0.016,50), c(97.3,0.006,75), 4.5],
 ['success-fg / success-bg',c(48.0,0.100,145), c(96.5,0.024,148), 4.5],
 ['warning-fg / warning-bg',c(39.0,0.094,72),  c(97.0,0.032,95), 4.5],
 ['danger-fg / danger-bg',  c(48.0,0.175,25),  c(96.5,0.020,22), 4.5],
 ['info-fg / info-bg',      c(47.0,0.090,246), c(96.5,0.014,250), 4.5],
 ['white on brand ember-50', c(99.1,0.004,80), c(57.5,0.165,44), 4.5],
 ['brand ember-50 / surface (btn border)',c(57.5,0.165,44), c(99.1,0.004,80), 3.0],
 ['ember-60 link / page',   c(49.5,0.155,42), c(97.3,0.006,75), 4.5],
 ['hero figure / surface',  c(32.5,0.105,38), c(99.1,0.004,80), 4.5],
 ['fg-primary / accent wash',c(17.5,0.016,38),c(96.8,0.022,55), 4.5],
 ['fg-muted / accent wash', c(51.5,0.016,50), c(96.8,0.022,55), 4.5],
 ['danger-fg / inset alert',c(48.0,0.175,25),  c(94.3,0.008,70), 4.5],
 ['warning-fg / inset alert',c(39.0,0.094,72), c(94.3,0.008,70), 4.5],
 ['domain-finance / page',  c(45.0,0.086,210), c(97.3,0.006,75), 4.5],
 ['domain-inventory / page',c(48.0,0.078,165), c(97.3,0.006,75), 4.5],
 ['domain-clients / page',  c(50.0,0.110,335), c(97.3,0.006,75), 4.5],
 ['domain-vendors / page',  c(50.0,0.082,95),  c(97.3,0.006,75), 4.5],
 ['domain-admin / page',    c(45.0,0.012,60),  c(97.3,0.006,75), 4.5],
 ['domain-projects / page', c(53.0,0.170,26),  c(97.3,0.006,75), 4.5],
 ['domain-attendance/page', c(47.0,0.100,152), c(97.3,0.006,75), 4.5],
 ['nav muted / inverse bg', c(73.5,0.014,60),  c(13.0,0.014,36), 4.5],
];
const dark=[
 ['fg-primary / page',      c(97.3,0.006,75), c(9.0,0.012,34), 4.5],
 ['fg-secondary / page',    c(73.5,0.014,60), c(9.0,0.012,34), 4.5],
 ['fg-muted / page',        c(61.5,0.015,55), c(9.0,0.012,34), 4.5],
 ['success-fg / success-bg',c(75.0,0.088,148), c(24.0,0.048,147), 4.5],
 ['warning-fg / warning-bg',c(81.0,0.118,85),  c(26.0,0.060,80), 4.5],
 ['danger-fg / danger-bg',  c(74.0,0.128,25),  c(25.0,0.082,25), 4.5],
 ['info-fg / info-bg',      c(75.0,0.076,248), c(24.0,0.044,248), 4.5],
 ['brand ember-40 / page',  c(66.5,0.155,46),  c(9.0,0.012,34), 4.5],
 ['brand ember-40 / surface',c(66.5,0.155,46), c(13.0,0.014,36), 4.5],
 ['ink on brand ember-40',  c(9.0,0.012,34),   c(66.5,0.155,46), 4.5],
 ['hero figure / page',     c(76.0,0.128,48),  c(9.0,0.012,34), 4.5],
 ['domain-finance / page',  c(68.0,0.086,210), c(9.0,0.012,34), 4.5],
 ['domain-inventory / page',c(70.0,0.082,165), c(9.0,0.012,34), 4.5],
 ['domain-projects / page', c(70.0,0.150,30),  c(9.0,0.012,34), 4.5],
 ['domain-clients / page',  c(70.0,0.098,335), c(9.0,0.012,34), 4.5],
 ['domain-vendors / page',  c(69.0,0.086,95),  c(9.0,0.012,34), 4.5],
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
