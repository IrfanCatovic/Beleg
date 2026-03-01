import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Pages
import Login from './pages/Login'
import AppLayout from './ui/AppLayout'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'
import Actions from './pages/Actions'
import Finance from './pages/Finance'
import Profil from './pages/Profil'
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
import Welcome from './pages/Welcome'
import RegisterAdmin from './pages/RegisterAdmin'
import ProfileSettings from './pages/ProfileSettings'


const router = createBrowserRouter([

  {
    path: '/',                    
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

  // Glavni layout sa header-om
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/home', element: <Home /> },

      // Javno: detalji akcije i user profil (bez logina, za deljenje na društvene mreže)
      { path: '/akcije/:id', element: <ActionDetails /> },
      { path: '/users/:id', element: <UserProfile /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/profil', element: <Profil /> },
          { path: '/profil/podesavanja', element: <ProfileSettings /> },
          { path: '/profil/podesavanja/:id', element: <ProfileSettings /> },

          // Lista korisnika  svi ulogovani
          { path: '/users', element: <Users /> },

          // Info stranica – admin/sekretar vide sve; ostali samo svoj profil
          { path: '/users/:id/info', element: <UserInfo /> },

          // Akcije – svi ulogovani vide listu i detalje, prijavljuju se
          { path: '/akcije', element: <Actions /> },

          // Finansije, uplata, isplata admin i blagajnik
          {
            element: <RoleRoute allowedRoles={['admin', 'blagajnik']} />,
            children: [
              { path: '/finansije', element: <Finance /> },
            ],
          },

          // Dodaj/izmeni akciju – samo admin i vodič
          {
            element: <RoleRoute allowedRoles={['admin', 'vodic']} />,
            children: [
              { path: '/dodaj-akciju', element: <AddAction /> },
              { path: '/profil/dodaj-proslu-akciju', element: <AddPastAction /> },
              { path: '/akcije/:id/izmeni', element: <EditAction /> },
            ],
          },

          // Dodaj korisnika – admin i sekretar
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