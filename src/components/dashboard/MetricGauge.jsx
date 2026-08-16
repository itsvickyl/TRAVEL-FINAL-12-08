import { useMemo } from 'react';

/**
 * Premium 270° Aerospace Instrument Gauge
 * ========================================
 * High-visibility graduation numbers with smart anti-collision positioning.
 * Arc sweeps from 225° (bottom-left) over the top to 495° (bottom-right).
 */
export default function MetricGauge({
  value = 0,
  min = 0,
  max = 100,
  label = '',
  unit = '',
  size = 200,
  thresholds, // Array of threshold values
}) {
  const isValueValid = typeof value === 'number' && Number.isFinite(value);
  const numericVal = isValueValid ? value : min;

  const { bgArcs, needleAngle, ticks, segs, activeColor } = useMemo(() => {
    const cx = size / 2;
    const cy = size * 0.48; // Centered to balance 270° sweep
    const r = size * 0.32;  // Radius of arc
    const startAngle = 225; // Bottom-left
    const endAngle = 495;   // Bottom-right
    const totalAngle = endAngle - startAngle; // 270° sweep

    const polarToCartesian = (angle, radius) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad),
      };
    };

    const arcPath = (a1, a2, radius) => {
      const s = polarToCartesian(a1, radius);
      const e = polarToCartesian(a2, radius);
      const large = (a2 - a1) > 180 ? 1 : 0;
      return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
    };

    // Threshold segments (ensure max is always the last bound)
    const rawSegments = thresholds || [
      min + (max - min) * 0.25,
      min + (max - min) * 0.5,
      min + (max - min) * 0.75,
      max,
    ];

    // Ensure segments are strictly sorted and unique
    const uniqueSegments = Array.from(new Set(rawSegments)).sort((a, b) => a - b);
    if (uniqueSegments[uniqueSegments.length - 1] !== max) {
      uniqueSegments.push(max);
    }
    const segments = uniqueSegments;

    // Rich color palette adaptive to any number of segments
    const palettePool = ['#34d399', '#38bdf8', '#f59e0b', '#f97316', '#ef4444', '#dc2626'];
    const colors = segments.map((_, idx) => {
      if (segments.length <= 4) {
        const standard4 = ['#34d399', '#f59e0b', '#f97316', '#ef4444'];
        return standard4[idx] || '#ef4444';
      }
      return palettePool[Math.min(idx, palettePool.length - 1)];
    });

    const bgArcsArr = [];
    let prevBound = min;

    for (let i = 0; i < segments.length; i++) {
      const segStart = Math.max(0, Math.min(1, (prevBound - min) / (max - min)));
      const segEnd = Math.max(0, Math.min(1, (segments[i] - min) / (max - min)));
      const a1 = startAngle + totalAngle * segStart;
      const a2 = startAngle + totalAngle * segEnd;

      const gap = 2.5;
      const p1 = i === 0 ? a1 : a1 + gap;
      const p2 = i === segments.length - 1 ? a2 : a2 - gap;

      if (p2 > p1) {
        bgArcsArr.push({
          path: arcPath(p1, p2, r),
          color: colors[i],
        });
      }
      prevBound = segments[i];
    }

    // Determine active color based on current value
    let actColor = colors[0];
    if (!isValueValid) {
      actColor = 'var(--text-dim)';
    } else {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (i === 0 || numericVal >= segments[i - 1]) {
          actColor = colors[i];
          break;
        }
      }
    }

    // Needle rotation angle (degrees from positive X-axis)
    const pct = Math.max(0, Math.min(1, (numericVal - min) / (max - min)));
    const curAngle = startAngle + totalAngle * pct;
    const nAngle = curAngle - 90;

    // Distinct visible numbers positioned OUTSIDE the meter arc
    const rawTickValues = [
      { val: min, color: 'var(--text-secondary)' },
      ...segments.map((val, idx) => ({ val, color: colors[idx] || 'var(--text-secondary)' })),
    ];

    // Remove duplicates
    const seenVals = new Set();
    const tickValues = [];
    for (const t of rawTickValues) {
      if (!seenVals.has(t.val)) {
        seenVals.add(t.val);
        tickValues.push(t);
      }
    }

    // Compute tick positions with Smart Anti-Collision separation
    const ticksArr = tickValues.map((t, idx) => {
      const vPct = Math.max(0, Math.min(1, (t.val - min) / (max - min)));
      const angle = startAngle + totalAngle * vPct;
      const rad = ((angle - 90) * Math.PI) / 180;

      // Check proximity to previous or next tick to prevent overlap (e.g. -20 and 0)
      const prevTick = idx > 0 ? tickValues[idx - 1] : null;
      const nextTick = idx < tickValues.length - 1 ? tickValues[idx + 1] : null;

      const prevAngleDiff = prevTick ? (vPct - (prevTick.val - min) / (max - min)) * totalAngle : 999;
      const nextAngleDiff = nextTick ? ((nextTick.val - min) / (max - min) - vPct) * totalAngle : 999;

      let radiusOffset = 17;
      let offsetX = 0;
      let offsetY = 0;

      // Anti-collision offset for closely packed numbers (like -20 and 0)
      if (nextAngleDiff < 18) {
        // First of the colliding pair: push down/left
        radiusOffset = 22;
        offsetX = -6;
        offsetY = 7;
      } else if (prevAngleDiff < 18) {
        // Second of the colliding pair: push up/right
        radiusOffset = 18;
        offsetX = 6;
        offsetY = -5;
      }

      return {
        x1: cx + (r + 2) * Math.cos(rad),
        y1: cy + (r + 2) * Math.sin(rad),
        x2: cx + (r + 7) * Math.cos(rad),
        y2: cy + (r + 7) * Math.sin(rad),
        lx: cx + (r + radiusOffset) * Math.cos(rad) + offsetX,
        ly: cy + (r + radiusOffset) * Math.sin(rad) + offsetY,
        label: Math.round(t.val),
        color: t.color,
      };
    });

    return {
      bgArcs: bgArcsArr,
      needleAngle: nAngle,
      ticks: ticksArr,
      segs: segments,
      activeColor: actColor,
    };
  }, [numericVal, isValueValid, min, max, size, thresholds]);

  const cx = size / 2;
  const cy = size * 0.48;
  const needleLength = size * 0.32 - 10;
  const svgHeight = size * 0.84;

  return (
    <div className="gauge-container" style={{ width: '100%', maxWidth: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* SVG 270° Arch Gauge with Non-Overlapping Perimeter Graduation Numbers */}
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${size} ${svgHeight}`}
        style={{ maxWidth: size, display: 'block', overflow: 'visible' }}
      >
        {/* Background colored threshold arcs */}
        {bgArcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth="9"
            strokeLinecap="round"
            opacity={isValueValid ? 0.95 : 0.3}
            style={{ filter: isValueValid ? `drop-shadow(0 0 6px ${arc.color}40)` : 'none' }}
          />
        ))}

        {/* Visible tick marks & perimeter numerical values */}
        {ticks.map((t, i) => (
          <g key={i}>
            {/* Radial tick line */}
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Highly visible metric number outside the arc */}
            <text
              x={t.lx}
              y={t.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill={t.color}
              fontSize="10"
              fontFamily="var(--font-mono)"
              fontWeight="800"
              style={{
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                letterSpacing: '-0.02em',
              }}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Needle pointer */}
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <line
            x1={cx}
            y1={cy}
            x2={cx + needleLength}
            y2={cy}
            stroke={activeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ filter: isValueValid ? `drop-shadow(0 0 6px ${activeColor})` : 'none' }}
          />
        </g>

        {/* Center hub */}
        <circle cx={cx} cy={cy} r="6" fill="var(--bg-dark)" stroke={activeColor} strokeWidth="2" />
        <circle cx={cx} cy={cy} r="2.5" fill={activeColor} />

        {/* Large central numerical readout & unit */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fill={activeColor}
          fontFamily="var(--font-mono)"
          fontSize={size > 160 ? '1.55rem' : '1.25rem'}
          fontWeight="800"
        >
          {isValueValid ? value.toFixed(1) : '—'}
        </text>
        <text
          x={cx}
          y={cy + 37}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="0.68rem"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {unit}
        </text>
      </svg>

      {label && (
        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
      )}
    </div>
  );
}
