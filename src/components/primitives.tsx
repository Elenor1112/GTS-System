import type { ReactNode } from 'react';
import { splitAmount, type Locale } from '@/lib/format';
import { CURRENCY } from '@/lib/egypt';

/* ============================================================
   AMOUNT — the financial voice.
   The integer reads first; the currency mark and fraction are
   deliberately subordinate. Always tabular, always LTR-isolated.
   ============================================================ */

type AmountSize = 'hero' | 'lg' | 'md' | 'sm';

export function Amount({
  value,
  currency = CURRENCY.mark,
  size = 'md',
  locale = 'en',
  signed = false,
  showFraction = true,
}: {
  value: number;
  currency?: string | null;
  size?: AmountSize;
  locale?: Locale;
  signed?: boolean;
  showFraction?: boolean;
}) {
  const { negative, integer, fraction, decimal } = splitAmount(value, locale);
  const sizeClass = {
    hero: 'gts-num-hero',
    lg: 'gts-num-lg',
    md: 'gts-num-md',
    sm: 'gts-num-sm',
  }[size];

  // Colour only carries meaning when a delta is being shown. A plain
  // balance is ink — colouring every figure would make none of them read.
  const toneClass = signed
    ? negative
      ? 'gts-num-negative'
      : 'gts-num-positive'
    : negative
      ? 'gts-num-negative'
      : '';

  return (
    <span className={`gts-num ${sizeClass} ${toneClass}`}>
      {signed && <span aria-hidden="true">{negative ? '−' : '+'}&thinsp;</span>}
      {!signed && negative && <span aria-hidden="true">{'−'}</span>}
      {currency && <span className="gts-num-currency">{currency}</span>}
      {integer}
      {showFraction && (
        <span className="gts-num-fraction">
          {decimal}
          {fraction}
        </span>
      )}
    </span>
  );
}

/* ============================================================
   METRIC — one cell of the metric band.

   The band's first cell is 1.6x its siblings, so the lead
   metric takes the larger figure size. Passing `lead` is what
   makes a stat band a HIERARCHY rather than four equal KPIs.
   ============================================================ */

export function Metric({
  label,
  value,
  lead = false,
  tone,
  plain = false,
}: {
  label: string;
  value: number;
  lead?: boolean;
  tone?: 'danger';
  plain?: boolean;
}) {
  return (
    <div className={tone === 'danger' ? 'gts-metric gts-metric-danger' : 'gts-metric'}>
      <p className="gts-overline">{label}</p>
      <p className="gts-metric-value">
        {plain ? (
          <span className={`gts-num ${lead ? 'gts-num-lg' : 'gts-num-md'}`}>{value}</span>
        ) : (
          <Amount value={value} size={lead ? 'lg' : 'md'} />
        )}
      </p>
    </div>
  );
}

/* ============================================================
   CONTAINERS — region is the default; card is the rarest.
   ============================================================ */

export function Region({
  title,
  action,
  children,
  as: Tag = 'section',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  as?: 'section' | 'div';
}) {
  return (
    <Tag className="gts-region">
      <header className="gts-region-head">
        <h2 className="gts-region-title">{title}</h2>
        {action}
      </header>
      {children}
    </Tag>
  );
}

export function Panel({
  title,
  action,
  children,
  bare = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  /** bare = no body padding, for tables that manage their own insets */
  bare?: boolean;
}) {
  return (
    <div className="gts-panel">
      {title && (
        <div className="gts-panel-head">
          <span className="gts-overline">{title}</span>
          {action}
        </div>
      )}
      <div className={bare ? '' : 'gts-panel-body'}>{children}</div>
    </div>
  );
}

/* ============================================================
   STATUS — shape encodes state, so it survives greyscale.
   ============================================================ */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Status({
  tone = 'neutral',
  variant,
  children,
}: {
  tone?: Tone;
  variant?: 'pending' | 'live';
  children: ReactNode;
}) {
  return (
    <span
      className={`gts-status gts-status-${tone}${variant ? ` gts-status-${variant}` : ''}`}
    >
      {children}
    </span>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`gts-badge gts-badge-${tone}`}>{children}</span>;
}

/* ============================================================
   DELTA — a change against a prior period. Arrow is decorative;
   the sign and colour carry the meaning for screen readers.
   ============================================================ */

export function Delta({ value, label }: { value: number; label?: string }) {
  const up = value >= 0;
  return (
    <span className={`gts-status ${up ? 'gts-status-success' : 'gts-status-danger'}`}>
      <span className="gts-num gts-num-sm">
        {up ? '+' : '−'}
        {Math.abs(value).toFixed(1)}%
      </span>
      {label && <span className="gts-meta">{label}</span>}
    </span>
  );
}

/* ============================================================
   CHART — the receipts trend, as a real plot.

   Deliberately not a sparkline: a baseline, two dashed
   gridlines and month labels, so a reader can take a figure
   OFF the chart rather than just sensing a direction. The
   final bar is emphasised because "where it ended" is the
   fact the opener is actually asserting.
   ============================================================ */

/** "2026-08" -> "Aug"; the year is carried by the axis ends, not
 *  repeated on every tick. */
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(key: string, withYear = false) {
  const [y, m] = key.split('-');
  const name = MONTH_ABBR[Number(m) - 1] ?? m;
  return withYear ? `${name} ${y.slice(2)}` : name;
}

export function Chart({
  data,
  height = 132,
}: {
  /** Oldest first, one entry per month. */
  data: { month: string; value: number }[];
  height?: number;
}) {
  if (data.length < 2) return null;

  const W = 480;
  const plotBottom = height - 34;
  const plotTop = 10;
  const usable = plotBottom - plotTop;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const slot = W / data.length;
  const barW = Math.max(4, slot * 0.62);

  /* A month with no receipts is a REAL zero, and it has to look like
     one: a hairline tick on the baseline rather than a bar of minimum
     height, which would imply money arrived when none did. */
  const lastIndex = data.length - 1;

  return (
    <svg
      className="gts-chart"
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={`Receipts by month, ${monthLabel(data[0].month, true)} to ${monthLabel(data[lastIndex].month, true)}.`}
    >
      <line className="gts-chart-grid" strokeDasharray="2 3"
        x1="0" y1={plotTop} x2={W} y2={plotTop} />
      <line className="gts-chart-grid" strokeDasharray="2 3"
        x1="0" y1={plotTop + usable / 2} x2={W} y2={plotTop + usable / 2} />
      <line className="gts-chart-axis" x1="0" y1={plotBottom} x2={W} y2={plotBottom} />

      {data.map((d, i) => {
        const zero = d.value <= 0;
        const h = zero ? 1.5 : Math.max(2, (d.value / max) * usable);
        const last = i === lastIndex;
        return (
          <rect
            key={d.month}
            className={
              zero ? 'gts-chart-bar-zero' : last ? 'gts-chart-bar-last' : 'gts-chart-bar'
            }
            x={i * slot + (slot - barW) / 2}
            y={plotBottom - h}
            width={barW}
            height={h}
            rx={zero ? 0 : 1}
          />
        );
      })}

      {/* Ticks at the ends and the midpoint only: twelve labels at
          10px would be noise, and the ends are what get read. */}
      {[0, Math.floor(lastIndex / 2), lastIndex].map((i) => {
        const anchor = i === 0 ? 'start' : i === lastIndex ? 'end' : 'middle';
        const x = i === 0 ? 0 : i === lastIndex ? W : i * slot + slot / 2;
        return (
          <text
            key={i}
            className={
              i === lastIndex ? 'gts-chart-label gts-chart-label-current' : 'gts-chart-label'
            }
            x={x}
            y={height - 10}
            textAnchor={anchor}
          >
            {monthLabel(data[i].month, i !== Math.floor(lastIndex / 2))}
          </text>
        );
      })}
    </svg>
  );
}

/* ============================================================
   SPARKLINE — no axes, no grid, pure shape. The endpoint is
   emphasised because "where it ended" is the readable fact.
   ============================================================ */

export function Sparkline({
  data,
  tone = 'currentColor',
  width = 120,
  height = 28,
}: {
  data: number[];
  tone?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pad = 3;
  const usable = height - pad * 2;

  const points = data.map((d, i) => [i * step, pad + usable - ((d - min) / span) * usable]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];
  const gradientId = `spark-${data.length}-${Math.round(data[0])}`;

  return (
    <svg
      className="gts-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      style={{ color: tone }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" />
    </svg>
  );
}
