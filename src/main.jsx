import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TravelProvider } from './context/TravelContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TravelProvider>
        <App />
      </TravelProvider>
    </AuthProvider>
  </React.StrictMode>
);
