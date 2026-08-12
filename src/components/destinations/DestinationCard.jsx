import { useNavigate } from 'react-router-dom';
import { Heart, Star, MapPin } from 'lucide-react';
import { useTravel } from '../../context/TravelContext';
import SpotlightCard from '../reactbits/SpotlightCard';

export default function DestinationCard({ destination }) {
  const navigate = useNavigate();
  const { toggleFavorite, isFavorite } = useTravel();
  const fav = isFavorite(destination.id);

  return (
    <SpotlightCard
      className="dest-card"
      onClick={() => navigate(`/destination/${destination.id}`)}
    >
      <div className="dest-card-image">
        <img
          src={destination.image}
          alt={destination.name}
          loading="lazy"
        />
        <div className="dest-card-image-overlay" />
        <button
          className={`dest-card-fav${fav ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(destination.id);
          }}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="dest-card-body">
        <div className="dest-card-location">
          <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {destination.country}
        </div>
        <h3 className="dest-card-name">{destination.name}</h3>
        <p className="dest-card-desc">{destination.description}</p>

        <div className="dest-card-footer">
          <div className="dest-card-rating">
            <Star size={14} className="star" fill="currentColor" />
            <span>{destination.rating}</span>
          </div>
          <div className="dest-card-price">
            ${destination.price.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {destination.tags.map((tag) => (
            <span key={tag} className="badge badge-primary">{tag}</span>
          ))}
        </div>
      </div>
    </SpotlightCard>
  );
}
