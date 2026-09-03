// A single subject's page, linked from the image detail page's ranking list
// (issue #59). The admin submissions list shows the same view inline; this
// route makes it addressable.
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useLibrary } from '../lib/useLibrary'
import { useAdminAuth } from '../lib/adminAuth'
import AdminLogin from '../components/AdminLogin'
import SubmissionDetail from '../components/SubmissionDetail'
import './pages.css'

function SubjectDetailPage() {
  const { participantId } = useParams()
  const { authed, checking, signIn, signOut } = useAdminAuth()
  const { library } = useLibrary()

  const imageLookup = useMemo(() => {
    const lookup = new Map()
    for (const collection of library?.collections ?? []) {
      for (const image of collection.images ?? []) {
        lookup.set(`${collection.id}:${image.id}`, image)
      }
    }
    return lookup
  }, [library])

  if (checking) {
    return (
      <main className="page-shell">
        <section className="page-panel">
          <div className="home-status">
            <CircularProgress size={28} />
            <span>Loading…</span>
          </div>
        </section>
      </main>
    )
  }

  if (!authed) {
    return <AdminLogin onAuthenticated={signIn} />
  }

  return (
    <main className="page-shell">
      <section className="page-panel">
        <header className="preview-header admin-header">
          <div>
            <p className="eyebrow">Admin · Subject</p>
            <h1>Participant {participantId}</h1>
          </div>
          <div className="admin-header-actions">
            <Button component={Link} to="/admin/analytics" variant="outlined" size="small">
              ← Analytics
            </Button>
            <Button component={Link} to="/admin" variant="outlined" size="small">
              Submissions
            </Button>
            <Button onClick={signOut} variant="text" size="small">
              Sign out
            </Button>
          </div>
        </header>

        <SubmissionDetail key={participantId} participantId={participantId} imageLookup={imageLookup} />
      </section>
    </main>
  )
}

export default SubjectDetailPage
