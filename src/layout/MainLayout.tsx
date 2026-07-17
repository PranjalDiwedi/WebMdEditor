import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header?: ReactNode;
}

export function MainLayout({ children, sidebar, header }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
        setMobileMenuOpen(false);
      } else {
        setSidebarCollapsed(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="main-layout">
      {header && (
        <header className="app-header">
          {isMobile && (
            <button
              className="mobile-menu-button"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          )}
          <div className="header-content">{header}</div>
        </header>
      )}
      
      <div className={`layout-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-view' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        {isMobile && mobileMenuOpen && (
          <div 
            className="mobile-sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        <aside className={`sidebar ${isMobile ? 'mobile-sidebar' : ''}`}>
          <div className="sidebar-header">
            {!isMobile && (
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? '→' : '←'}
              </button>
            )}
            <h2>Notes</h2>
            {isMobile && (
              <button
                className="mobile-close-button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            )}
          </div>
          {(!sidebarCollapsed || mobileMenuOpen) && sidebar}
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}