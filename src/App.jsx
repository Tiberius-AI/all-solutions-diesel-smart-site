import { PlatformProvider } from './context/PlatformContext'
import { usePlatform } from './context/usePlatform'
import PlatformTopBar from './components/layout/PlatformTopBar'
import ClientWebsiteView from './components/client/ClientWebsiteView'
import ConversationRoomView from './components/backoffice/ConversationRoomView'
import WorkflowsLabView from './components/workflows/WorkflowsLabView'
import './App.css'

function PlatformShell() {
  const { activeView, activeTenant } = usePlatform()

  return (
    <div
      className="platform-app-shell"
      data-view={activeView}
      style={{
        '--brand': activeTenant.brandColor,
        '--brand-secondary': activeTenant.accentSecondary || activeTenant.brandColor,
        '--accent': activeTenant.brandColor,
      }}
    >
      <PlatformTopBar />

      <div className="platform-view-stage">
        {activeView === 'client' && <ClientWebsiteView />}
        {activeView === 'backoffice' && <ConversationRoomView />}
        {activeView === 'workflows' && <WorkflowsLabView />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <PlatformProvider>
      <PlatformShell />
    </PlatformProvider>
  )
}
