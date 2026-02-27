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
import AdminRoute from './components/AdminRoute'
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

      // Javno: detalji akcije (bez logina, za deljenje na društvene mreže)
      { path: '/akcije/:id', element: <ActionDetails /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/akcije', element: <Actions /> },
          { path: '/profil', element: <Profil /> },
          { path: '/profil/podesavanja', element: <ProfileSettings /> },

          // Ove dve su vidljive svima ulogovanima
          { path: '/users', element: <Users /> },
          { path: '/users/:id', element: <UserProfile /> },

          // SAMO ADMIN vidi ove
          {
            element: <AdminRoute />,
            children: [
              { path: '/finansije', element: <Finance /> },
              { path: '/dodaj-akciju', element: <AddAction /> },
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