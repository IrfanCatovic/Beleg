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
import Users from './pages/Users'
import UserProfile from './pages/UserProfil'
import ActionDetails from './pages/ActionDetails'
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

          // Finansije, uplata, isplata admin i blagajnik
          {
            element: <RoleRoute allowedRoles={['admin', 'blagajnik']} />,
            children: [
              { path: '/finansije', element: <Finance /> },
            ],
          },

          // Akcije i dodaj-akciju admin i vodič
          {
            element: <RoleRoute allowedRoles={['admin', 'vodic']} />,
            children: [
              { path: '/akcije', element: <Actions /> },
              { path: '/dodaj-akciju', element: <AddAction /> },
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