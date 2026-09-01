import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header?: ReactNode;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function MainLayout({
  children,
  sidebar,
  header,
  sidebarCollapsed: propCollapsed,
  onToggleSidebar: propToggleSidebar,
}: MainLayoutProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCollapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else if (propToggleSidebar) {
      propToggleSidebar();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  return (
    <div className="main-layout">
      {header}
      
      <div className={`layout-content ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-view' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        {isMobile && mobileMenuOpen && (
          <div 
            className="mobile-sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        <aside className={`sidebar ${isMobile ? 'mobile-sidebar' : ''}`}>
          {(!isCollapsed || isMobile) ? (
            sidebar
          ) : (
            <div className="sidebar-rail">
              <button
                type="button"
                className="sidebar-rail-btn"
                onClick={toggleSidebar}
                title="Expand sidebar (⌘B)"
                aria-label="Expand sidebar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          )}
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}