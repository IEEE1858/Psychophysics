import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import PreviewViewer from './pages/PreviewViewer.jsx'
import DemographicsPage from './pages/DemographicsPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import AuthCompletePage from './pages/AuthCompletePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import ImageDetailPage from './pages/ImageDetailPage.jsx'
import RankingsPage from './pages/RankingsPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import { I18nProvider } from './lib/I18nProvider.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
import { initAnalytics } from './lib/consent.js'

// Loads analytics only outside the consent region, or where consent was already
// given. Everyone else sees the banner first and nothing is sent to Google.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/preview/:collectionId" element={<PreviewPage />} />
          <Route path="/preview/:collectionId/:imageId" element={<PreviewViewer />} />
          <Route path="/demographics" element={<DemographicsPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/auth/complete" element={<AuthCompletePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/images/:collectionId/:imageId" element={<ImageDetailPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/study" element={<App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ConsentBanner />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
