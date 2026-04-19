import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <Topbar onToggleSidebar={() => setCollapsed(c => !c)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 overflow-y-auto bg-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}