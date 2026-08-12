import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Compass, Map, Heart, BarChart3, Route, Menu, X, BrainCircuit } from 'lucide-react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="navbar" id="main-navbar">
      <Link to="/" className="navbar-brand">
        <svg viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <circle cx="14" cy="14" r="8" stroke="var(--primary)" strokeWidth="2" />
          <circle cx="14" cy="14" r="3" fill="var(--primary)" />
          <line x1="14" y1="1" x2="14" y2="6" stroke="var(--primary)" strokeWidth="1.5" />
          <line x1="14" y1="22" x2="14" y2="27" stroke="var(--primary)" strokeWidth="1.5" />
          <line x1="1" y1="14" x2="6" y2="14" stroke="var(--primary)" strokeWidth="1.5" />
          <line x1="22" y1="14" x2="27" y2="14" stroke="var(--primary)" strokeWidth="1.5" />
        </svg>
        <span>Lolly<span className="text-gradient">D</span></span>
      </Link>

      <ul className="navbar-links">
        <li>
          <NavLink to="/" end>
            <BarChart3 size={16} />
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink to="/destinations">
            <Compass size={16} />
            Destinations
          </NavLink>
        </li>
        <li>
          <NavLink to="/route">
            <Route size={16} />
            Route Planner
          </NavLink>
        </li>
        <li>
          <NavLink to="/favorites">
            <Heart size={16} />
            Favorites
          </NavLink>
        </li>
        <li>
          <NavLink to="/prediction">
            <BrainCircuit size={16} />
            Predictions
          </NavLink>
        </li>
      </ul>

      <button
        className="navbar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`navbar-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <NavLink to="/" end onClick={() => setMobileOpen(false)}>
          <BarChart3 size={20} /> Dashboard
        </NavLink>
        <NavLink to="/destinations" onClick={() => setMobileOpen(false)}>
          <Compass size={20} /> Destinations
        </NavLink>
        <NavLink to="/route" onClick={() => setMobileOpen(false)}>
          <Route size={20} /> Route Planner
        </NavLink>
        <NavLink to="/favorites" onClick={() => setMobileOpen(false)}>
          <Heart size={20} /> Favorites
        </NavLink>
        <NavLink to="/prediction" onClick={() => setMobileOpen(false)}>
          <BrainCircuit size={20} /> Predictions
        </NavLink>
      </div>
    </nav>
  );
}
