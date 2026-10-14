import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('No existe #root en index.html');

// F-171: el commit que produjo este bundle. Lo inyecta el despliegue de CI (`--build-env`) y el
// paso «Producción sirve la app» espera a verlo en el bundle servido. Sin él (local, previews),
// queda vacío.
document.documentElement.dataset.build = import.meta.env.VITE_BUILD_SHA ?? '';

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
