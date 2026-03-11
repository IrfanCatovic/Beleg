import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Pages
import Login from './pages/public/Login'
import AppLayout from './ui/AppLayout'
import ErrorPage from './ui/ErrorPage'
import Home from './pages/protected/Home'
import Actions from './pages/protected/action/Actions'
import Finance from './pages/protected/Finance'
import Zadaci from './pages/protected/Zadaci'

import Search from './pages/protected/Search'
import AddAction from './pages/protected/action/AddAction'
import AddPastAction from './pages/protected/action/AddPastAction'
import Users from './pages/protected/user/Users'
import UserProfile from './pages/public/UserProfil'
import UserInfo from './pages/protected/user/UserInfo'
import ActionDetails from './pages/public/ActionDetails'
import EditAction from './pages/protected/action/EditAction'
import RegisterUser from './pages/protected/user/RegisterUser'

//routes
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import RegisterAdmin from './pages/protected/user/RegisterAdmin'
import ProfileSettings from './pages/protected/user/ProfileSettings'
import Obavestenja from './pages/protected/Obavestenja'
import Landing from './pages/public/Landing'
import Kontakt from './pages/public/Kontakt'
import Cena from './pages/public/Cena'
import Welcome from './pages/protected/Welcome'
import RegisterSuperAdmin from './pages/public/RegisterSuperAdmin'


const router = createBrowserRouter([

  {
    path: '/',                    
    element: <Landing />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/register-superadmin',
    element: <RegisterSuperAdmin />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/welcome',         
    element: <Welcome />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/adminregister',        
    element: <RegisterAdmin />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/kontakt',
    element: <Kontakt />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/cena',
    element: <Cena />,
    errorElement: <ErrorPage />,
  },

  // Glavni layout sa header-om
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
      children: [
      // Javno: detalji akcije i user profil (bez logina, za deljenje na društvene mreže)
      { path: '/akcije/:id', element: <ActionDetails /> },
      { path: '/users/:id', element: <UserProfile /> },
      { path: '/korisnik/:username', element: <UserProfile /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/home', element: <Home /> },
          { path: '/search', element: <Search /> },
          { path: '/obavestenja', element: <Obavestenja /> },

          { path: '/profil/podesavanja', element: <ProfileSettings /> },
          { path: '/profil/podesavanja/:id', element: <ProfileSettings /> },

          // Lista korisnika  svi ulogovani
          { path: '/users', element: <Users /> },

          // Info stranica – admin/sekretar vide sve; ostali samo svoj profil
          { path: '/users/:id/info', element: <UserInfo /> },

          // Akcije svi ulogovani vide listu i detalje, prijavljuju se
          { path: '/akcije', element: <Actions /> },
          { path: '/zadaci', element: <Zadaci /> },

          // Finansije, uplata, isplata admin i blagajnik
          {
            element: <RoleRoute allowedRoles={['superadmin', 'admin', 'blagajnik']} />,
            children: [
              { path: '/finansije', element: <Finance /> },
            ],
          },

          // Dodaj/izmeni akciju samo admin i vodič
          {
            element: <RoleRoute allowedRoles={['superadmin', 'admin', 'vodic']} />,
            children: [
              { path: '/dodaj-akciju', element: <AddAction /> },
              { path: '/profil/dodaj-proslu-akciju', element: <AddPastAction /> },
              { path: '/akcije/:id/izmeni', element: <EditAction /> },
            ],
          },

          // Dodaj korisnika admin i sekretar
          {
            element: <RoleRoute allowedRoles={['superadmin', 'admin', 'sekretar']} />,
            children: [
              { path: '/dodaj-korisnika', element: <RegisterUser /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <ErrorPage /> },
])

function App() {
  return <RouterProvider router={router} />
}

export default App



