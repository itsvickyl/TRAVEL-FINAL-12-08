import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, Clock, DollarSign, Star, CheckCircle, Thermometer, Droplets, Wind, Cloud } from 'lucide-react';
import destinations from '../data/destinations';
import { useTravel } from '../context/TravelContext';
import SplitText from '../components/reactbits/SplitText';

export default function DestinationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useTravel();

  const dest = destinations.find((d) => d.id === parseInt(id));

  if (!dest) {
    return (
      <div className="empty-state">
        <h3>Destination not found</h3>
        <p>The destination you're looking for doesn't exist.</p>
        <Link to="/destinations" className="btn btn-primary">Browse Destinations</Link>
      </div>
    );
  }

  const fav = isFavorite(dest.id);

  return (
    <div>
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-hero">
        <img src={dest.image} alt={dest.name} />
        <div className="detail-hero-overlay" />
        <div className="detail-hero-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MapPin size={14} color="var(--primary)" />
            <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {dest.country}
            </span>
          </div>
          <SplitText text={dest.name} as="h1" delay={35} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="badge badge-green">
              <Star size={12} /> {dest.rating}
            </span>
            <span className="badge badge-primary">
              <Clock size={12} /> {dest.duration}
            </span>
            <span className="badge badge-orange">
              <DollarSign size={12} /> ${dest.price.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <section className="detail-section">
            <h3>About</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem' }}>
              {dest.longDescription}
            </p>
          </section>

          <section className="detail-section">
            <h3><CheckCircle size={20} color="var(--accent-green)" /> Highlights</h3>
            <ul className="highlight-list">
              {dest.highlights.map((h, i) => (
                <li key={i}>
                  <CheckCircle size={18} />
                  {h}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <div className="widget mb-24">
            <h4 style={{ marginBottom: 16 }}>Quick Actions</h4>
            <button
              className={`btn ${fav ? 'btn-danger' : 'btn-ghost'} btn-lg`}
              onClick={() => toggleFavorite(dest.id)}
              style={{ width: '100%', marginBottom: 12 }}
            >
              <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
              {fav ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
            <Link
              to={`/route?dest=${dest.id}`}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', textAlign: 'center', display: 'flex' }}
            >
              <MapPin size={18} /> Plan Route
            </Link>
          </div>

          <div className="widget mb-24">
            <h4 style={{ marginBottom: 16 }}>
              <Cloud size={20} color="var(--primary)" style={{ marginRight: 8 }} />
              Weather
            </h4>
            <div className="weather-widget">
              <div className="weather-item">
                <Thermometer size={20} color="var(--danger)" />
                <span className="weather-item-value">{dest.weather.temp}</span>
                <span className="weather-item-label">Temperature</span>
              </div>
              <div className="weather-item">
                <Cloud size={20} color="var(--primary)" />
                <span className="weather-item-value" style={{ fontSize: '0.9rem' }}>{dest.weather.condition}</span>
                <span className="weather-item-label">Condition</span>
              </div>
              <div className="weather-item">
                <Droplets size={20} color="var(--primary)" />
                <span className="weather-item-value">{dest.weather.humidity}</span>
                <span className="weather-item-label">Humidity</span>
              </div>
              <div className="weather-item">
                <Wind size={20} color="var(--text-muted)" />
                <span className="weather-item-value">{dest.weather.wind}</span>
                <span className="weather-item-label">Wind</span>
              </div>
            </div>
          </div>

          <div className="widget">
            <h4 style={{ marginBottom: 12 }}>Tags</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dest.tags.map((tag) => (
                <span key={tag} className="badge badge-primary">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
