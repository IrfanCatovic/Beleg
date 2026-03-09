import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Pages
import Login from './pages/Login'
import AppLayout from './ui/AppLayout'
import ErrorPage from './ui/ErrorPage'
import Home from './pages/Home'
import Actions from './pages/Actions'
import Finance from './pages/Finance'
import Zadaci from './pages/Zadaci'
import Profil from './pages/Profil'
import Search from './pages/Search'
import AddAction from './pages/AddAction'
import AddPastAction from './pages/AddPastAction'
import Users from './pages/Users'
import UserProfile from './pages/UserProfil'
import UserInfo from './pages/UserInfo'
import ActionDetails from './pages/ActionDetails'
import EditAction from './pages/EditAction'
import RegisterUser from './pages/RegisterUser'

//routes
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import RegisterAdmin from './pages/RegisterAdmin'
import ProfileSettings from './pages/ProfileSettings'
import Obavestenja from './pages/Obavestenja'
import Landing from './pages/Landing'
import Kontakt from './pages/Kontakt'
import Cena from './pages/Cena'
import Welcome from './pages/Welcome'


const router = createBrowserRouter([

  {
    path: '/',                    
    element: <Landing />,
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

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/home', element: <Home /> },
          { path: '/search', element: <Search /> },
          { path: '/obavestenja', element: <Obavestenja /> },
          { path: '/profil', element: <Profil /> },
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
            element: <RoleRoute allowedRoles={['admin', 'blagajnik']} />,
            children: [
              { path: '/finansije', element: <Finance /> },
            ],
          },

          // Dodaj/izmeni akciju samo admin i vodič
          {
            element: <RoleRoute allowedRoles={['admin', 'vodic']} />,
            children: [
              { path: '/dodaj-akciju', element: <AddAction /> },
              { path: '/profil/dodaj-proslu-akciju', element: <AddPastAction /> },
              { path: '/akcije/:id/izmeni', element: <EditAction /> },
            ],
          },

          // Dodaj korisnika admin i sekretar
          {
            element: <RoleRoute allowedRoles={['admin', 'sekretar']} />,
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



