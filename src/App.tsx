import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SplashScreen from './pages/Splash/SplashScreen'
import HomePage from './pages/Home/HomePage'
import ProjectLayout from './layouts/ProjectLayout'
import DashboardPage from './pages/Dashboard/DashboardPage'
import ScriptPage from './pages/Script/ScriptPage'

function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [appVisible, setAppVisible] = useState(false)

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
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/project/:projectId" element={<ProjectLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="script" element={<ScriptPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
