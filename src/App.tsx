import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import AppLayout from './ui/AppLayout'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'

const router = createBrowserRouter([{
  element: <AppLayout />,
  errorElement: <ErrorPage />,
  children: [
    {path: '/', element: <Home />},
    {path: '/login', element: <}

  ]
}])

function App() {

  return <div>
    <RouterProvider router={router} />;
    </div>
}

export default App

