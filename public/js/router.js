/**
 * Router Module
 * Handles clean URL routing for SPA navigation using History API
 * Falls back to hash-based routing if History API is not available
 */

const Router = {
  currentRoute: null,
  routes: {},
  useHistoryAPI: typeof window !== 'undefined' && window.history && window.history.pushState,
  
  init() {
    // Migrate hash-based URLs to clean URLs (one-time migration)
    if (window.location.hash) {
      const hashPath = window.location.hash.slice(1);
      const cleanPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
      window.history.replaceState(null, '', cleanPath);
      window.location.hash = ''; // Remove hash
    }
    
    // Handle initial route
    this.handleRoute();
    
    // Listen for browser navigation (back/forward buttons)
    window.addEventListener('popstate', () => this.handleRoute());
    
    // Also listen for hash changes for backward compatibility during transition
    window.addEventListener('hashchange', () => {
      // Migrate hash to clean URL if someone uses hash navigation
      if (window.location.hash) {
        const hashPath = window.location.hash.slice(1);
        const cleanPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
        window.history.replaceState(null, '', cleanPath);
        window.location.hash = '';
        this.handleRoute();
      }
    });
  },
  
  /**
   * Register a route
   */
  register(path, handler) {
    this.routes[path] = handler;
  },
  
  /**
   * Navigate to a route
   */
  navigate(path) {
    // Clean up path - remove leading # or / if present, then add leading /
    let cleanPath = path.replace(/^[#\/]+/, '');
    if (!cleanPath) cleanPath = 'content'; // Default to content
    cleanPath = `/${cleanPath}`;
    
    if (this.useHistoryAPI) {
      // Use History API for clean URLs
      window.history.pushState(null, '', cleanPath);
      this.handleRoute();
    } else {
      // Fallback to hash-based routing
      window.location.hash = cleanPath;
    }
  },
  
  /**
   * Handle current route
   */
  async handleRoute() {
    // Get path from URL (either from pathname or hash as fallback)
    let routePath = window.location.pathname;
    
    // Remove leading slash
    if (routePath.startsWith('/')) {
      routePath = routePath.slice(1);
    }
    
    // Fallback to hash if pathname is empty or just '/'
    if (!routePath || routePath === '/') {
      routePath = window.location.hash.slice(1) || 'content';
      // Clean up hash path
      if (routePath.startsWith('/')) {
        routePath = routePath.slice(1);
      }
    }
    
    const [path, ...params] = routePath.split('/').filter(p => p);
    
    this.currentRoute = { path: path || 'content', params, full: routePath };
    
    // Default route
    if (!path || path === 'content') {
      await this.loadPage('content');
      return;
    }
    
    // Settings routes
    if (path === 'settings') {
      if (params.length === 0) {
        await this.loadPage('settings/index');
      } else {
        await this.loadPage(`settings/${params[0]}`);
      }
      return;
    }
    
    // Documentation route
    if (path === 'documentation' || path === 'docs') {
      await this.loadPage('documentation');
      return;
    }
    
    // Other main routes
    const validRoutes = ['calendar', 'timeline', 'bin', 'settings'];
    if (validRoutes.includes(path)) {
      await this.loadPage(path);
    } else {
      // Default to content
      await this.loadPage('content');
    }
  },
  
  /**
   * Load a page from file
   */
  async loadPage(pagePath) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) {
      console.error('Main content container not found');
      return;
    }
    
    try {
      // Show loading state
      mainContent.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>Loading...</p></div>';
      
      // Load page HTML
      const response = await fetch(`/pages/${pagePath}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load page: ${pagePath}`);
      }
      
      const html = await response.text();
      mainContent.innerHTML = html;
      
      // Initialize icons for dynamically loaded pages
      if (window.Icons && window.Icons.init) {
        window.Icons.init();
      }
      
      // Initialize close icons for dynamically loaded pages
      setTimeout(() => {
        if (typeof window.initAllCloseIcons === 'function') {
          window.initAllCloseIcons();
        }
      }, 150);
      
      // Initialize page-specific scripts
      this.initPage(pagePath);
      
      // Initialize documentation page if needed
      if (pagePath === 'documentation' && typeof window.loadDocumentation === 'function') {
        window.loadDocumentation();
      }
      
    } catch (error) {
      console.error('Error loading page:', error);
      mainContent.innerHTML = `
        <div class="emptyState">
          <h2>Error Loading Page</h2>
          <p>${error.message}</p>
          <button class="btn approve" onclick="window.Router.navigate('content')">Go to Content</button>
        </div>
      `;
    }
  },
  
  /**
   * Initialize page-specific functionality
   */
  initPage(pagePath) {
    // Hide any initial loader that might be in the loaded page
    const loader = document.getElementById('initialLoader');
    if (loader) loader.style.display = 'none';
    
    // Trigger appropriate load function based on page
    const pageMap = {
      'content': () => { if (typeof loadContent === 'function') loadContent(); },
      'calendar': () => { if (typeof loadCalendar === 'function') loadCalendar(); },
      'timeline': () => { if (typeof loadTimeline === 'function') loadTimeline(); },
      'bin': () => { if (typeof loadBin === 'function') loadBin(); },
      'settings/index': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/account': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/openai': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/googledrive': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/linkedin': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/storage': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/ai': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/content': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        if (typeof initPostEditModal === 'function') initPostEditModal();
        if (typeof initCsvButtons === 'function') initCsvButtons();
      },
      'settings/admin': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        if (typeof loadUsers === 'function') loadUsers(); 
      },
      'settings/calculator': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        if (typeof initCalculator === 'function') initCalculator(); 
      }
    };
    
    const initFn = pageMap[pagePath];
    if (initFn) {
      setTimeout(initFn, 100); // Small delay to ensure DOM is ready
    }
  }
};

// Initialize router when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Router.init());
} else {
  Router.init();
}

// Export for global use
window.Router = Router;