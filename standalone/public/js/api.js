/**
 * API Helper
 * Handles all API calls to the backend
 */

const API = {
  /**
   * Base API call method
   */
  async call(endpoint, options = {}) {
    const { method = 'GET', body, headers = {} } = options;
    
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      credentials: 'same-origin'
    };
    
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }
    
    // #region agent log
    if (endpoint === '/auth/login') {
      fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-before-fetch',message:'About to send login request',data:{endpoint:`/api${endpoint}`,method,hasBody:!!body,bodyKeys:body?Object.keys(body):[],bodyStringified:config.body?.substring(0,100),headers:Object.keys(config.headers)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    }
    // #endregion
    
    try {
      const response = await fetch(`/api${endpoint}`, config);
      
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-response',message:'Received response',data:{status:response.status,statusText:response.statusText,ok:response.ok,contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      
      const data = await response.json();
      
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-response-data',message:'Response data parsed',data:{hasError:!!data.error,error:data.error,hasUser:!!data.user,hasSuccess:!!data.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      // #region agent log
      if (endpoint === '/auth/login') {
        fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:call-error',message:'API call error',data:{errorMessage:error.message,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion
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
    
    // Profile management
    async getProfile() {
      return API.call('/settings/profile');
    },
    
    async updateProfile(data) {
      return API.call('/settings/profile', { method: 'PUT', body: data });
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
  }
};

// Make API globally available
window.API = API;
