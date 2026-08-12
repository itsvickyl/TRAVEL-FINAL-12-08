import { useMemo } from 'react';
import AnimatedCounter from '../reactbits/AnimatedCounter';

export default function Speedometer({ speed = 0, maxSpeed = 320 }) {
  const { ticks, needleAngle } = useMemo(() => {
    const startA = -225;
    const endA = 45;
    const totalA = endA - startA;
    const numTicks = 9;
    const ticksArr = [];

    for (let i = 0; i <= numTicks; i++) {
      const angle = startA + (totalA / numTicks) * i;
      const rad = (angle * Math.PI) / 180;
      const r1 = 110;
      const r2 = 96;
      const rLabel = 82;
      ticksArr.push({
        x1: 140 + r1 * Math.cos(rad),
        y1: 140 + r1 * Math.sin(rad),
        x2: 140 + r2 * Math.cos(rad),
        y2: 140 + r2 * Math.sin(rad),
        lx: 140 + rLabel * Math.cos(rad),
        ly: 140 + rLabel * Math.sin(rad),
        label: Math.round((maxSpeed / numTicks) * i),
      });
    }

    const pct = Math.min(1, Math.max(0, speed / maxSpeed));
    const nAngle = startA + totalA * pct;

    return { ticks: ticksArr, needleAngle: nAngle };
  }, [speed, maxSpeed]);

  const startA = -225;
  const endA = 45;
  const totalA = endA - startA;
  const pct = Math.min(1, speed / maxSpeed);

  // Create arc path for background
  const createArc = (start, end, r) => {
    const sr = (start * Math.PI) / 180;
    const er = (end * Math.PI) / 180;
    const sx = 140 + r * Math.cos(sr);
    const sy = 140 + r * Math.sin(sr);
    const ex = 140 + r * Math.cos(er);
    const ey = 140 + r * Math.sin(er);
    const large = end - start > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  };

  const bgArc = createArc(startA, endA, 110);
  const valArc = pct > 0.01 ? createArc(startA, startA + totalA * pct, 110) : '';

  const arcColor = pct > 0.85 ? 'var(--danger)' : pct > 0.65 ? 'var(--accent-orange)' : 'var(--primary)';

  return (
    <div className="speedometer-container widget">
      <div className="widget-header" style={{ width: '100%' }}>
        <span className="widget-title">Speed</span>
        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>LIVE</span>
      </div>

      <svg width="280" height="170" viewBox="0 0 280 170" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="60%" stopColor="var(--accent-orange)" />
            <stop offset="100%" stopColor="var(--danger)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />

        {/* Value arc */}
        {valArc && (
          <path
            d={valArc}
            fill="none"
            stroke="url(#speedGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ transition: 'all 0.5s ease-out' }}
          />
        )}

        {/* Ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <text
              x={t.lx}
              y={t.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--text-dim)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fontWeight="600"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Needle */}
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '140px 140px', transition: 'transform 0.5s ease-out' }}>
          <line x1="140" y1="140" x2="230" y2="140" stroke={arcColor} strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)" />
        </g>

        {/* Center dot */}
        <circle cx="140" cy="140" r="6" fill="var(--bg-dark)" stroke={arcColor} strokeWidth="2" />
        <circle cx="140" cy="140" r="3" fill={arcColor} />
      </svg>

      <div className="speed-value" style={{ color: arcColor }}>
        <AnimatedCounter value={speed} decimals={0} duration={500} />
      </div>
      <div className="speed-unit">km/h</div>
    </div>
  );
}
