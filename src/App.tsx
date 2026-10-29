import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SplashScreen from './pages/Splash/SplashScreen'
import HomePage from './pages/Home/HomePage'
import ProjectLayout from './layouts/ProjectLayout'
import Toast from './components/Toast'
import { migrateLegacyData } from './utils/migrateLegacyData'

// Code-splitting: ленивая загрузка страниц
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'))
const ScriptPage = lazy(() => import('./pages/Script/ScriptPage'))
const CreateScriptPage = lazy(() => import('./pages/Script/CreateScriptPage'))
const LocationsPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.LocationsPage })))
const CostumesPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.CostumesPage })))
const TransportPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.TransportPage })))
const PropsPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.PropsPage })))
const SFXPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.SFXPage })))
const StuntsPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.StuntsPage })))
const VFXPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.VFXPage })))
const MeetingsPage = lazy(() => import('./pages/Preproduction').then(m => ({ default: m.MeetingsPage })))
const CallsheetsPage = lazy(() => import('./pages/Callsheets/CallsheetsPage'))
const CastingPage = lazy(() => import('./pages/Casting/CastingPage'))
const ProductionPage = lazy(() => import('./pages/Production/ProductionPage'))
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'))
const AttendancePage = lazy(() => import('./pages/Attendance/AttendancePage'))
const DoodPage = lazy(() => import('./pages/Dood/DoodPage'))
const CrewPage = lazy(() => import('./pages/Crew/CrewPage'))
const ChangelogPage = lazy(() => import('./pages/Changelog/ChangelogPage'))
const AnalyticsPage = lazy(() => import('./pages/Analytics/AnalyticsPage'))
const ScheduleVersionsPage = lazy(() => import('./pages/ScheduleVersions/ScheduleVersionsPage'))
const TagsPage = lazy(() => import('./pages/Tags/TagsPage'))
const FilesPage = lazy(() => import('./pages/Files/FilesPage'))
const SchedulePage = lazy(() => import('./pages/Schedule/SchedulePage'))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'))

// Loading fallback для Suspense
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d0d1a' }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Загрузка...</p>
      </div>
    </div>
  )
}

function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [appVisible, setAppVisible] = useState(false)

  useEffect(() => {
    migrateLegacyData()
  }, [])

  const handleSplashFinish = () => {
    setSplashDone(true)
    // Небольшая пауза после гашения заставки, потом плавно появляется приложение
    setTimeout(() => setAppVisible(true), 300)
  }

  return (
    <BrowserRouter>
      {/* Заставка поверх всего */}
      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}

      {/* Основное приложение — появляется плавно после заставки */}
      <div
        style={{
          opacity: appVisible ? 1 : 0,
          transition: appVisible ? 'opacity 0.7s ease' : 'none',
          background: '#0d0d1a',
          minHeight: '100vh',
        }}
      >
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/project/:projectId" element={<ProjectLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="script" element={<ScriptPage />} />
              <Route path="script/create" element={<CreateScriptPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="locations" element={<LocationsPage />} />
              <Route path="costumes" element={<CostumesPage />} />
              <Route path="transport" element={<TransportPage />} />
              <Route path="props" element={<PropsPage />} />
              <Route path="sfx" element={<SFXPage />} />
              <Route path="stunts" element={<StuntsPage />} />
              <Route path="vfx" element={<VFXPage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="callsheets" element={<CallsheetsPage />} />
              <Route path="casting" element={<CastingPage />} />
              <Route path="production" element={<ProductionPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="dood" element={<DoodPage />} />
              <Route path="crew" element={<CrewPage />} />
              <Route path="changelog" element={<ChangelogPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="scheduleversions" element={<ScheduleVersionsPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="files" element={<FilesPage />} />
            </Route>
          </Routes>
        </Suspense>
        <Toast />
      </div>
    </BrowserRouter>
  )
}

export default App
