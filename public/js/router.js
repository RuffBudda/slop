/**
 * Router Module
 * Handles hash-based routing for SPA navigation
 */

const Router = {
  currentRoute: null,
  routes: {},
  
  init() {
    // Handle initial route
    this.handleRoute();
    
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
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
    window.location.hash = path.startsWith('#') ? path : `#${path}`;
  },
  
  /**
   * Handle current route
   */
  async handleRoute() {
    const hash = window.location.hash.slice(1) || '/content';
    const [path, ...params] = hash.split('/').filter(p => p);
    
    this.currentRoute = { path, params, full: hash };
    
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
      
      // Initialize page-specific scripts
      this.initPage(pagePath);
      
    } catch (error) {
      console.error('Error loading page:', error);
      mainContent.innerHTML = `
        <div class="emptyState">
          <h2>Error Loading Page</h2>
          <p>${error.message}</p>
          <button class="btn approve" onclick="window.location.hash = '#/content'">Go to Content</button>
        </div>
      `;
    }
  },
  
  /**
   * Initialize page-specific functionality
   */
  initPage(pagePath) {
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