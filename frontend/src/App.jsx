import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { Loading } from './components/States.jsx'
import Contests from './pages/Contests.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Privacy from './pages/Privacy.jsx'
import Problems from './pages/Problems.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Signup from './pages/Signup.jsx'
import Terms from './pages/Terms.jsx'

// Pages with the editor, and everything for admins, load only when someone opens them
const ProblemDetail = lazy(() => import('./pages/ProblemDetail.jsx'))
const ContestDetail = lazy(() => import('./pages/ContestDetail.jsx'))
const Submissions = lazy(() => import('./pages/Submissions.jsx'))
const SubmissionDetail = lazy(() => import('./pages/SubmissionDetail.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'))
const AdminProblems = lazy(() => import('./pages/admin/AdminProblems.jsx'))
const AdminProblemEdit = lazy(() => import('./pages/admin/AdminProblemEdit.jsx'))
const AdminContests = lazy(() => import('./pages/admin/AdminContests.jsx'))
const AdminContestEdit = lazy(() => import('./pages/admin/AdminContestEdit.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'))

const protectedPage = (element) => <RequireAuth>{element}</RequireAuth>

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="problems" element={<Problems />} />
          <Route path="problems/:slug" element={<ProblemDetail />} />
          <Route path="contests" element={<Contests />} />
          <Route path="contests/:id" element={<ContestDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password/:token" element={<ResetPassword />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />

          <Route path="submissions" element={protectedPage(<Submissions />)} />
          <Route path="submissions/:id" element={protectedPage(<SubmissionDetail />)} />
          <Route path="profile" element={protectedPage(<Profile />)} />

          <Route
            path="admin"
            element={
              <RequireAuth role="admin">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="problems" element={<AdminProblems />} />
            <Route path="problems/new" element={<AdminProblemEdit />} />
            <Route path="problems/:id" element={<AdminProblemEdit />} />
            <Route path="contests" element={<AdminContests />} />
            <Route path="contests/new" element={<AdminContestEdit />} />
            <Route path="contests/:id" element={<AdminContestEdit />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
