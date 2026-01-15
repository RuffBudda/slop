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
  stability: 'fi fi-rr-image', // Image generation icon for Stability AI
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
  logout: 'fi fi-rr-sign-out',
  menu: 'fi fi-rr-menu-dots-vertical',
  grid: 'fi fi-rr-grid',
};

// Font Awesome fallback icon mappings
const FONT_AWESOME_ICONS = {
  // Password visibility
  eye: 'fa-solid fa-eye',
  eyeSlash: 'fa-solid fa-eye-slash',
  
  // Navigation
  content: 'fa-solid fa-file-lines',
  calendar: 'fa-solid fa-calendar',
  list: 'fa-solid fa-list',
  bin: 'fa-solid fa-trash',
  settings: 'fa-solid fa-gear',
  
  // UI elements
  check: 'fa-solid fa-check',
  close: 'fa-solid fa-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  copy: 'fa-solid fa-copy',
  folder: 'fa-solid fa-folder',
  lightning: 'fa-solid fa-bolt',
  search: 'fa-solid fa-magnifying-glass',
  
  // Settings tiles
  account: 'fa-solid fa-user',
  openai: 'fa-solid fa-brain',
  googledrive: 'fa-solid fa-cloud',
  linkedin: 'fa-brands fa-linkedin',
  storage: 'fa-solid fa-database',
  ai: 'fa-solid fa-robot',
  stability: 'fa-solid fa-image', // Image generation icon for Stability AI
  contentManagement: 'fa-solid fa-file-pen',
  calculator: 'fa-solid fa-calculator',
  admin: 'fa-solid fa-shield-halved',
  
  // Status
  processing: 'fa-solid fa-spinner fa-spin',
  success: 'fa-solid fa-circle-check',
  error: 'fa-solid fa-circle-exclamation',
  
  // Other
  back: 'fa-solid fa-arrow-left',
  add: 'fa-solid fa-plus',
  edit: 'fa-solid fa-pen',
  view: 'fa-solid fa-eye',
  delete: 'fa-solid fa-trash',
  disconnect: 'fa-solid fa-link-slash',
  save: 'fa-solid fa-floppy-disk',
  import: 'fa-solid fa-file-import',
  export: 'fa-solid fa-file-export',
  refresh: 'fa-solid fa-arrow-rotate-right',
  clear: 'fa-solid fa-trash-can',
  logout: 'fa-solid fa-right-from-bracket',
  menu: 'fa-solid fa-ellipsis-vertical',
  grid: 'fa-solid fa-grid-2',
};

/**
 * Check if Flaticon is loaded
 * @returns {boolean} True if Flaticon CSS is loaded
 */
function isFlaticonLoaded() {
  try {
    const testEl = document.createElement('i');
    testEl.className = 'fi fi-rr-eye';
    testEl.style.position = 'absolute';
    testEl.style.visibility = 'hidden';
    document.body.appendChild(testEl);
    const computed = window.getComputedStyle(testEl);
    const isLoaded = computed.fontFamily && computed.fontFamily.includes('Flaticon');
    document.body.removeChild(testEl);
    return isLoaded;
  } catch (e) {
    return false;
  }
}

/**
 * Check if Font Awesome is loaded
 * @returns {boolean} True if Font Awesome CSS is loaded
 */
function isFontAwesomeLoaded() {
  try {
    const testEl = document.createElement('i');
    testEl.className = 'fa-solid fa-eye';
    testEl.style.position = 'absolute';
    testEl.style.visibility = 'hidden';
    document.body.appendChild(testEl);
    const computed = window.getComputedStyle(testEl);
    const isLoaded = computed.fontFamily && (computed.fontFamily.includes('Font Awesome') || computed.fontFamily.includes('FontAwesome'));
    document.body.removeChild(testEl);
    return isLoaded;
  } catch (e) {
    return false;
  }
}

/**
 * Get icon HTML with Flaticon fallback to Font Awesome
 * @param {string} name - Icon name
 * @param {string} className - Optional CSS class name
 * @param {object} options - Optional settings (size, color)
 * @returns {string} HTML string with icon
 */
function getIcon(name, className = '', options = {}) {
  const size = options.size || '1em';
  const color = options.color || 'currentColor';
  const additionalClasses = className ? ` ${className}` : '';
  const style = `font-size: ${size}; color: ${color};`;
  
  // Try Flaticon first
  const flaticonClass = FLATICON_ICONS[name];
  if (flaticonClass && isFlaticonLoaded()) {
    return `<i class="${flaticonClass}${additionalClasses}" style="${style}"></i>`;
  }
  
  // Fallback to Font Awesome
  const fontAwesomeClass = FONT_AWESOME_ICONS[name];
  if (fontAwesomeClass && isFontAwesomeLoaded()) {
    return `<i class="${fontAwesomeClass}${additionalClasses}" style="${style}"></i>`;
  }
  
  // If neither is available, try Flaticon anyway (might load later)
  if (flaticonClass) {
    return `<i class="${flaticonClass}${additionalClasses}" style="${style}"></i>`;
  }
  
  // Last resort: try Font Awesome
  if (fontAwesomeClass) {
    return `<i class="${fontAwesomeClass}${additionalClasses}" style="${style}"></i>`;
  }
  
  console.warn(`Icon "${name}" not found in Flaticon or Font Awesome`);
  return '';
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
    navIconSettings: 'settings',
    navIconLogout: 'logout',
    navIconSearch: 'search'
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
      
      // Check if Flaticon or Font Awesome CSS is loaded
      const flaticonLoaded = isFlaticonLoaded();
      const fontAwesomeLoaded = isFontAwesomeLoaded();
      
      if (!flaticonLoaded && !fontAwesomeLoaded && retryCount < MAX_RETRIES) {
        setTimeout(() => this.init(retryCount + 1), 150);
        return;
      }
      
      if (retryCount >= MAX_RETRIES && !flaticonLoaded && !fontAwesomeLoaded) {
        console.warn('Neither Flaticon nor Font Awesome CSS loaded. Icons may not display correctly.');
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
      
      // Initialize search modal icon
      const searchModalIcon = document.querySelector('.search-modal-icon');
      if (searchModalIcon) {
        if (!searchModalIcon.innerHTML.trim() || (!searchModalIcon.querySelector('.fi') && !searchModalIcon.querySelector('.fa'))) {
          searchModalIcon.innerHTML = this.get('search', '', { size: '18px' });
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
        if (!toggle.innerHTML.trim() || (!toggle.querySelector('.fi') && !toggle.querySelector('.fa'))) {
          toggle.innerHTML = this.get('eye', 'password-toggle-icon');
        }
      });
      
      // Initialize FAB icon
      const fabIcon = document.querySelector('.fab-icon');
      if (fabIcon && (!fabIcon.innerHTML.trim() || (!fabIcon.querySelector('.fi') && !fabIcon.querySelector('.fa')))) {
        fabIcon.innerHTML = this.get('lightning', '', { size: '24px' });
      }
      
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
      
      // Initialize AI service icons if on AI configuration page
      if (typeof populateAIServiceIcons === 'function') {
        populateAIServiceIcons();
      }
    },
    FLATICON_ICONS,
    FONT_AWESOME_ICONS
  };
}
