import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import destinations, { allTags } from '../data/destinations';
import DestinationCard from '../components/destinations/DestinationCard';
import SplitText from '../components/reactbits/SplitText';
import gsap from 'gsap';

export default function DestinationList() {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy, setSortBy] = useState('rating');
  const gridRef = useRef(null);

  const filtered = destinations
    .filter((d) => {
      const matchQuery = !query || d.name.toLowerCase().includes(query.toLowerCase()) || d.country.toLowerCase().includes(query.toLowerCase());
      const matchTag = !activeTag || d.tags.includes(activeTag);
      return matchQuery && matchTag;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });

  useEffect(() => {
    if (gridRef.current) {
      const cards = gridRef.current.querySelectorAll('.dest-card');
      gsap.fromTo(cards, {
        opacity: 0,
        y: 30,
        scale: 0.97,
      }, {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.06,
        duration: 0.6,
        ease: 'power3.out',
      });
    }
  }, [filtered.length, sortBy, activeTag]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <SplitText text="Explore Destinations" as="h1" delay={40} />
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Discover premium destinations handpicked for extraordinary experiences
      </p>

      <div className="search-bar">
        <Search className="search-bar-icon" />
        <input
          type="text"
          placeholder="Search destinations or countries..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          id="destination-search"
        />
      </div>

      <div className="filter-chips">
        <button
          className={`chip${!activeTag ? ' active' : ''}`}
          onClick={() => setActiveTag(null)}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            className={`chip${activeTag === tag ? ' active' : ''}`}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            {tag.charAt(0).toUpperCase() + tag.slice(1)}
          </button>
        ))}
      </div>

      <div className="sort-bar">
        <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          {filtered.length} destination{filtered.length !== 1 ? 's' : ''}
        </span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} id="sort-select">
          <option value="rating">Top Rated</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      <div className="dest-grid" ref={gridRef}>
        {filtered.map((d) => (
          <DestinationCard key={d.id} destination={d} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={40} />
          </div>
          <h3>No destinations found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
