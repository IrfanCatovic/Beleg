
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ModalProvider } from './context/ModalContext.tsx'
import './i18n'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map/planiner-map.css'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ModalProvider>
      <App />
    </ModalProvider>
  </AuthProvider>
)