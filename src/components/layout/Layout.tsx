import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setIsMobile(w < 768)
      // Auto-collapse en tablet
      if (w < 1024) setCollapsed(true)
      else setCollapsed(false)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) setMobileOpen(o => !o)
    else setCollapsed(c => !c)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0a0e1a', overflow:'hidden' }}>
      <Topbar onToggleSidebar={toggleSidebar} />
      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>
        {/* Overlay mobile */}
        {isMobile && mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:290, top:48 }}
          />
        )}
        <Sidebar
          collapsed={isMobile ? false : collapsed}
          mobileOpen={mobileOpen}
          isMobile={isMobile}
        />
        <main
          style={{ flex:1, overflowY:'auto', overflowX:'hidden', background:'#0a0e1a', minWidth:0 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
