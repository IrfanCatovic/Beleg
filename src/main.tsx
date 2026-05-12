
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ModalProvider } from './context/ModalContext.tsx'
import './i18n'
import './index.css'
import 'leaflet/dist/leaflet.css'
import { ensureLeafletDefaultIcons } from './map/leafletIconDefault'

ensureLeafletDefaultIcons()

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ModalProvider>
      <App />
    </ModalProvider>
  </AuthProvider>
)