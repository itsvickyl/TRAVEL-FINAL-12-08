import { useMemo } from 'react';

/**
 * Premium 270° instrument gauge with colored threshold arcs.
 * Arc sweeps from 225° (bottom-left) over the top to 495° / 135° (bottom-right).
 * Range indicators are placed cleanly above the meter.
 */
export default function MetricGauge({
  value = 0,
  min = 0,
  max = 100,
  label = '',
  unit = '',
  size = 200,
  showLegend = true,
  thresholds, // [green, yellow, orange, red] boundaries, e.g. [20, 35, 42, 50]
}) {
  const isValueValid = typeof value === 'number' && Number.isFinite(value);
  const numericVal = isValueValid ? value : min;

  const { bgArcs, needleAngle, ticks, segs, activeColor } = useMemo(() => {
    const cx = size / 2;
    const cy = size * 0.48; // Centered slightly above midpoint so arch is balanced
    const r = size * 0.35;  // Radius of arc
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

    // Threshold segments
    const segments = thresholds || [
      min + (max - min) * 0.25,
      min + (max - min) * 0.5,
      min + (max - min) * 0.75,
      max,
    ];
    const colors = ['#34d399', '#f59e0b', '#f97316', '#ef4444'];
    const bgArcsArr = [];
    let prevBound = min;

    for (let i = 0; i < segments.length; i++) {
      const segStart = Math.max(0, Math.min(1, (prevBound - min) / (max - min)));
      const segEnd = Math.max(0, Math.min(1, (segments[i] - min) / (max - min)));
      const a1 = startAngle + totalAngle * segStart;
      const a2 = startAngle + totalAngle * segEnd;

      const gap = 3;
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

    // Active color based on current value
    const actColor = !isValueValid
      ? 'var(--text-dim)'
      : numericVal >= segments[2]
      ? '#ef4444'
      : numericVal >= segments[1]
      ? '#f97316'
      : numericVal >= segments[0]
      ? '#f59e0b'
      : '#34d399';

    // Needle rotation angle (degrees from positive X-axis)
    const pct = Math.max(0, Math.min(1, (numericVal - min) / (max - min)));
    const curAngle = startAngle + totalAngle * pct;
    const nAngle = curAngle - 90;

    // Tick marks and numerical labels along arc
    const tickValues = [min, ...segments];
    const ticksArr = tickValues.map((val) => {
      const vPct = Math.max(0, Math.min(1, (val - min) / (max - min)));
      const angle = startAngle + totalAngle * vPct;
      const rad = ((angle - 90) * Math.PI) / 180;
      return {
        x1: cx + (r + 4) * Math.cos(rad),
        y1: cy + (r + 4) * Math.sin(rad),
        x2: cx + (r - 6) * Math.cos(rad),
        y2: cy + (r - 6) * Math.sin(rad),
        lx: cx + (r - 18) * Math.cos(rad),
        ly: cy + (r - 18) * Math.sin(rad),
        label: Math.round(val),
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
  const needleLength = size * 0.35 - 12;
  const svgHeight = size * 0.78;

  return (
    <div className="gauge-container" style={{ width: '100%', maxWidth: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Metric Ranges bar — above the meter */}
      {showLegend && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '3px 12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: 'var(--radius-full)',
          marginBottom: 4,
        }}>
          {['#34d399', '#f59e0b', '#f97316', '#ef4444'].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}80}` }} />
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {(segs[i] || 0).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SVG 270° Arch Gauge */}
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
            opacity={isValueValid ? 0.9 : 0.3}
            style={{ filter: isValueValid ? `drop-shadow(0 0 6px ${arc.color}35)` : 'none' }}
          />
        ))}

        {/* Tick marks & numerical labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <text
              x={t.lx}
              y={t.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fontWeight="700"
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
            style={{ filter: isValueValid ? `drop-shadow(0 0 5px ${activeColor})` : 'none' }}
          />
        </g>

        {/* Center hub */}
        <circle cx={cx} cy={cy} r="5.5" fill="var(--bg-dark)" stroke={activeColor} strokeWidth="2" />
        <circle cx={cx} cy={cy} r="2.5" fill={activeColor} />

        {/* Large numerical readout & unit below needle hub */}
        <text
          x={cx}
          y={cy + 24}
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
          y={cy + 38}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="0.65rem"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {unit}
        </text>
      </svg>

      {label && (
        <div style={{ textAlign: 'center', marginTop: -4 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
      )}
    </div>
  );
}
