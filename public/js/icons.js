/**
 * Flaticon Icon System
 * Centralized icon library using Flaticon CDN
 */

// Flaticon icon class mappings
const FLATICON_ICONS = {
  // Password visibility
  eye: 'fi fi-rr-eye',
  eyeSlash: 'fi fi-rr-eye-crossed',
  
  // Navigation
  content: 'fi fi-rr-document',
  calendar: 'fi fi-rr-calendar',
  list: 'fi fi-rr-list',
  bin: 'fi fi-rr-trash',
  settings: 'fi fi-rr-settings',
  
  // UI elements
  check: 'fi fi-rr-check',
  close: 'fi fi-rr-cross',
  warning: 'fi fi-rr-exclamation-triangle',
  copy: 'fi fi-rr-copy',
  folder: 'fi fi-rr-folder',
  lightning: 'fi fi-rr-bolt',
  search: 'fi fi-rr-search',
  
  // Settings tiles
  account: 'fi fi-rr-user',
  openai: 'fi fi-rr-brain',
  googledrive: 'fi fi-rr-cloud',
  linkedin: 'fi fi-rr-linkedin',
  storage: 'fi fi-rr-database',
  ai: 'fi fi-rr-robot',
  contentManagement: 'fi fi-rr-file-edit',
  calculator: 'fi fi-rr-calculator',
  admin: 'fi fi-rr-shield-check',
  
  // Status
  processing: 'fi fi-rr-spinner',
  success: 'fi fi-rr-check-circle',
  error: 'fi fi-rr-exclamation-circle',
  
  // Other
  back: 'fi fi-rr-arrow-left',
  add: 'fi fi-rr-plus',
  edit: 'fi fi-rr-edit',
  view: 'fi fi-rr-eye',
  delete: 'fi fi-rr-trash',
  disconnect: 'fi fi-rr-unlink',
  save: 'fi fi-rr-disk',
  import: 'fi fi-rr-import',
  export: 'fi fi-rr-export',
  refresh: 'fi fi-rr-refresh',
  clear: 'fi fi-rr-trash-xmark',
};

/**
 * Get Flaticon icon HTML
 * @param {string} name - Icon name
 * @param {string} className - Optional CSS class name
 * @param {object} options - Optional settings (size, color)
 * @returns {string} HTML string with Flaticon icon
 */
function getIcon(name, className = '', options = {}) {
  const iconClass = FLATICON_ICONS[name];
  if (!iconClass) {
    console.warn(`Icon "${name}" not found`);
    return '';
  }
  
  const size = options.size || '1em';
  const color = options.color || 'currentColor';
  const additionalClasses = className ? ` ${className}` : '';
  
  return `<i class="${iconClass}${additionalClasses}" style="font-size: ${size}; color: ${color};"></i>`;
}

/**
 * Render icon as HTML element
 * @param {string} name - Icon name
 * @param {object} options - Optional settings
 * @returns {HTMLElement} Icon element
 */
function renderIcon(name, options = {}) {
  const div = document.createElement('div');
  div.innerHTML = getIcon(name, options.className || '', options);
  return div.firstElementChild;
}

/**
 * Initialize navigation icons
 */
function initNavigationIcons() {
  const iconMap = {
    navIconContent: 'content',
    navIconCalendar: 'calendar',
    navIconList: 'list',
    navIconBin: 'bin',
    navIconSettings: 'settings'
  };
  
  Object.keys(iconMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = getIcon(iconMap[id], 'nav-icon-flaticon');
    }
  });
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Icons = {
    get: getIcon,
    render: renderIcon,
    init: function(retryCount = 0) {
      const MAX_RETRIES = 20; // Increased retries for slower connections
      
      // Check if Flaticon CSS is loaded by checking if a Flaticon class exists in stylesheets
      let flaticonLoaded = false;
      try {
        const flaticonLink = document.querySelector('link[href*="flaticon"]');
        if (flaticonLink) {
          // Check if stylesheet is loaded by trying to compute style
          const testEl = document.createElement('i');
          testEl.className = 'fi fi-rr-eye';
          document.body.appendChild(testEl);
          const computed = window.getComputedStyle(testEl);
          flaticonLoaded = computed.fontFamily && computed.fontFamily.includes('Flaticon') || 
                          computed.getPropertyValue('--flaticon-loaded') !== '';
          document.body.removeChild(testEl);
        }
      } catch (e) {
        // If check fails, assume not loaded yet
      }
      
      if (!flaticonLoaded && retryCount < MAX_RETRIES) {
        setTimeout(() => this.init(retryCount + 1), 150);
        return;
      }
      
      if (retryCount >= MAX_RETRIES) {
        console.warn('Flaticon CSS may not be loaded. Icons may not display correctly.');
      }
      
      // Initialize navigation icons
      initNavigationIcons();
      
      // Initialize search icon
      const searchIcon = document.querySelector('.search-icon');
      if (searchIcon) {
        if (!searchIcon.innerHTML.trim() || !searchIcon.querySelector('.fi')) {
          searchIcon.innerHTML = this.get('search', 'search-icon-flaticon', { size: '14px' });
        }
      }
      
      // Replace all elements with data-icon attribute
      document.querySelectorAll('[data-icon]').forEach(el => {
        const iconName = el.dataset.icon;
        const className = el.dataset.iconClass || '';
        const size = el.dataset.iconSize;
        const color = el.dataset.iconColor;
        const iconHtml = this.get(iconName, className, { size, color });
        if (iconHtml) {
          el.innerHTML = iconHtml;
        }
      });
      
      // Initialize password toggle icons
      document.querySelectorAll('.password-toggle').forEach(toggle => {
        if (!toggle.innerHTML.trim() || !toggle.querySelector('.fi')) {
          toggle.innerHTML = this.get('eye', 'password-toggle-icon');
        }
      });
      
      // Initialize button icons with .ico class
      document.querySelectorAll('.btn .ico, .btn span.ico').forEach(ico => {
        if (!ico.innerHTML.trim() && ico.parentElement) {
          const btn = ico.closest('.btn');
          if (btn && btn.classList.contains('approve')) {
            ico.innerHTML = this.get('check', '', { size: '14px' });
          } else if (btn && btn.classList.contains('reject')) {
            ico.innerHTML = this.get('close', '', { size: '14px' });
          }
        }
      });
      
      // Initialize settings tile icons if on settings page
      if (typeof populateSettingsTileIcons === 'function') {
        populateSettingsTileIcons();
      }
    },
    FLATICON_ICONS
  };
}
