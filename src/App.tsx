import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import AppLayout from './ui/AppLayout'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'
import Login from './pages/Login'
import Finance from './pages/Finance'
import Actions from './pages/Actions'
import ProtectedRoute from './components/ProtectedRoute'
import Profil from './pages/Profil'
import AddAction from './pages/AddAction'
import Users from './pages/Users'
import UserProfile from './pages/UserProfil'

const router = createBrowserRouter([
  {
    path: '/',                    
    element: <Login />,
    errorElement: <ErrorPage />,
  },
  {
    element: <AppLayout />,     
    errorElement: <ErrorPage />,
    children: [
      {
       element: <ProtectedRoute />, //This will prevent access to child routes if not authenticated
        children: [
          { path: '/home', element: <Home /> },
          { path: '/akcije', element: <Actions /> },
          { path: '/finansije', element: <Finance /> },
          { path: '/profil', element: <Profil /> },
          { path: '/dodaj-akciju', element: <AddAction /> },
          {path: '/users', element: <Users /> },
          {path: '/users/:id', element: <UserProfile /> },
        ],
      },
    ],
  },
  {
    path: '*', 
    element: <ErrorPage />,
  },
])

function App() {

  return <div>
    <RouterProvider router={router} />
    </div>
}

export default App


//TODO: VODIC: pravi akcije i verifikuje ko se popeo
//todo: Blagajnik samo finansije
//todo: sekretar upravlja users
//todo: za opremu i prostorije, mozda napraviti posebnu stranicu, ili ih staviti pod akcije
//todo: role za opremu zove se menadzer opreme
