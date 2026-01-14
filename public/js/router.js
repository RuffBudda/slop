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
    // Remove leading / and # for cleaner URLs
    const cleanPath = path.replace(/^[#\/]+/, '');
    window.location.hash = cleanPath;
  },
  
  /**
   * Handle current route
   */
  async handleRoute() {
    // Don't handle routes if we're on login/setup page
    const loginPage = document.getElementById('loginPage');
    const setupPage = document.getElementById('setupPage');
    if (loginPage && !loginPage.classList.contains('hidden')) return;
    if (setupPage && !setupPage.classList.contains('hidden')) return;
    
    const hash = window.location.hash.slice(1);
    // Default to content if hash is empty or just #
    const routePath = hash || 'content';
    const [path, ...params] = routePath.split('/').filter(p => p);
    
    this.currentRoute = { path, params, full: routePath };
    
    // Default route - content page
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
    const validRoutes = ['calendar', 'timeline', 'bin'];
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
      
      // Handle settings pages
      let html;
      if (pagePath.startsWith('settings/')) {
        const settingsPage = pagePath.replace('settings/', '');
        if (settingsPage === 'index' || settingsPage === '') {
          const response = await fetch(`/pages/settings/index.html`);
          if (!response.ok) throw new Error(`Failed to load settings index`);
          html = await response.text();
        } else {
          // Try to load specific settings page
          const response = await fetch(`/pages/settings/${settingsPage}.html`);
          if (!response.ok) {
            // Fallback to index if specific page doesn't exist
            const indexResponse = await fetch(`/pages/settings/index.html`);
            if (!indexResponse.ok) throw new Error(`Failed to load settings page`);
            html = await indexResponse.text();
          } else {
            html = await response.text();
          }
        }
      } else {
        // Load regular page
        const response = await fetch(`/pages/${pagePath}.html`);
        if (!response.ok) {
          throw new Error(`Failed to load page: ${pagePath}`);
        }
        html = await response.text();
      }
      
      mainContent.innerHTML = html;
      
      // Initialize icons after page loads - with retry
      if (window.Icons && window.Icons.init) {
        // Call immediately
        window.Icons.init();
        // Also retry after a short delay to ensure DOM is ready
        setTimeout(() => {
          if (window.Icons && window.Icons.init) {
            window.Icons.init();
          }
        }, 100);
      }
      
      // Initialize page-specific scripts
      this.initPage(pagePath);
      
    } catch (error) {
      console.error('Error loading page:', error);
      // Only show toast if we're in the main app, not on login page
      const mainApp = document.getElementById('mainApp');
      if (mainApp && !mainApp.classList.contains('hidden')) {
        if (typeof showToast === 'function') {
          showToast('Failed to load page', 'bad');
        }
      }
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
    // Trigger appropriate load function based on page
    const pageMap = {
      'content': () => { if (typeof loadContent === 'function') loadContent(); },
      'calendar': () => { if (typeof loadCalendar === 'function') loadCalendar(); },
      'timeline': () => { if (typeof loadTimeline === 'function') loadTimeline(); },
      'bin': () => { if (typeof loadBin === 'function') loadBin(); },
      'settings/index': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/account': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        setTimeout(() => {
          if (typeof initPasswordVisibilityToggles === 'function') initPasswordVisibilityToggles();
        }, 150);
      },
      'settings/openai': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/googledrive': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/linkedin': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/storage': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/ai': () => { if (typeof loadSettings === 'function') loadSettings(); },
      'settings/content': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        // Ensure post edit modal is initialized for content management
        setTimeout(() => {
          if (typeof initPostEditModal === 'function') {
            initPostEditModal();
          }
          if (typeof initCsvButtons === 'function') {
            initCsvButtons();
          }
        }, 200);
      },
      'settings/calculator': () => { 
        if (typeof loadSettings === 'function') loadSettings(); 
        // Initialize calculator
        setTimeout(() => {
          if (typeof initCalculator === 'function') {
            initCalculator();
          }
        }, 200);
      },
      'settings/admin': () => { 
        if (typeof loadSettings === 'function') loadSettings();
        // Ensure users are loaded when admin section is displayed and modal is initialized
        setTimeout(() => {
          // Check if user is admin - if not, they shouldn't see this page anyway
          // But we'll try to load users regardless and let the API handle auth
          // Initialize user edit modal first
          if (typeof initUserEditModal === 'function') {
            initUserEditModal();
          }
          // Then load users - API will return 403 if not admin
          if (typeof loadUsers === 'function') {
            loadUsers();
          }
          // Initialize password toggles
          if (typeof initPasswordVisibilityToggles === 'function') {
            initPasswordVisibilityToggles();
          }
        }, 200);
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
