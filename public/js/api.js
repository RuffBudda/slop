/**
 * API Helper
 * Handles all API calls to the backend
 */

// Track if we're already handling an auth redirect to prevent multiple toasts/redirects
let isHandlingAuthRedirect = false;
// Track if we're currently verifying auth status to prevent multiple simultaneous checks
let isVerifyingAuth = false;

const API = {
  /**
   * Base API call method
   */
  async call(endpoint, options = {}) {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = 10000,
      credentials = 'same-origin'
    } = options;
    
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      credentials
    };
    
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }
    
    // #region agent log
    if (endpoint === '/auth/login') {
      fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-before-fetch',message:'About to send login request',data:{endpoint:`/api${endpoint}`,method,hasBody:!!body,bodyKeys:body?Object.keys(body):[],bodyStringified:config.body?.substring(0,100),headers:Object.keys(config.headers)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    }
    // #endregion
    
    // Add timeout to fetch request
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(`/api${endpoint}`, {
        ...config,
        signal: controller.signal
      });
      
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-response',message:'Received response',data:{status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      
      // Parse response body - this is also an async operation that needs timeout protection
      const data = await response.json();
      
      // Clear timeout only after all async operations complete (fetch + json parsing)
      clearTimeout(timeoutId);
      timeoutId = null;
      
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-response-data',message:'Response data parsed',data:{hasError:!!data.error,error:data.error,hasUser:!!data.user,hasSuccess:!!data.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      
      if (!response.ok) {
        // Handle 401 (Unauthorized) globally - but verify session is actually invalid first
        if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/status' && endpoint !== '/auth/setup') {
          // Only handle redirect once to prevent multiple toasts/redirects
          if (!isHandlingAuthRedirect && !isVerifyingAuth) {
            isVerifyingAuth = true;
            
            // Verify session is actually invalid before clearing state
            // This prevents clearing state on transient errors
            try {
              // Don't catch errors here - let them propagate so we can distinguish
              // between actual auth failures and network errors
              const authStatus = await API.auth.status();
              
              // Only clear state if auth check confirms user is not authenticated
              if (!authStatus.authenticated) {
                isHandlingAuthRedirect = true;
                
                // Clear user state
                window.AppState = window.AppState || {};
                window.AppState.user = null;
                
                // Clear any cached data
                if (typeof clearCache === 'function') {
                  clearCache();
                }
                
                // Only redirect if not already on login/setup page
                const currentPath = window.location.pathname;
                if (!currentPath.includes('/login') && !currentPath.includes('/setup') && currentPath !== '/') {
                  // Show one toast and redirect
                  if (typeof showToast === 'function') {
                    showToast('Session expired. Please log in again.', 'bad');
                  }
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 1000);
                } else {
                  // Reset flag if we're already on login page
                  isHandlingAuthRedirect = false;
                }
              } else {
                // User is still authenticated - don't clear state
                // This was likely a transient error or race condition
                // Reset flag to allow future checks
                isVerifyingAuth = false;
                // Don't redirect or clear state, just throw the original error
              }
            } catch (authCheckError) {
              // If auth check fails (network error, etc.), don't assume session is invalid
              // Reset flag and throw original error without clearing state
              console.warn('Auth verification failed, treating as transient error:', authCheckError);
              isVerifyingAuth = false;
              // Don't clear state or redirect on network errors
              // Mark as verified (attempted) so content.js doesn't do redundant check
              const error = new Error(data.error || `HTTP ${response.status}`);
              error.verifiedAuthenticated = true; // Flag to indicate we attempted verification
              error.isNetworkError = true; // Additional flag to indicate this is a network error
              throw error;
            } finally {
              // Ensure flag is reset if we didn't handle redirect
              if (!isHandlingAuthRedirect) {
                isVerifyingAuth = false;
              }
            }
          } else if (isHandlingAuthRedirect) {
            // Already handled redirect, just throw error
          }
          
          // Throw error to stop further processing
          throw new Error('Authentication required');
        }
        
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      // Always clear timeout in error cases
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-error',message:'API call error',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      
      // Handle timeout/abort errors
      if (error.name === 'AbortError') {
        console.error(`API Timeout (${endpoint}): Request took longer than ${timeout}ms`);
        throw new Error('Request timeout. Please check your connection and try again.');
      }
      
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },

  // ============================================================
  // AUTH ENDPOINTS
  // ============================================================
  
  auth: {
    async status() {
      return API.call('/auth/status');
    },
    
    async setup(data) {
      return API.call('/auth/setup', { method: 'POST', body: data });
    },
    
    async login(username, password) {
      return API.call('/auth/login', { method: 'POST', body: { username, password } });
    },
    
    async logout() {
      return API.call('/auth/logout', { method: 'POST' });
    },
    
    async register(data) {
      return API.call('/auth/register', { method: 'POST', body: data });
    }
  },

  // ============================================================
  // POSTS ENDPOINTS
  // ============================================================
  
  posts: {
    async list(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.call(`/posts${query ? '?' + query : ''}`);
    },
    
    async get(id) {
      return API.call(`/posts/${id}`);
    },
    
    async create(data) {
      return API.call('/posts', { method: 'POST', body: data });
    },
    
    async update(id, data) {
      return API.call(`/posts/${id}`, { method: 'PUT', body: data });
    },
    
    async delete(id) {
      return API.call(`/posts/${id}`, { method: 'DELETE' });
    },
    
    async updateStatus(id, status) {
      return API.call(`/posts/${id}/status`, { method: 'PUT', body: { status } });
    },
    
    async updateChoices(id, data) {
      return API.call(`/posts/${id}/choices`, { method: 'PUT', body: data });
    },
    
    async updateVariant(id, data) {
      return API.call(`/posts/${id}/variant`, { method: 'PUT', body: data });
    },
    
    async reschedule(id, scheduledDate) {
      return API.call(`/posts/${id}/reschedule`, { method: 'PUT', body: { scheduled_date: scheduledDate } });
    },
    
    async restore(id) {
      return API.call(`/posts/${id}/restore`, { method: 'PUT' });
    },
    
    async bulkCreate(posts) {
      return API.call('/posts/bulk', { method: 'POST', body: { posts } });
    },
    
    async bulkUpdate(updates) {
      return API.call('/posts/bulk', { method: 'PUT', body: { updates } });
    },
    
    async bulkDelete(ids) {
      return API.call('/posts/bulk', { method: 'DELETE', body: { ids } });
    },
    
    async getByStatus(status, page = 1, limit = 50) {
      return this.list({ status, page, limit });
    },
    
    async getGenerated() {
      return API.call('/posts/content');
    },
    
    async getScheduled() {
      return this.getByStatus('Scheduled');
    },
    
    async getRejected() {
      return this.getByStatus('rejected');
    },
    
    async getPending() {
      return this.getByStatus('null');
    }
  },

  // ============================================================
  // SETTINGS ENDPOINTS
  // ============================================================
  
  settings: {
    async get(keys) {
      const query = Array.isArray(keys) ? keys.join(',') : keys;
      return API.call(`/settings?keys=${encodeURIComponent(query)}`);
    },
    
    async getAll() {
      return API.call('/settings');
    },
    
    async set(key, value) {
      return API.call(`/settings/${key}`, { method: 'PUT', body: { value } });
    },
    
    async setBulk(settings) {
      return API.call('/settings', { method: 'PUT', body: { settings } });
    },
    
    async test(service) {
      return API.call(`/settings/test/${service}`, { method: 'POST' });
    },
    
    async changePassword(data) {
      return API.call('/settings/password', { method: 'PUT', body: data });
    },
    
    // Prompts management
    async getPrompts() {
      return API.call('/settings/prompts');
    },
    
    async getPrompt(key) {
      return API.call(`/settings/prompts/${key}`);
    },
    
    async updatePrompt(key, value) {
      return API.call(`/settings/prompts/${key}`, { method: 'PUT', body: { value } });
    },
    
    async resetPrompt(key) {
      return API.call(`/settings/prompts/${key}`, { method: 'DELETE' });
    }
  },

  // ============================================================
  // WORKFLOW ENDPOINTS
  // ============================================================
  
  workflow: {
    async generate(count = 10) {
      return API.call('/workflow/generate', { method: 'POST', body: { count } });
    },
    
    async status() {
      return API.call('/workflow/status');
    },
    
    async queue(count = 10) {
      return API.call('/workflow/queue', { method: 'POST', body: { count } });
    },
    
    async session(id) {
      return API.call(`/workflow/session/${id}`);
    },
    
    async stats() {
      return API.call('/workflow/stats');
    },
    
    async uploadImage(file, postId) {
      const formData = new FormData();
      formData.append('image', file);
      if (postId) formData.append('postId', postId);
      
      const response = await fetch('/api/workflow/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    }
  },

  // ============================================================
  // USER MANAGEMENT ENDPOINTS
  // ============================================================
  
  users: {
    async list() {
      return API.call('/users');
    },
    
    async get(id) {
      return API.call(`/users/${id}`);
    },
    
    async create(data) {
      return API.call('/users', { method: 'POST', body: data });
    },
    
    async update(id, data) {
      return API.call(`/users/${id}`, { method: 'PUT', body: data });
    },
    
    async delete(id) {
      return API.call(`/users/${id}`, { method: 'DELETE' });
    }
  },

  // ============================================================
  // GOOGLE DRIVE ENDPOINTS
  // ============================================================
  
  googleDrive: {
    async getAuthUrl() {
      return API.call('/google-drive/auth-url');
    },
    
    async getStatus() {
      return API.call('/google-drive/status');
    },
    
    async disconnect() {
      return API.call('/google-drive/disconnect', { method: 'DELETE' });
    },
    
    async listFiles(folderId = null, query = '') {
      const params = new URLSearchParams();
      if (folderId) params.append('folderId', folderId);
      if (query) params.append('query', query);
      return API.call(`/google-drive/files?${params.toString()}`);
    },
    
    async listFolders(parentId = null) {
      const params = new URLSearchParams();
      if (parentId) params.append('parentId', parentId);
      return API.call(`/google-drive/folders?${params.toString()}`);
    },
    
    async getFile(fileId) {
      return API.call(`/google-drive/file/${fileId}`);
    },
    
    async getFolder(folderId) {
      return API.call(`/google-drive/folder/${folderId}`);
    },
    
    async extractFolderId(link) {
      return API.call('/google-drive/extract-folder-id', {
        method: 'POST',
        body: { link }
      });
    },
    
    async downloadFile(fileId) {
      const response = await fetch(`/api/google-drive/download/${fileId}`, {
        credentials: 'same-origin'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Download failed');
      }
      return response.blob();
    },
    
    async uploadFile(fileBuffer, fileName, folderId = null, mimeType = 'image/png') {
      const params = new URLSearchParams();
      params.append('fileName', fileName);
      if (folderId) params.append('folderId', folderId);
      params.append('mimeType', mimeType);
      
      const response = await fetch(`/api/google-drive/upload?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType
        },
        body: fileBuffer,
        credentials: 'same-origin'
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data;
    }
  },
  
  // ============================================================
  // WORKFLOW ENDPOINTS
  // ============================================================
  
  workflow: {
    async getStats() {
      return API.call('/workflow/stats');
    }
  }
};

// Make API globally available
window.API = API;