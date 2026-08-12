import { Link } from 'react-router-dom';
import { Heart, Compass } from 'lucide-react';
import { useTravel } from '../context/TravelContext';
import destinations from '../data/destinations';
import DestinationCard from '../components/destinations/DestinationCard';
import SplitText from '../components/reactbits/SplitText';

export default function Favorites() {
  const { favorites } = useTravel();
  const favDests = destinations.filter((d) => favorites.includes(d.id));

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SplitText text="Your Favorites" as="h1" delay={40} />
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
        Destinations you've saved for your next adventure
      </p>

      {favDests.length > 0 ? (
        <div className="dest-grid">
          {favDests.map((d) => (
            <DestinationCard key={d.id} destination={d} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Heart size={40} />
          </div>
          <h3>No favorites yet</h3>
          <p>Start exploring destinations and save the ones that inspire you</p>
          <Link to="/destinations" className="btn btn-primary btn-lg">
            <Compass size={18} /> Explore Destinations
          </Link>
        </div>
      )}
    </div>
  );
}
