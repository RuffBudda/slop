/**
 * Main Application Module
 * Initializes and orchestrates all app components
 */

// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

async function initApp() {
  console.log('Initializing SLOP...');
  
  // Initialize keyboard shortcuts
  initKeyboardShortcuts();
  
  // Initialize navigation
  initNavigation();
  
  // Initialize dock
  initDock();
  
  // Initialize global search
  initGlobalSearch();
  
  // Initialize bulk actions
  initBulkActions();
  
  // Update badge counters
  updateBadges();
  
  // Load initial tab
  activateTab('content');
  
  console.log('SLOP initialized successfully');
}

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

function initDock() {
  const dock = document.getElementById('dock');
  const fab = dock?.querySelector('.fab');
  
  if (!fab) return;
  
  // Check if APIs are configured and show/hide FAB accordingly
  async function updateFabVisibility() {
    try {
      const settings = await API.settings.get();
      const hasOpenAI = settings.settings?.openai_api_key || false;
      const hasStability = settings.settings?.stability_api_key || false;
      
      if (hasOpenAI && hasStability) {
        fab.style.display = '';
        fab.title = 'Generate More Posts';
      } else {
        fab.style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to check API settings:', error);
      fab.style.display = 'none';
    }
  }
  
  // Update visibility on load and when settings change
  updateFabVisibility();
  window.addEventListener('settingsUpdated', updateFabVisibility);
  
  // Generate posts on FAB click
  fab.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // Check APIs again before generating
    try {
      const settings = await API.settings.get();
      const hasOpenAI = settings.settings?.openai_api_key || false;
      const hasStability = settings.settings?.stability_api_key || false;
      
      if (!hasOpenAI || !hasStability) {
        showToast('Please configure OpenAI and Stability AI APIs in Settings', 'bad');
        activateTab('settings');
        return;
      }
      
      // Trigger generation
      if (typeof triggerGeneration === 'function') {
        await triggerGeneration();
      } else {
        showToast('Generation function not available', 'bad');
      }
    } catch (error) {
      showToast('Failed to start generation', 'bad');
      console.error('Generation error:', error);
    }
  });
  
  // Close dock when clicking outside
  document.addEventListener('click', (e) => {
    if (!dock.contains(e.target)) {
      dock.classList.remove('open');
    }
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
  
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    showMainApp();
    initApp();
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
