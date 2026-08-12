export default function OrientationCube({ pitch = 0, roll = 0, yaw = 0 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
      <div className="cube-scene">
        <div
          className="cube"
          style={{
            transform: `rotateX(${-pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg)`,
          }}
        >
          <div className="cube-face cube-front">FRONT</div>
          <div className="cube-face cube-back">BACK</div>
          <div className="cube-face cube-right">RIGHT</div>
          <div className="cube-face cube-left">LEFT</div>
          <div className="cube-face cube-top">TOP</div>
          <div className="cube-face cube-bottom">BTM</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
        {[
          { label: 'Pitch', value: pitch },
          { label: 'Roll', value: roll },
          { label: 'Yaw', value: yaw },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: Math.abs(value) > 20 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
              {value.toFixed(1)}°
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
