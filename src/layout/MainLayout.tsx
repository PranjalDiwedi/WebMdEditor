import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header?: ReactNode;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  onCloseMobileMenu?: () => void;
}

export function MainLayout({
  children,
  sidebar,
  header,
  sidebarCollapsed = false,
  onToggleSidebar,
  mobileMenuOpen: propMobileMenuOpen,
  onMobileMenuToggle,
  onCloseMobileMenu,
}: MainLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);

  const mobileOpen = propMobileMenuOpen !== undefined ? propMobileMenuOpen : internalMobileMenuOpen;

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && mobileOpen) {
        if (onCloseMobileMenu) {
          onCloseMobileMenu();
        } else {
          setInternalMobileMenuOpen(false);
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileOpen, onCloseMobileMenu]);

  const handleCloseMobile = () => {
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    } else {
      setInternalMobileMenuOpen(false);
    }
  };

  const handleToggle = () => {
    if (isMobile) {
      if (onMobileMenuToggle) {
        onMobileMenuToggle();
      } else {
        setInternalMobileMenuOpen(!internalMobileMenuOpen);
      }
    } else if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  return (
    <div className="main-layout">
      {header}
      
      <div className={`layout-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-view' : ''} ${mobileOpen ? 'mobile-menu-open' : ''}`}>
        {isMobile && mobileOpen && (
          <div 
            className="mobile-sidebar-overlay"
            onClick={handleCloseMobile}
            aria-label="Close sidebar"
          />
        )}
        
        <aside className={`sidebar ${isMobile ? 'mobile-sidebar' : ''}`}>
          {(!sidebarCollapsed || isMobile) ? (
            sidebar
          ) : (
            <div className="sidebar-rail">
              <button
                type="button"
                className="sidebar-rail-btn"
                onClick={handleToggle}
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