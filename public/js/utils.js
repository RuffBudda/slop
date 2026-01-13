/**
 * Utility Functions
 * Shared utilities for the SLOP frontend
 */

// ============================================================
// CACHE MANAGEMENT
// ============================================================

const CACHE_TTL = 60000; // 1 minute
const cache = {};

window.isCacheValid = function(key) {
  const entry = cache[key];
  if (!entry) return false;
  return Date.now() - entry.time < CACHE_TTL;
};

window.setCache = function(key, data) {
  cache[key] = { data, time: Date.now() };
};

window.getCache = function(key) {
  const entry = cache[key];
  return entry ? entry.data : null;
};

window.clearCache = function(key) {
  if (key) {
    delete cache[key];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
};

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

window.showToast = function(msg, type = 'neutral', duration = 3000) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  wrap.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'scale(0.95)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
};

// ============================================================
// LOADER MANAGEMENT
// ============================================================

window.showLoader = function() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.remove('hidden');
};

window.hideLoader = function() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.add('hidden');
};

window.showAppLoader = function() {
  const loader = document.getElementById('appLoader');
  if (loader) {
    loader.style.display = 'flex'; // Restore display before removing hidden class
    // Force reflow to ensure display is applied
    loader.offsetHeight;
    loader.classList.remove('hidden');
  }
};

window.hideAppLoader = function() {
  const loader = document.getElementById('appLoader');
  if (loader) {
    loader.classList.add('hidden');
    // After transition completes, remove from render tree
    setTimeout(() => {
      if (loader.classList.contains('hidden')) {
        loader.style.display = 'none';
      }
    }, 300); // Match transition duration (0.3s)
  }
};

// ============================================================
// GLOBAL STATE
// ============================================================

window.AppState = {
  user: null,
  currentTab: 'content',
  posts: [],
  generatedPosts: [],
  scheduledPosts: [],
  rejectedPosts: [],
  pendingPosts: [],
  isGenerating: false,
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  modalCtx: null
};

// ============================================================
// TAB MANAGEMENT
// ============================================================

window.activateTab = function(tabName, subSection = null) {
  // Update state
  window.AppState.currentTab = tabName;
  
  // Use router for navigation
  if (window.Router) {
    if (tabName === 'settings' && subSection) {
      window.Router.navigate(`/settings/${subSection}`);
    } else if (tabName === 'settings') {
      window.Router.navigate('/settings');
    } else {
      window.Router.navigate(`/${tabName}`);
    }
  } else {
    // Fallback to hash navigation
    if (subSection) {
      window.location.hash = `#/${tabName}/${subSection}`;
    } else {
      window.location.hash = `#/${tabName}`;
    }
  }
  
  // Update navigation buttons
  document.querySelectorAll('.navBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update dock
  if (typeof window.updateDock === 'function') {
    window.updateDock();
  }
};

// Hash-based routing is handled by router.js
// The router module registers its own hashchange listener and handles initial route in Router.init()

// ============================================================
// DOCK MANAGEMENT
// ============================================================

window.updateDock = function() {
  const dockItems = document.getElementById('dockItems');
  if (!dockItems) return;
  
  const items = [];
  const generated = window.AppState.generatedPosts || [];
  
  // Add post items to dock (max 5)
  generated.slice(0, 5).forEach((post, idx) => {
    items.push({
      label: post.post_id?.substring(0, 6) || `#${idx + 1}`,
      action: () => scrollToCard(post.id)
    });
  });
  
  dockItems.innerHTML = items.map((item, idx) => `
    <button class="dot" data-idx="${idx}">${item.label}</button>
  `).join('');
  
  dockItems.querySelectorAll('.dot').forEach((dot, idx) => {
    dot.addEventListener('click', () => items[idx].action());
  });
};

function scrollToCard(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('highlight');
    setTimeout(() => card.classList.remove('highlight'), 1000);
  }
}

// ============================================================
// RESCHEDULE MODAL
// ============================================================

window.showRescheduleModal = function(postId, currentDate) {
  const modal = document.getElementById('rescheduleModal');
  const input = document.getElementById('rescheduleDate');
  
  if (!modal || !input) return;
  
  window.AppState.modalCtx = { postId };
  
  // Set current date if provided
  if (currentDate) {
    const date = new Date(currentDate);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    input.value = localDate.toISOString().slice(0, 16);
  } else {
    input.value = '';
  }
  
  modal.showModal();
};

// ============================================================
// DATE/TIME UTILITIES
// ============================================================

window.formatDate = function(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

window.formatTime = function(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

window.formatDateTime = function(dateStr) {
  if (!dateStr) return '';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
};

// ============================================================
// STATUS UTILITIES
// ============================================================

window.getStatusClass = function(status) {
  const classes = {
    'generated': 'ok',
    'Scheduled': 'ok',
    'Queue': 'neutral',
    'rejected': 'bad',
    'published': 'ok',
    'processing': 'neutral'
  };
  return classes[status] || 'neutral';
};

window.getStatusIcon = function(status) {
  const icons = {
    'generated': window.Icons ? window.Icons.get('success', '', { size: '14px' }) : '✓',
    'Scheduled': '📅',
    'Queue': '⏳',
    'rejected': '✗',
    'published': '🚀',
    'processing': window.Icons ? window.Icons.get('processing', '', { size: '14px' }) : '⚙'
  };
  return icons[status] || '•';
};

// ============================================================
// IMAGE URL CONVERSION
// ============================================================

window.convertGoogleDriveUrl = function(url) {
  if (!url) return '';
  
  // Check if it's already a direct URL
  if (url.includes('digitaloceanspaces.com') || url.startsWith('http') && !url.includes('drive.google.com')) {
    return url;
  }
  
  // Convert Google Drive URLs
  const patterns = [
    /https:\/\/drive\.google\.com\/file\/d\/([^\/]+)\/view/,
    /https:\/\/drive\.google\.com\/open\?id=([^&]+)/,
    /https:\/\/drive\.google\.com\/uc\?id=([^&]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  
  return url;
};

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

window.initKeyboardShortcuts = function() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target.matches('input, textarea, select')) return;
    
    // Ignore if modal is open (except for ? which opens help)
    const openModals = document.querySelectorAll('dialog[open]');
    if (openModals.length > 0 && e.key !== '?') return;
    
    // Show shortcuts help
    if (e.key === '?') {
      e.preventDefault();
      showShortcutsHelp();
      return;
    }
    
    // Tab switching
    if (e.altKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          window.activateTab('content');
          break;
        case '2':
          e.preventDefault();
          window.activateTab('calendar');
          break;
        case '3':
          e.preventDefault();
          window.activateTab('timeline');
          break;
        case '4':
          e.preventDefault();
          window.activateTab('bin');
          break;
        case '5':
          e.preventDefault();
          window.activateTab('settings');
          break;
      }
    }
    
    // Preview shortcut
    if (e.key === 'p' || e.key === 'P') {
      const focused = document.querySelector('.card.focused');
      if (focused && window.AppState.currentTab === 'content') {
        e.preventDefault();
        showPreview(focused.dataset.postId);
      }
    }
    
    // Content tab shortcuts
    if (window.AppState.currentTab === 'content' && typeof handleContentKeyboard === 'function') {
      handleContentKeyboard(e);
    }
  });
};

// ============================================================
// ESCAPE HTML
// ============================================================

window.escapeHtml = function(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// ============================================================
// DEBOUNCE
// ============================================================

window.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ============================================================
// THROTTLE
// ============================================================

window.throttle = function(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// ============================================================
// BADGE COUNTERS
// ============================================================

window.updateBadges = async function() {
  try {
    // Fetch counts for each category
    const [generated, scheduled, rejected] = await Promise.all([
      API.posts.getGenerated(),
      API.posts.getScheduled(),
      API.posts.getRejected()
    ]);
    
    // Update Content badge
    const contentBadge = document.getElementById('badgeContent');
    const contentCount = generated.total || 0;
    if (contentCount > 0) {
      contentBadge.textContent = contentCount;
      contentBadge.style.display = '';
    } else {
      contentBadge.style.display = 'none';
    }
    
    // Update Calendar badge
    const calendarBadge = document.getElementById('badgeCalendar');
    const calendarCount = scheduled.total || 0;
    if (calendarCount > 0) {
      calendarBadge.textContent = calendarCount;
      calendarBadge.style.display = '';
    } else {
      calendarBadge.style.display = 'none';
    }
    
    // Update Bin badge
    const binBadge = document.getElementById('badgeBin');
    const binCount = rejected.total || 0;
    if (binCount > 0) {
      binBadge.textContent = binCount;
      binBadge.style.display = '';
    } else {
      binBadge.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to update badges:', error);
  }
};

// ============================================================
// GLOBAL SEARCH
// ============================================================

window.initGlobalSearch = function() {
  const searchInput = document.getElementById('globalSearch');
  const searchResults = document.getElementById('searchResults');
  
  if (!searchInput || !searchResults) return;
  
  // Debounced search
  const performSearch = debounce(async (query) => {
    if (!query || query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    
    try {
      const result = await API.posts.list({ limit: 100 });
      const posts = result.posts || [];
      
      // Filter posts by query
      const filtered = posts.filter(post => {
        const searchText = [
          post.post_id,
          post.instruction,
          post.type,
          post.variant_1,
          post.variant_2,
          post.variant_3,
          post.keywords
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchText.includes(query.toLowerCase());
      }).slice(0, 10);
      
      if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
      } else {
        searchResults.innerHTML = filtered.map(post => `
          <div class="search-result-item" data-post-id="${post.id}" data-status="${post.status}">
            <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(post.post_id)}</div>
            <div style="font-size: 12px; color: #666;">${escapeHtml((post.instruction || '').substring(0, 80))}...</div>
            <span class="chip status-${getStatusClass(post.status)}" style="margin-top: 4px;">${post.status || 'Pending'}</span>
          </div>
        `).join('');
        
        // Attach click handlers
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const postId = item.dataset.postId;
            const status = item.dataset.status;
            
            // Navigate to appropriate tab
            if (status === 'generated') {
              activateTab('content');
            } else if (status === 'Scheduled') {
              activateTab('timeline');
            } else if (status === 'rejected') {
              activateTab('bin');
            } else {
              activateTab('settings');
            }
            
            searchResults.classList.add('hidden');
            searchInput.value = '';
            
            // Scroll to post after tab loads
            setTimeout(() => {
              const card = document.querySelector(`[data-post-id="${postId}"]`);
              if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlight');
                setTimeout(() => card.classList.remove('highlight'), 2000);
              }
            }, 500);
          });
        });
      }
      
      searchResults.classList.remove('hidden');
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, 300);
  
  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });
  
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length >= 2) {
      searchResults.classList.remove('hidden');
    }
  });
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults.classList.add('hidden');
    }
  });
  
  // Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
};

// ============================================================
// PREVIEW MODAL
// ============================================================

window.showPreview = function(postId) {
  const modal = document.getElementById('previewModal');
  const previewText = document.getElementById('previewText');
  const previewImage = document.getElementById('previewImage');
  const previewId = document.getElementById('previewId');
  const previewType = document.getElementById('previewType');
  
  // Find post data
  const post = window.AppState.generatedPosts.find(p => p.id == postId);
  if (!post) return;
  
  const variantNum = post.selected_variant || 1;
  const variantText = post[`variant_${variantNum}`] || '';
  const imageNum = post.selected_image || 1;
  const imageUrl = post[`image_${imageNum}`] || '';
  
  previewText.textContent = variantText;
  previewImage.src = convertGoogleDriveUrl(imageUrl);
  previewImage.style.display = imageUrl ? '' : 'none';
  previewId.textContent = post.post_id;
  previewType.textContent = post.type || 'General';
  
  modal.showModal();
};

// Initialize preview modal close
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('previewModal');
  const closeBtn = document.getElementById('previewClose');
  
  closeBtn?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
});

// ============================================================
// KEYBOARD SHORTCUTS HELP
// ============================================================

window.showShortcutsHelp = function() {
  const modal = document.getElementById('shortcutsModal');
  modal?.showModal();
};

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('shortcutsModal');
  const closeBtn = document.getElementById('shortcutsClose');
  
  closeBtn?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
});

// ============================================================
// GENERATION PROGRESS
// ============================================================

window.showGenerationProgress = function(current, total, status) {
  const container = document.getElementById('generationProgress');
  const progressBar = document.getElementById('generationProgressBar');
  const statusText = document.getElementById('generationStatus');
  
  if (!container) return;
  
  container.classList.remove('hidden');
  
  const percent = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = `${percent}%`;
  statusText.textContent = status || `Processing ${current} of ${total} posts...`;
};

window.hideGenerationProgress = function() {
  const container = document.getElementById('generationProgress');
  if (container) container.classList.add('hidden');
};