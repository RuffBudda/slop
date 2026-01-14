/**
 * Main Application Module
 * Initializes and orchestrates all app components
 */

// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

async function initApp() {
  console.log('Initializing SLOP...');
  
  // Initialize icons (Flaticon)
  if (window.Icons && window.Icons.init) {
    window.Icons.init();
  }
  
  // Initialize search button click handler
  const searchBtn = document.getElementById('btnSearch');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      if (typeof window.openSearchModal === 'function') {
        window.openSearchModal();
      }
    });
  }
  
  // Logo click handler - navigate to content
  const brandLogo = document.getElementById('brandLogo');
  const appLogo = document.getElementById('appLogo');
  const logoClickHandler = () => {
    if (window.Router && window.Router.navigate) {
      window.Router.navigate('content');
    }
  };
  if (brandLogo) brandLogo.addEventListener('click', logoClickHandler);
  if (appLogo) appLogo.addEventListener('click', logoClickHandler);
  
  // Initialize keyboard shortcuts
  initKeyboardShortcuts();
  
  // Initialize navigation
  initNavigation();
  
  // Initialize dock
  initDock();
  
  // Initialize global search
  if (typeof initGlobalSearch === 'function') {
    initGlobalSearch();
  }
  
  // Initialize bulk actions
  initBulkActions();
  
  // Update badge counters
  updateBadges();
  
  // Update FAB visibility based on API configuration
  updateFabVisibility();
  
  // Initial routing is handled by Router.init() which processes the current hash
  // Don't force 'content' here as it would override hash-based navigation
  
  console.log('SLOP initialized successfully');
}

// Make updateFabVisibility globally available
window.updateFabVisibility = updateFabVisibility;

// ============================================================
// NAVIGATION
// ============================================================

function initNavigation() {
  document.querySelectorAll('.navBtn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });
}

// ============================================================
// DOCK
// ============================================================

/**
 * Check if both OpenAI and Stability API keys are configured
 */
async function checkApiConfiguration() {
  try {
    const result = await API.settings.get(['openai_api_key', 'stability_api_key']);
    const settings = result.settings || {};
    const hasOpenAI = !!(settings.openai_api_key && settings.openai_api_key.trim());
    const hasStability = !!(settings.stability_api_key && settings.stability_api_key.trim());
    return hasOpenAI && hasStability;
  } catch (error) {
    console.error('Failed to check API configuration:', error);
    return false;
  }
}

/**
 * Update FAB button visibility based on API configuration
 */
async function updateFabVisibility() {
  const dock = document.getElementById('dock');
  const fab = dock?.querySelector('.fab');
  
  if (!fab) return;
  
  const apisConfigured = await checkApiConfiguration();
  
  if (apisConfigured) {
    fab.style.display = 'flex';
    dock.classList.remove('hidden');
  } else {
    fab.style.display = 'none';
  }
}

function initDock() {
  const dock = document.getElementById('dock');
  const fab = dock?.querySelector('.fab');
  const fabIcon = fab?.querySelector('.fab-icon');
  
  if (!fab) return;
  
  // Initialize FAB icon with lightning icon
  if (fabIcon && window.Icons && window.Icons.get) {
    fabIcon.innerHTML = window.Icons.get('lightning', '', { size: '24px' });
  }
  
  // Set FAB title/tooltip
  fab.setAttribute('title', 'Generate new posts');
  fab.setAttribute('aria-label', 'Generate new posts');
  
  // FAB click handler - trigger content generation
  fab.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (typeof triggerGeneration === 'function') {
      await triggerGeneration();
    }
  });
  
  // Check API configuration and update visibility
  updateFabVisibility();
  
  // Also update when settings change (listen for custom event or check periodically)
  // We'll update visibility when settings page is loaded/changed
  window.addEventListener('settingsUpdated', () => {
    updateFabVisibility();
  });
}

// ============================================================
// BULK ACTIONS
// ============================================================

function initBulkActions() {
  const bar = document.getElementById('bulkActionsBar');
  const countEl = document.getElementById('selectedCount');
  const approveBtn = document.getElementById('bulkApprove');
  const rejectBtn = document.getElementById('bulkReject');
  const cancelBtn = document.getElementById('bulkCancel');
  
  if (!bar) return;
  
  // Approve all selected
  approveBtn?.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.card.bulk-selected');
    const ids = Array.from(selected).map(c => c.dataset.postId);
    
    if (ids.length === 0) return;
    
    try {
      showLoader();
      for (const id of ids) {
        await API.posts.updateStatus(id, 'Scheduled');
      }
      showToast(`${ids.length} posts approved`, 'ok');
      clearBulkSelection();
      clearCache();
      loadContent(true);
      updateBadges();
    } catch (error) {
      showToast('Failed to approve posts', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Reject all selected
  rejectBtn?.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.card.bulk-selected');
    const ids = Array.from(selected).map(c => c.dataset.postId);
    
    if (ids.length === 0) return;
    
    try {
      showLoader();
      for (const id of ids) {
        await API.posts.updateStatus(id, 'rejected');
      }
      showToast(`${ids.length} posts rejected`, 'neutral');
      clearBulkSelection();
      clearCache();
      loadContent(true);
      updateBadges();
    } catch (error) {
      showToast('Failed to reject posts', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Cancel selection
  cancelBtn?.addEventListener('click', clearBulkSelection);
}

function clearBulkSelection() {
  document.querySelectorAll('.card.bulk-selected').forEach(c => {
    c.classList.remove('bulk-selected');
  });
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionsBar');
  const countEl = document.getElementById('selectedCount');
  const selected = document.querySelectorAll('.card.bulk-selected');
  
  if (selected.length > 0) {
    bar?.classList.remove('hidden');
    if (countEl) countEl.textContent = selected.length;
  } else {
    bar?.classList.add('hidden');
  }
}

window.toggleBulkSelect = function(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (card) {
    card.classList.toggle('bulk-selected');
    updateBulkActionBar();
  }
};

// ============================================================
// ============================================================
// STARTUP FLOW
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM ready, checking auth status...');
  
  // Safety timeout: hide loader after 15 seconds no matter what
  const safetyTimeout = setTimeout(() => {
    console.warn('Safety timeout: hiding app loader');
    hideAppLoader();
    if (typeof showLoginPage === 'function') {
      showLoginPage();
    }
  }, 15000);
  
  try {
    const isAuthenticated = await checkAuthStatus();
    
    clearTimeout(safetyTimeout);
    
    if (isAuthenticated) {
      showMainApp();
      initApp();
    }
  } catch (error) {
    clearTimeout(safetyTimeout);
    console.error('Failed to initialize app:', error);
    // Ensure loader is hidden even if checkAuthStatus fails
    hideAppLoader();
    // Show login page as fallback
    if (typeof showLoginPage === 'function') {
      showLoginPage();
    }
  }
});

// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ============================================================
// SERVICE WORKER REGISTRATION (for future PWA support)
// ============================================================

// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(registration => console.log('SW registered'))
//       .catch(error => console.log('SW registration failed:', error));
//   });
// }