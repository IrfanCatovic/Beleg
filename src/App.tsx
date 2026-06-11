import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
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
import GuideReviewsPage from './pages/public/GuideReviewsPage'
import UserInfo from './pages/protected/user/UserInfo'
import ActionDetails from './pages/public/ActionDetails'
import EditAction from './pages/protected/action/EditAction'
import RegisterUser from './pages/protected/user/RegisterUser'

//routes
import ProtectedRoute from './components/routes/ProtectedRoute'
import ClubScopedRoute from './components/routes/ClubScopedRoute'
import RoleRoute from './components/routes/RoleRoute'
import AddActionRoute from './components/routes/AddActionRoute'
import RegisterAdmin from './pages/protected/user/RegisterAdmin'
import ProfileSettings from './pages/protected/user/ProfileSettings'
import Obavestenja from './pages/protected/Obavestenja'
import ObavestenjeDetalj from './pages/protected/ObavestenjeDetalj'
import FerrataList from './pages/public/FerrataList'
import FerrataDetail from './pages/public/FerrataDetail'
import GuidesList from './pages/public/GuidesList'
import Landing from './pages/public/Landing'
import Kontakt from './pages/public/Kontakt'
import Cena from './pages/public/Cena'
import Welcome from './pages/protected/Welcome'
import RegisterSuperAdmin from './pages/public/RegisterSuperAdmin'
import SuperadminKlubovi from './pages/protected/SuperadminKlubovi'
import SuperadminFerratas from './pages/protected/SuperadminFerratas'
import SuperadminFerrataGallery from './pages/protected/SuperadminFerrataGallery'
import SuperadminHotels from './pages/protected/SuperadminHotels'
import SuperadminGuideProfiles from './pages/protected/SuperadminGuideProfiles'
import BecomeGuideWizard from './pages/protected/guide/BecomeGuideWizard'
import Klub from './pages/protected/Klub'
import EnterClubInviteCode from './pages/public/EnterClubInviteCode'
import RegisterMemberByInvite from './pages/public/RegisterMemberByInvite'
import RegisterOpen from './pages/public/RegisterOpen'
import EmailVerificationPending from './pages/public/EmailVerificationPending'
import VerifyEmail from './pages/public/VerifyEmail'
import ForgotPassword from './pages/public/ForgotPassword'
import ResetPassword from './pages/public/ResetPassword'


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
    path: '/registracija-kod',
    element: <EnterClubInviteCode />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registracija-clan',
    element: <RegisterMemberByInvite />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registracija',
    element: <RegisterOpen />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/registracija-email-provera',
    element: <EmailVerificationPending />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/verifikuj-email',
    element: <VerifyEmail />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/zaboravljena-lozinka',
    element: <ForgotPassword />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/reset-lozinka',
    element: <ResetPassword />,
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
      { path: '/ferate', element: <FerrataList /> },
      { path: '/ferate/:slug', element: <FerrataDetail /> },
      { path: '/vodici', element: <GuidesList /> },
      { path: '/users/:id', element: <UserProfile /> },
      { path: '/users/:id/recenzije', element: <GuideReviewsPage /> },
      { path: '/korisnik/:username', element: <UserProfile /> },
      { path: '/korisnik/:username/recenzije', element: <GuideReviewsPage /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/home', element: <Home /> },
          { path: '/search', element: <Search /> },
          { path: '/obavestenja', element: <Obavestenja /> },
          { path: '/obavestenja/:id', element: <ObavestenjeDetalj /> },

          { path: '/profil/podesavanja', element: <ProfileSettings /> },
          { path: '/profil/podesavanja/:id', element: <ProfileSettings /> },
          { path: '/profil/postani-vodic', element: <BecomeGuideWizard /> },

          // Lista korisnika  svi ulogovani
          { path: '/users', element: <Users /> },

          // Info stranica – admin/sekretar vide sve; ostali samo svoj profil
          { path: '/users/:id/info', element: <UserInfo /> },

          // Akcije svi ulogovani vide listu i detalje, prijavljuju se
          { path: '/akcije', element: <Actions /> },
          {
            element: <ClubScopedRoute />,
            children: [{ path: '/zadaci', element: <Zadaci /> }],
          },
          { path: '/klub', element: <Klub /> },
          { path: '/klubovi/:naziv', element: <Klub /> },

          // Finansije, uplata, isplata admin i blagajnik
          {
            element: <RoleRoute allowedRoles={['superadmin', 'admin', 'blagajnik']} />,
            children: [
              { path: '/finansije', element: <Finance /> },
            ],
          },

          // Dodaj akciju: klub (admin/vodič) ili odobreni profi vodič za via ferrata vođenje
          {
            element: <AddActionRoute />,
            children: [{ path: '/dodaj-akciju', element: <AddAction /> }],
          },

          // Izmena akcije i prošle akcije samo admin i klubski vodič
          {
            element: <RoleRoute allowedRoles={['superadmin', 'admin', 'vodic']} />,
            children: [
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

          // Superadmin: upravljanje klubovima (samo superadmin)
          {
            element: <RoleRoute allowedRoles={['superadmin']} />,
            children: [
              { path: '/superadmin', element: <SuperadminKlubovi /> },
              { path: '/superadmin/ferrate', element: <SuperadminFerratas /> },
              { path: '/superadmin/ferrate/:ferrataId/galerija', element: <SuperadminFerrataGallery /> },
              { path: '/superadmin/hoteli', element: <SuperadminHotels /> },
              { path: '/superadmin/vodici-profiles', element: <SuperadminGuideProfiles /> },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <ErrorPage /> },
])

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  )
}

export default App



