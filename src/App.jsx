import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import DestinationList from './pages/DestinationList';
import DestinationDetails from './pages/DestinationDetails';
import RoutePlanner from './pages/RoutePlanner';
import Favorites from './pages/Favorites';
import Prediction from './pages/Prediction';
import Layout from './layout/Layout';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />
        <Route path="/" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/destinations" element={<DestinationList />} />
          <Route path="/destination/:id" element={<DestinationDetails />} />
          <Route path="/route" element={<RoutePlanner />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/prediction" element={<Prediction />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
