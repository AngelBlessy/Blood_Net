import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '@/components/layout/root-layout';
import { PageLoader } from '@/components/layout/page-loader';
import { RequireRole } from '@/components/auth/require-role';
import { HomePage } from '@/pages/home-page';

const HospitalPage = lazy(() => import('@/pages/hospital-page').then((m) => ({ default: m.HospitalPage })));
const BloodBankPage = lazy(() => import('@/pages/blood-bank-page').then((m) => ({ default: m.BloodBankPage })));
const AdminPage = lazy(() => import('@/pages/admin-page').then((m) => ({ default: m.AdminPage })));
const ProfilePage = lazy(() => import('@/pages/profile-page').then((m) => ({ default: m.ProfilePage })));
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })));

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="hospital"
          element={withSuspense(
            <RequireRole role="hospital">
              <HospitalPage />
            </RequireRole>
          )}
        />
        <Route
          path="blood-bank"
          element={withSuspense(
            <RequireRole role="bloodbank">
              <BloodBankPage />
            </RequireRole>
          )}
        />
        <Route
          path="admin"
          element={withSuspense(
            <RequireRole role="admin">
              <AdminPage />
            </RequireRole>
          )}
        />
        <Route path="profile" element={withSuspense(<ProfilePage />)} />
        <Route path="*" element={withSuspense(<NotFoundPage />)} />
      </Route>
    </Routes>
  );
}

export default App;
