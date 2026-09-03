import { useState, useEffect, useCallback, useRef } from 'react';
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

const MIN_SIDEBAR_WIDTH = 230;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 280;

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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('mandrak_sidebar_width');
      return stored ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Number(stored))) : DEFAULT_SIDEBAR_WIDTH;
    } catch {
      return DEFAULT_SIDEBAR_WIDTH;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

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

  // Handle sidebar resizing on desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile || sidebarCollapsed) return;
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, moveEvent.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isMobile, sidebarCollapsed]);

  // Save width to localStorage when resizing finishes
  useEffect(() => {
    if (!isResizing && !isMobile) {
      try {
        localStorage.setItem('mandrak_sidebar_width', String(sidebarWidth));
      } catch {}
    }
  }, [isResizing, sidebarWidth, isMobile]);

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

  const sidebarInlineStyle = !isMobile && !sidebarCollapsed
    ? { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }
    : undefined;

  return (
    <div className={`main-layout ${isResizing ? 'is-resizing-sidebar' : ''}`}>
      {header}
      
      <div className={`layout-content ${sidebarCollapsed && !isMobile ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile-view' : ''} ${mobileOpen ? 'mobile-menu-open' : ''}`}>
        {isMobile && mobileOpen && (
          <div 
            className="mobile-sidebar-overlay"
            onClick={handleCloseMobile}
            aria-label="Close sidebar"
          />
        )}
        
        <aside
          className={`sidebar ${isMobile ? 'mobile-sidebar' : ''}`}
          style={sidebarInlineStyle}
        >
          {(!sidebarCollapsed || isMobile) ? (
            <>
              {sidebar}
              {!isMobile && !sidebarCollapsed && (
                <div
                  className={`sidebar-resizer ${isResizing ? 'active' : ''}`}
                  onMouseDown={handleMouseDown}
                  title="Drag to resize sidebar"
                />
              )}
            </>
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