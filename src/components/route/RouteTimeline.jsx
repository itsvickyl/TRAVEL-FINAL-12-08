import { useEffect, useRef } from 'react';
import { MapPin, Clock, Navigation, CheckCircle } from 'lucide-react';
import gsap from 'gsap';

export default function RouteTimeline({ waypoints }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      const items = ref.current.querySelectorAll('.timeline-item');
      gsap.fromTo(items, {
        opacity: 0,
        x: -20,
      }, {
        opacity: 1,
        x: 0,
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
        delay: 0.2,
      });
    }
  }, [waypoints]);

  if (!waypoints || waypoints.length === 0) return null;

  return (
    <div className="timeline" ref={ref}>
      {waypoints.map((wp, i) => (
        <div key={i} className="timeline-item">
          <div className="timeline-dot">
            {i === 0 ? <MapPin size={12} /> :
             i === waypoints.length - 1 ? <CheckCircle size={12} /> :
             <Navigation size={12} />}
          </div>
          <div className="timeline-card">
            <div className="timeline-name">{wp.name}</div>
            <div className="timeline-meta">
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {wp.eta}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Navigation size={12} /> {wp.distance}
              </span>
              {wp.note && (
                <span style={{ color: 'var(--primary)' }}>{wp.note}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
