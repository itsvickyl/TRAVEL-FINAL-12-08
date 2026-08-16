import { useMemo } from 'react';

/**
 * Large colored-arc instrument gauge (like the reference design).
 * Arc segments: green → yellow → orange → red
 */
export default function MetricGauge({
  value = 0,
  min = 0,
  max = 100,
  label = '',
  unit = '',
  size = 180,
  showLegend = true,
  thresholds, // [green, yellow, orange, red] boundaries, e.g. [25, 50, 75, 100]
}) {
  const { bgArcs, valueArc, needleAngle, ticks } = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - 24) / 2;
    const startAngle = 135;
    const endAngle = 405;
    const totalAngle = endAngle - startAngle;

    const polarToCartesian = (angle) => {
      const rad = ((angle - 90) * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const arcPath = (a1, a2, radius) => {
      const s = polarToCartesian(a1);
      const e = polarToCartesian(a2);
      const large = (a2 - a1) > 180 ? 1 : 0;
      return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
    };

    // Color segments
    const segments = thresholds || [max * 0.25, max * 0.5, max * 0.75, max];
    const colors = ['#34d399', '#f59e0b', '#f97316', '#ef4444'];
    const bgArcsArr = [];
    let prevBound = min;

    for (let i = 0; i < segments.length; i++) {
      const segStart = ((prevBound - min) / (max - min));
      const segEnd = ((segments[i] - min) / (max - min));
      const a1 = startAngle + totalAngle * segStart;
      const a2 = startAngle + totalAngle * Math.min(segEnd, 1);
      
      const p1 = i === 0 ? a1 : a1 + 5;
      const p2 = i === segments.length - 1 ? a2 : a2 - 5;

      if (p2 > p1) {
        bgArcsArr.push({ path: arcPath(p1, p2, r), color: colors[i] });
      }
      prevBound = segments[i];
    }

    // Value position
    const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const valAngle = startAngle + totalAngle * pct;
    const vArc = pct > 0.005 ? arcPath(startAngle, valAngle, r - 12) : '';

    // Needle angle
    const nAngle = startAngle + totalAngle * pct - 90;

    // Tick marks dynamically placed at color boundaries
    const ticksArr = [];
    const tickValues = [min, ...segments]; // min and all segment bounds
    
    tickValues.forEach((val) => {
      const pct = Math.min(1, Math.max(0, (val - min) / (max - min)));
      const angle = startAngle + totalAngle * pct;
      const rad = ((angle - 90) * Math.PI) / 180;
      const r1 = r + 4; // Extend tick slightly outside arc
      const r2 = r - 8; // Deeper inward tick
      const rLabel = r - 24; // Pull label further inside
      ticksArr.push({
        x1: cx + r1 * Math.cos(rad),
        y1: cy + r1 * Math.sin(rad),
        x2: cx + r2 * Math.cos(rad),
        y2: cy + r2 * Math.sin(rad),
        lx: cx + rLabel * Math.cos(rad),
        ly: cy + rLabel * Math.sin(rad),
        label: Math.round(val),
      });
    });

    return { bgArcs: bgArcsArr, valueArc: vArc, needleAngle: nAngle, ticks: ticksArr };
  }, [value, min, max, size, thresholds]);

  const cx = size / 2;
  const cy = size / 2;

  // Determine active color based on value
  const segs = thresholds || [max * 0.25, max * 0.5, max * 0.75, max];
  const activeColor = value >= segs[2] ? '#ef4444' : value >= segs[1] ? '#f97316' : value >= segs[0] ? '#f59e0b' : '#34d399';

  return (
    <div className="gauge-container" style={{ width: '100%', maxWidth: size, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size * 0.75}`} style={{ maxWidth: size, overflow: 'visible', display: 'block' }}>
        {/* Background colored arcs (Static segments like reference) */}
        {bgArcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.9"
            style={{ filter: `drop-shadow(0 0 8px ${arc.color}40)` }}
          />
        ))}

        {/* Boundary tick marks and labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
            <text x={t.lx} y={t.ly} textAnchor="middle" dominantBaseline="central"
              fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              {t.label}
            </text>
          </g>
        ))}

        {/* Needle */}
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 0.5s ease-out' }}>
          <line x1={cx} y1={cy} x2={cx + (size / 2 - 30)} y2={cy}
            stroke={activeColor} strokeWidth="2" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${activeColor})` }} />
        </g>

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="5" fill="var(--bg-dark)" stroke={activeColor} strokeWidth="2" />
        <circle cx={cx} cy={cy} r="2.5" fill={activeColor} />

        {/* Center value */}
        <text x={cx} y={cy + 28} textAnchor="middle" fill={activeColor}
          fontFamily="var(--font-mono)" fontSize={size > 160 ? '1.6rem' : '1.2rem'} fontWeight="800">
          {typeof value === 'number' ? value.toFixed(1) : value}
        </text>
        <text x={cx} y={cy + 44} textAnchor="middle" fill="var(--text-muted)"
          fontSize="0.6rem" fontWeight="600" letterSpacing="0.08em">
          {unit}
        </text>
      </svg>

      {label && (
        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
      )}

      {/* Color legend */}
      {showLegend && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {['#34d399', '#f59e0b', '#f97316', '#ef4444'].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.9, border: '1px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 700 }}>
                {(segs[i] || 0).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
