import { createContext, useContext, useEffect, useState } from 'react';

const TravelContext = createContext();

export function TravelProvider({ children }) {
  const [favorites, setFavorites] = useState(() =>
    JSON.parse(localStorage.getItem('lollyd_favorites')) || []
  );

  const [trips, setTrips] = useState(() =>
    JSON.parse(localStorage.getItem('lollyd_trips')) || []
  );

  const [routeHistory, setRouteHistory] = useState(() =>
    JSON.parse(localStorage.getItem('lollyd_routes')) || []
  );

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isFavorite = (id) => favorites.includes(id);

  const addTrip = (trip) => {
    setTrips((prev) => [{ ...trip, id: Date.now(), date: new Date().toISOString() }, ...prev]);
  };

  const removeTrip = (id) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const addRoute = (route) => {
    setRouteHistory((prev) => [{ ...route, id: Date.now(), createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
  };

  useEffect(() => {
    localStorage.setItem('lollyd_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('lollyd_trips', JSON.stringify(trips));
  }, [trips]);

  useEffect(() => {
    localStorage.setItem('lollyd_routes', JSON.stringify(routeHistory));
  }, [routeHistory]);

  return (
    <TravelContext.Provider value={{
      favorites,
      toggleFavorite,
      isFavorite,
      trips,
      addTrip,
      removeTrip,
      routeHistory,
      addRoute,
    }}>
      {children}
    </TravelContext.Provider>
  );
}

export const useTravel = () => useContext(TravelContext);
