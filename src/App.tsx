import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import AppLayout from './ui/AppLayout'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'
import Login from './pages/Login'
import Finance from './pages/Finance'
import Actions from './pages/Actions'

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
        path: '/home',         
        element: <Home />,
      },
      { 
        path: '/finansije',
        element: <Finance />,
      },
      {
        path: '/akcije',
        element: <Actions />,
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

