/**
 * Settings Tab Module
 * Handles API key configuration and sheet management
 */

// ============================================================
// SETTINGS LOADING
// ============================================================

async function loadSettings() {
  try {
    // Load API settings
    await loadApiSettings();
    
    // Load prompts settings
    await loadPrompts();
    
    // Load Stability AI settings
    await loadStabilitySettings();
    
    // Load Google Drive status
    await loadGoogleDriveStatus();
    
    // Load Google Drive folder selection
    await loadGoogleDriveFolder();
    
    // Load posts for sheet view
    await loadSheetData();
    
    // Load users (admin only) - but don't show sections here, let showSection handle it
    if (window.AppState.user?.role === 'admin') {
      await loadUsers();
    }
    
    // Initialize tiles and password toggles when settings tab is activated
    initSettingsTiles();
    initPasswordVisibilityToggles();
    
    // Calculator should NOT be initialized here - only when environmental tile is clicked
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('Failed to load settings', 'bad');
  }
}


function initPasswordForm() {
  const form = document.getElementById('passwordForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required', 'bad');
      return;
    }
    
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'bad');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'bad');
      return;
    }
    
    try {
      showLoader();
      await API.settings.changePassword({ currentPassword, newPassword });
      showToast('Password changed successfully', 'ok');
      form.reset();
    } catch (error) {
      showToast(error.message || 'Failed to change password', 'bad');
    } finally {
      hideLoader();
    }
  });
}

// ============================================================
// API SETTINGS
// ============================================================

async function loadApiSettings() {
  try {
    const result = await API.settings.get([
      'openai_api_key',
      'stability_api_key',
      'spaces_name',
      'spaces_region',
      'spaces_key',
      'spaces_secret'
    ]);
    
    const settings = result.settings || {};
    
    // Populate form (show masked values for secrets)
    const form = document.getElementById('apiSettingsForm');
    if (!form) return;
    
    // For API keys, show placeholder if set
    if (settings.openai_api_key) {
      form.openai_api_key.placeholder = '••••••••••••••••';
    }
    if (settings.stability_api_key) {
      form.stability_api_key.placeholder = '••••••••••••••••';
    }
    if (settings.spaces_key) {
      form.spaces_key.placeholder = '••••••••••••••••';
    }
    if (settings.spaces_secret) {
      form.spaces_secret.placeholder = '••••••••••••••••';
    }
    
    // Set non-secret values
    if (settings.spaces_name) {
      form.spaces_name.value = settings.spaces_name;
    }
    if (settings.spaces_region) {
      form.spaces_region.value = settings.spaces_region;
    }
  } catch (error) {
    console.error('Failed to load API settings:', error);
  }
}

function initApiSettingsForm() {
  const form = document.getElementById('apiSettingsForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const settings = [];
    
    // Only include non-empty values (don't override with empty)
    for (const [key, value] of formData.entries()) {
      if (value.trim()) {
        settings.push({ key, value: value.trim() });
      }
    }
    
    if (settings.length === 0) {
      showToast('No settings to save', 'neutral');
      return;
    }
    
    try {
      showLoader();
      await API.settings.setBulk(settings);
      showToast('Settings saved successfully', 'ok');
      
      // Reload to show updated placeholders
      loadApiSettings();
    } catch (error) {
      showToast('Failed to save settings', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Test buttons
  form.querySelectorAll('[data-test]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const service = e.currentTarget.dataset.test;
      
      try {
        showLoader();
        const result = await API.settings.test(service);
        
        if (result.success) {
          showToast(`${service} connection successful`, 'ok');
        } else {
          showToast(`${service} test failed: ${result.error}`, 'bad');
        }
      } catch (error) {
        showToast(`${service} test failed: ${error.message}`, 'bad');
      } finally {
        hideLoader();
      }
    });
  });
}

// ============================================================
// PROMPTS MANAGEMENT
// ============================================================

async function loadPrompts() {
  const form = document.getElementById('promptsSettingsForm');
  if (!form) return;
  
  try {
    const result = await API.settings.getPrompts();
    const prompts = result.prompts || {};
    
    // Populate all prompt fields
    const fields = {
      'systemPrompt': 'content_system_prompt',
      'userTemplatePrompt': 'content_user_template',
      'imageStylePrefix': 'image_style_prefix',
      'imageStyleSuffix': 'image_style_suffix'
    };
    
    for (const [fieldId, promptKey] of Object.entries(fields)) {
      const field = document.getElementById(fieldId);
      if (field && prompts[promptKey]) {
        field.value = prompts[promptKey].value || '';
        if (field.tagName === 'TEXTAREA') {
          autoResizeTextarea.call(field);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load prompts:', error);
    showToast('Failed to load prompts', 'bad');
  }
}

async function loadStabilitySettings() {
  const form = document.getElementById('stabilitySettingsForm');
  if (!form) return;
  
  try {
    const result = await API.settings.getPrompts();
    const prompts = result.prompts || {};
    
    // Load Stability AI settings
    if (prompts.stability_aspect_ratio) {
      const field = document.getElementById('stabilityAspectRatio');
      if (field) field.value = prompts.stability_aspect_ratio.value || '1:1';
    }
    
    if (prompts.stability_model) {
      const field = document.getElementById('stabilityModel');
      if (field) field.value = prompts.stability_model.value || 'sd3-large-turbo';
    }
    
    if (prompts.stability_output_format) {
      const field = document.getElementById('stabilityOutputFormat');
      if (field) field.value = prompts.stability_output_format.value || 'png';
    }
    
    if (prompts.stability_negative_prompt) {
      const field = document.getElementById('stabilityNegativePrompt');
      if (field) field.value = prompts.stability_negative_prompt.value || '';
    }
    
    if (prompts.stability_seed) {
      const field = document.getElementById('stabilitySeed');
      if (field) field.value = prompts.stability_seed.value || '';
    }
    
    if (prompts.stability_steps) {
      const field = document.getElementById('stabilitySteps');
      if (field) field.value = prompts.stability_steps.value || '';
    }
    
    if (prompts.stability_cfg_scale) {
      const field = document.getElementById('stabilityCfgScale');
      if (field) field.value = prompts.stability_cfg_scale.value || '';
    }
  } catch (error) {
    console.error('Failed to load Stability settings:', error);
  }
}

async function loadGoogleDriveStatus() {
  try {
    const result = await API.googleDrive.getStatus();
    const isConnected = result.connected || false;
    const connectionType = result.connectionType || null;
    
    const statusText = document.getElementById('googleDriveStatusText');
    const connectionTypeText = document.getElementById('googleDriveConnectionType');
    const connectBtn = document.getElementById('btnConnectGoogleDrive');
    const disconnectBtn = document.getElementById('btnDisconnectGoogleDrive');
    
    if (statusText) {
      statusText.innerHTML = isConnected 
        ? (window.Icons ? window.Icons.get('success', '', { size: '14px' }) : '✓') + ' Google Drive is connected' 
        : 'Google Drive is not connected';
    }
    
    if (connectionTypeText) {
      if (isConnected && connectionType) {
        const typeLabel = connectionType === 'service_account' 
          ? 'Service Account Key' 
          : 'OAuth';
        connectionTypeText.textContent = `Connection method: ${typeLabel}`;
        connectionTypeText.style.color = '#4ade80';
      } else {
        connectionTypeText.textContent = '';
      }
    }
    
    if (connectBtn) {
      connectBtn.style.display = isConnected ? 'none' : 'inline-flex';
    }
    
    if (disconnectBtn) {
      disconnectBtn.style.display = isConnected ? 'inline-flex' : 'none';
    }
  } catch (error) {
    console.error('Failed to load Google Drive status:', error);
    const statusText = document.getElementById('googleDriveStatusText');
    if (statusText) {
      statusText.textContent = 'Failed to check Google Drive status';
    }
  }
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 400) + 'px';
}

function initPromptsSection() {
  const form = document.getElementById('promptsSettingsForm');
  if (!form) return;
  
  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const prompts = {
      'content_system_prompt': document.getElementById('systemPrompt')?.value.trim(),
      'content_user_template': document.getElementById('userTemplatePrompt')?.value.trim(),
      'image_style_prefix': document.getElementById('imageStylePrefix')?.value.trim(),
      'image_style_suffix': document.getElementById('imageStyleSuffix')?.value.trim()
    };
    
    try {
      showLoader();
      
      // Save all prompts
      for (const [key, value] of Object.entries(prompts)) {
        if (value !== undefined && value !== null) {
          await API.settings.updatePrompt(key, value);
        }
      }
      
      showToast('Prompts saved successfully', 'ok');
    } catch (error) {
      showToast(error.message || 'Failed to save prompts', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Reset prompts button
  const resetBtn = document.getElementById('btnResetPrompts');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset all prompts to their default values? Your custom changes will be lost.')) {
        return;
      }
      
      try {
        showLoader();
        const promptKeys = ['content_system_prompt', 'content_user_template', 'image_style_prefix', 'image_style_suffix'];
        for (const key of promptKeys) {
          await API.settings.resetPrompt(key);
        }
        await loadPrompts();
        showToast('Prompts reset to defaults', 'ok');
      } catch (error) {
        showToast('Failed to reset prompts', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  // Auto-resize textareas on input
  form.querySelectorAll('.prompt-textarea').forEach(textarea => {
    textarea.addEventListener('input', function() {
      autoResizeTextarea.call(this);
    });
  });
}

function initStabilitySettings() {
  const form = document.getElementById('stabilitySettingsForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const settings = {
      'stability_aspect_ratio': form.stability_aspect_ratio?.value || '',
      'stability_model': form.stability_model?.value || '',
      'stability_output_format': form.stability_output_format?.value || '',
      'stability_negative_prompt': form.stability_negative_prompt?.value.trim() || '',
      'stability_seed': form.stability_seed?.value.trim() || '',
      'stability_steps': form.stability_steps?.value.trim() || '',
      'stability_cfg_scale': form.stability_cfg_scale?.value.trim() || ''
    };
    
    try {
      showLoader();
      
      // Save all Stability settings as prompts
      for (const [key, value] of Object.entries(settings)) {
        await API.settings.updatePrompt(key, value);
      }
      
      showToast('Stability AI settings saved successfully', 'ok');
    } catch (error) {
      showToast(error.message || 'Failed to save settings', 'bad');
    } finally {
      hideLoader();
    }
  });
}

async function loadGoogleDriveFolder() {
  try {
    const result = await API.settings.get(['google_drive_folder_id', 'google_drive_folder_name']);
    const settings = result.settings || {};
    
    const folderLinkInput = document.getElementById('googleDriveFolderLink');
    const folderStatus = document.getElementById('googleDriveFolderStatus');
    
    if (settings.google_drive_folder_id) {
      const folderId = settings.google_drive_folder_id;
      const folderName = settings.google_drive_folder_name || 'Selected folder';
      
      if (folderLinkInput) {
        folderLinkInput.value = folderId;
      }
      
      if (folderStatus) {
        folderStatus.textContent = `Selected: ${folderName} (${folderId})`;
        folderStatus.style.color = '#4ade80';
      }
    } else {
      if (folderLinkInput) {
        folderLinkInput.value = '';
      }
      if (folderStatus) {
        folderStatus.textContent = 'No folder selected. Images will be fetched from all folders.';
        folderStatus.style.color = '#666';
      }
    }
  } catch (error) {
    console.error('Failed to load Google Drive folder:', error);
  }
}

let selectedFolderId = null;
let selectedFolderName = null;
let currentFolderPath = [{ id: 'root', name: 'Root' }];

async function loadFoldersForBrowser(parentId = null) {
  const folderList = document.getElementById('folderBrowserList');
  if (!folderList) return;
  
  try {
    folderList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Loading folders...</p>';
    
    const result = await API.googleDrive.listFolders(parentId);
    const folders = result.folders || [];
    
    if (folders.length === 0) {
      folderList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No folders found in this location.</p>';
      return;
    }
    
    folderList.innerHTML = folders.map(folder => `
      <div class="folder-item" style="padding: 12px; border-bottom: 1px solid var(--bd); cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;"
           data-folder-id="${folder.id}" data-folder-name="${escapeHtml(folder.name)}">
        <span class="folder-icon-large">${window.Icons ? window.Icons.get('folder', '', { size: '20px' }) : '📁'}</span>
        <div style="flex: 1;">
          <div style="font-weight: 500;">${escapeHtml(folder.name)}</div>
          <div style="font-size: 12px; color: #666;">ID: ${folder.id}</div>
        </div>
        <button class="btn-link" style="text-decoration: none; color: var(--fg);" 
                onclick="event.stopPropagation(); navigateToFolder('${folder.id}', '${escapeHtml(folder.name)}');">
          Open →
        </button>
      </div>
    `).join('');
    
    // Add click handlers
    folderList.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        const folderId = this.dataset.folderId;
        const folderName = this.dataset.folderName;
        selectFolderInBrowser(folderId, folderName);
      });
    });
    
  } catch (error) {
    console.error('Failed to load folders:', error);
    folderList.innerHTML = `<p style="text-align: center; color: #dc2626; padding: 20px;">Failed to load folders: ${error.message}</p>`;
  }
}

function navigateToFolder(folderId, folderName) {
  currentFolderPath.push({ id: folderId, name: folderName });
  updateBreadcrumb();
  loadFoldersForBrowser(folderId);
}

function updateBreadcrumb() {
  const breadcrumb = document.getElementById('folderBrowserBreadcrumb');
  if (!breadcrumb) return;
  
  breadcrumb.innerHTML = currentFolderPath.map((folder, index) => {
    if (index === currentFolderPath.length - 1) {
      return `<span style="color: var(--fg); font-weight: 500;">${escapeHtml(folder.name)}</span>`;
    }
    return `<button class="btn-link" onclick="navigateToBreadcrumb(${index});" style="text-decoration: none; color: var(--fg);">${escapeHtml(folder.name)}</button> <span style="color: #666;">/</span> `;
  }).join('');
}

function navigateToBreadcrumb(index) {
  currentFolderPath = currentFolderPath.slice(0, index + 1);
  const targetFolder = currentFolderPath[currentFolderPath.length - 1];
  updateBreadcrumb();
  loadFoldersForBrowser(targetFolder.id === 'root' ? null : targetFolder.id);
}

function selectFolderInBrowser(folderId, folderName) {
  selectedFolderId = folderId;
  selectedFolderName = folderName;
  
  // Highlight selected folder
  document.querySelectorAll('.folder-item').forEach(item => {
    item.style.background = item.dataset.folderId === folderId ? 'var(--bg-alt)' : 'transparent';
  });
  
  // Enable select button
  const selectBtn = document.getElementById('folderBrowserSelect');
  if (selectBtn) {
    selectBtn.disabled = false;
    selectBtn.textContent = `Select: ${folderName}`;
  }
}

function initGoogleDrive() {
  const connectBtn = document.getElementById('btnConnectGoogleDrive');
  const disconnectBtn = document.getElementById('btnDisconnectGoogleDrive');
  const serviceAccountForm = document.getElementById('serviceAccountForm');
  const folderForm = document.getElementById('googleDriveFolderForm');
  const browseBtn = document.getElementById('btnBrowseFolders');
  const clearFolderBtn = document.getElementById('btnClearFolder');
  const folderBrowserModal = document.getElementById('folderBrowserModal');
  const folderBrowserClose = document.getElementById('folderBrowserClose');
  const folderBrowserCancel = document.getElementById('folderBrowserCancel');
  const folderBrowserSelect = document.getElementById('folderBrowserSelect');
  
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      try {
        showLoader();
        const result = await API.googleDrive.getAuthUrl();
        // Redirect to Google OAuth
        window.location.href = result.authUrl;
      } catch (error) {
        showToast(error.message || 'Failed to get authorization URL', 'bad');
        hideLoader();
      }
    });
  }
  
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to disconnect Google Drive?')) {
        return;
      }
      
      try {
        showLoader();
        await API.googleDrive.disconnect();
        await loadGoogleDriveStatus();
        showToast('Google Drive disconnected', 'ok');
      } catch (error) {
        showToast(error.message || 'Failed to disconnect', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  if (serviceAccountForm) {
    serviceAccountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('serviceAccountFile');
      const jsonTextarea = document.getElementById('serviceAccountJson');
      
      let serviceAccountJson = null;
      
      // Try to get JSON from file first
      if (fileInput.files && fileInput.files.length > 0) {
        try {
          const file = fileInput.files[0];
          const text = await file.text();
          serviceAccountJson = JSON.parse(text);
        } catch (error) {
          showToast('Invalid JSON file. Please check the file format.', 'bad');
          return;
        }
      } 
      // Otherwise try textarea
      else if (jsonTextarea.value.trim()) {
        try {
          serviceAccountJson = JSON.parse(jsonTextarea.value.trim());
        } catch (error) {
          showToast('Invalid JSON. Please check the format.', 'bad');
          return;
        }
      } else {
        showToast('Please either upload a JSON file or paste the JSON content', 'bad');
        return;
      }
      
      // Validate it's a service account key
      if (!serviceAccountJson.type || serviceAccountJson.type !== 'service_account') {
        showToast('This does not appear to be a service account key. Please check the JSON file.', 'bad');
        return;
      }
      
      if (!serviceAccountJson.client_email || !serviceAccountJson.private_key) {
        showToast('Service account key is missing required fields (client_email or private_key)', 'bad');
        return;
      }
      
      try {
        showLoader();
        await API.settings.set('google_drive_service_account', JSON.stringify(serviceAccountJson));
        await loadGoogleDriveStatus();
        showToast('Service account key saved successfully', 'ok');
        
        // Clear form
        fileInput.value = '';
        jsonTextarea.value = '';
      } catch (error) {
        showToast(error.message || 'Failed to save service account key', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  // Folder selection form
  if (folderForm) {
    folderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const folderLinkInput = document.getElementById('googleDriveFolderLink');
      const linkOrId = folderLinkInput?.value.trim() || '';
      
      if (!linkOrId) {
        showToast('Please enter a Google Drive folder link or ID', 'bad');
        return;
      }
      
      try {
        showLoader();
        
        // Extract folder ID from link
        const extractResult = await API.googleDrive.extractFolderId(linkOrId);
        const folderId = extractResult.folderId;
        
        if (!folderId) {
          showToast('Invalid Google Drive link format', 'bad');
          return;
        }
        
        // Get folder info to get the name
        let folderName = 'Selected folder';
        try {
          const folderResult = await API.googleDrive.getFolder(folderId);
          if (folderResult.folder && folderResult.folder.name) {
            folderName = folderResult.folder.name;
          }
        } catch (error) {
          console.warn('Could not get folder name:', error);
        }
        
        // Save folder ID and name
        await API.settings.set('google_drive_folder_id', folderId);
        await API.settings.set('google_drive_folder_name', folderName);
        
        await loadGoogleDriveFolder();
        showToast('Folder saved successfully', 'ok');
      } catch (error) {
        showToast(error.message || 'Failed to save folder', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  // Browse folders button
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      // Check if Google Drive is connected
      try {
        const status = await API.googleDrive.getStatus();
        if (!status.connected) {
          showToast('Please connect Google Drive first', 'bad');
          return;
        }
      } catch (error) {
        showToast('Failed to check Google Drive status', 'bad');
        return;
      }
      
      // Reset browser state
      selectedFolderId = null;
      selectedFolderName = null;
      currentFolderPath = [{ id: 'root', name: 'Root' }];
      
      // Open modal and load folders
      if (folderBrowserModal) {
        folderBrowserModal.showModal();
        updateBreadcrumb();
        loadFoldersForBrowser(null);
      }
    });
  }
  
  // Clear folder button
  if (clearFolderBtn) {
    clearFolderBtn.addEventListener('click', async () => {
      if (!confirm('Clear the selected folder? Images will be fetched from all folders.')) {
        return;
      }
      
      try {
        showLoader();
        await API.settings.set('google_drive_folder_id', '');
        await API.settings.set('google_drive_folder_name', '');
        await loadGoogleDriveFolder();
        showToast('Folder cleared', 'ok');
      } catch (error) {
        showToast('Failed to clear folder', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  // Folder browser modal handlers
  if (folderBrowserClose) {
    folderBrowserClose.addEventListener('click', () => {
      if (folderBrowserModal) folderBrowserModal.close();
    });
  }
  
  if (folderBrowserCancel) {
    folderBrowserCancel.addEventListener('click', () => {
      if (folderBrowserModal) folderBrowserModal.close();
    });
  }
  
  if (folderBrowserSelect) {
    folderBrowserSelect.addEventListener('click', async () => {
      if (!selectedFolderId) return;
      
      try {
        showLoader();
        await API.settings.set('google_drive_folder_id', selectedFolderId);
        await API.settings.set('google_drive_folder_name', selectedFolderName);
        await loadGoogleDriveFolder();
        
        const folderLinkInput = document.getElementById('googleDriveFolderLink');
        if (folderLinkInput) {
          folderLinkInput.value = selectedFolderId;
        }
        
        if (folderBrowserModal) folderBrowserModal.close();
        showToast('Folder selected successfully', 'ok');
      } catch (error) {
        showToast('Failed to save folder', 'bad');
      } finally {
        hideLoader();
      }
    });
  }
  
  // Make functions globally available for inline handlers
  window.navigateToFolder = navigateToFolder;
  window.navigateToBreadcrumb = navigateToBreadcrumb;
}

// ============================================================
// SHEET MANAGEMENT (Content Ideas)
// ============================================================

async function loadSheetData() {
  const tbody = document.getElementById('sheetBody');
  if (!tbody) return;
  
  try {
    // Load posts that need manual input (status is null or empty)
    const result = await API.posts.list({ page: 1, limit: 100 });
    const posts = result.posts || [];
    
    renderSheetRows(posts);
  } catch (error) {
    console.error('Failed to load sheet data:', error);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">Failed to load data</td></tr>';
  }
}

function renderSheetRows(posts) {
  const tbody = document.getElementById('sheetBody');
  
  if (posts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #666;">No posts yet. Click "Add New Post" to create one.</td></tr>';
    return;
  }
  
  tbody.innerHTML = posts.map(post => `
    <tr data-post-id="${post.id}">
      <td class="col-id">${escapeHtml(post.post_id)}</td>
      <td class="col-instruction" title="${escapeHtml(post.instruction || '')}">${escapeHtml(post.instruction || '-')}</td>
      <td class="col-type">${escapeHtml(post.type || '-')}</td>
      <td class="col-template">${escapeHtml(post.template || '-')}</td>
      <td class="col-purpose">${escapeHtml(post.purpose || '-')}</td>
      <td class="col-sample" title="${escapeHtml(post.sample || '')}">${escapeHtml(post.sample || '-')}</td>
      <td class="col-keywords">${escapeHtml(post.keywords || '-')}</td>
      <td class="col-status">
        <span class="chip status-${getStatusClass(post.status)}">${post.status || 'Pending'}</span>
      </td>
      <td class="col-actions">
        <button class="btn clear btn-sm" data-action="edit-post" data-post-id="${post.id}">Edit</button>
        <button class="btn reject btn-sm" data-action="delete-post" data-post-id="${post.id}">×</button>
      </td>
    </tr>
  `).join('');
  
  // Attach event listeners
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleSheetAction);
  });
}

function handleSheetAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const postId = btn.dataset.postId;
  
  switch (action) {
    case 'edit-post':
      openPostEditModal(postId);
      break;
    case 'delete-post':
      handleDeletePost(postId);
      break;
  }
}

// ============================================================
// POST EDIT MODAL
// ============================================================

function initPostEditModal() {
  const modal = document.getElementById('postEditModal');
  const form = document.getElementById('postEditForm');
  const closeBtn = document.getElementById('postEditClose');
  const cancelBtn = document.getElementById('postEditCancel');
  
  // Close handlers
  closeBtn?.addEventListener('click', () => modal.close());
  cancelBtn?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
  
  // Form submit
  form?.addEventListener('submit', handlePostFormSubmit);
  
  // Add post button
  document.getElementById('btnAddPost')?.addEventListener('click', () => {
    openPostEditModal(null);
  });
}

function openPostEditModal(postId) {
  const modal = document.getElementById('postEditModal');
  const form = document.getElementById('postEditForm');
  const title = document.getElementById('postEditTitle');
  
  form.reset();
  document.getElementById('postEditId').value = postId || '';
  
  if (postId) {
    title.textContent = 'Edit Post';
    
    // Find post and populate form
    API.posts.get(postId).then(data => {
      const post = data.post;
      if (post) {
        form.instruction.value = post.instruction || '';
        form.type.value = post.type || '';
        form.template.value = post.template || '';
        form.purpose.value = post.purpose || '';
        form.sample.value = post.sample || '';
        form.keywords.value = post.keywords || '';
      }
    }).catch(error => {
      showToast('Failed to load post', 'bad');
    });
  } else {
    title.textContent = 'Add New Post';
  }
  
  modal.showModal();
}

async function handlePostFormSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const postId = document.getElementById('postEditId').value;
  
  const data = {
    instruction: form.instruction.value.trim(),
    type: form.type.value.trim() || null,
    template: form.template.value.trim() || null,
    purpose: form.purpose.value.trim() || null,
    sample: form.sample.value.trim() || null,
    keywords: form.keywords.value.trim() || null
  };
  
  if (!data.instruction) {
    showToast('Instruction is required', 'bad');
    return;
  }
  
  try {
    showLoader();
    
    if (postId) {
      await API.posts.update(postId, data);
      showToast('Post updated', 'ok');
    } else {
      await API.posts.create(data);
      showToast('Post created', 'ok');
    }
    
    document.getElementById('postEditModal').close();
    loadSheetData();
  } catch (error) {
    showToast(error.message || 'Failed to save post', 'bad');
  } finally {
    hideLoader();
  }
}

async function handleDeletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }
  
  try {
    showLoader();
    await API.posts.delete(postId);
    showToast('Post deleted', 'ok');
    loadSheetData();
  } catch (error) {
    showToast('Failed to delete post', 'bad');
  } finally {
    hideLoader();
  }
}

// ============================================================
// CSV IMPORT/EXPORT
// ============================================================

function initCsvButtons() {
  document.getElementById('btnImportPosts')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = handleCsvImport;
    input.click();
  });
  
  document.getElementById('btnExportPosts')?.addEventListener('click', handleCsvExport);
}

async function handleCsvImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Map headers to our fields
    const fieldMap = {
      'instruction': 'instruction',
      'type': 'type',
      'template': 'template',
      'purpose': 'purpose',
      'sample': 'sample',
      'keywords': 'keywords'
    };
    
    const posts = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const post = {};
      
      headers.forEach((header, idx) => {
        const field = fieldMap[header];
        if (field && values[idx]) {
          post[field] = values[idx];
        }
      });
      
      if (post.instruction) {
        posts.push(post);
      }
    }
    
    if (posts.length === 0) {
      showToast('No valid posts found in CSV', 'bad');
      return;
    }
    
    showLoader();
    await API.posts.bulkCreate(posts);
    showToast(`Imported ${posts.length} posts`, 'ok');
    loadSheetData();
  } catch (error) {
    showToast('Failed to import CSV', 'bad');
  } finally {
    hideLoader();
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

async function handleCsvExport() {
  try {
    showLoader();
    const result = await API.posts.list({ limit: 1000 });
    const posts = result.posts || [];
    
    if (posts.length === 0) {
      showToast('No posts to export', 'neutral');
      return;
    }
    
    const headers = ['post_id', 'instruction', 'type', 'template', 'purpose', 'sample', 'keywords', 'status'];
    const rows = [headers.join(',')];
    
    posts.forEach(post => {
      const row = headers.map(h => {
        const value = post[h] || '';
        // Escape quotes and wrap in quotes if contains comma
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      rows.push(row.join(','));
    });
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `slop-posts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'ok');
  } catch (error) {
    showToast('Failed to export CSV', 'bad');
  } finally {
    hideLoader();
  }
}

// ============================================================
// USER MANAGEMENT
// ============================================================

async function loadUsers() {
  const container = document.getElementById('usersList');
  if (!container) return;
  
  try {
    const result = await API.users.list();
    const users = result.users || [];
    
    container.innerHTML = users.map(user => {
      const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
      const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
      const isCurrentUser = user.id === window.AppState.user.id;
      
      return `
      <div class="user-item" data-user-id="${user.id}">
        <div class="user-info">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
            <span class="user-role ${user.role === 'admin' ? 'admin' : ''}">${user.role}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
            <span class="user-email">${escapeHtml(user.email)}</span>
            <div style="display: flex; gap: 16px; font-size: 12px; color: #888;">
              <span>Created: ${createdDate}</span>
              <span>Last login: ${lastLogin}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${!isCurrentUser ? `
            <button class="btn clear btn-sm" data-action="view-user" data-user-id="${user.id}">View</button>
            <button class="btn approve btn-sm" data-action="edit-user" data-user-id="${user.id}">Edit</button>
            <button class="btn reject btn-sm" data-action="delete-user" data-user-id="${user.id}">Delete</button>
          ` : '<span style="color: #888; font-size: 12px;">Current user</span>'}
        </div>
      </div>
    `;
    }).join('');
    
    // Attach event listeners
    container.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', handleDeleteUser);
    });
    container.querySelectorAll('[data-action="edit-user"]').forEach(btn => {
      btn.addEventListener('click', handleEditUser);
    });
    container.querySelectorAll('[data-action="view-user"]').forEach(btn => {
      btn.addEventListener('click', handleViewUser);
    });
  } catch (error) {
    console.error('Failed to load users:', error);
    container.innerHTML = '<p style="color: #666;">Failed to load users</p>';
  }
}

let currentEditUserId = null;

function initUserEditModal() {
  const modal = document.getElementById('userEditModal');
  const form = document.getElementById('userEditForm');
  const closeBtn = document.getElementById('userEditClose');
  const cancelBtn = document.getElementById('userEditCancel');
  const modalTitle = modal?.querySelector('h3');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const passwordField = form?.querySelector('#userPassword');
  const passwordLabel = form?.querySelector('label[for="userPassword"]');
  
  // Close handlers
  closeBtn?.addEventListener('click', () => {
    modal.close();
    currentEditUserId = null;
    form.reset();
  });
  cancelBtn?.addEventListener('click', () => {
    modal.close();
    currentEditUserId = null;
    form.reset();
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.close();
      currentEditUserId = null;
      form.reset();
    }
  });
  
  // Form submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      displayName: form.displayName.value.trim() || undefined,
      role: form.role.value
    };
    
    // Password is only required for new users
    if (!currentEditUserId && !form.password.value) {
      showToast('Password is required for new users', 'bad');
      return;
    }
    
    if (form.password.value) {
      data.password = form.password.value;
    }
    
    if (!data.username || !data.email) {
      showToast('Username and email are required', 'bad');
      return;
    }
    
    try {
      showLoader();
      if (currentEditUserId) {
        // Update existing user
        await API.users.update(currentEditUserId, data);
        showToast('User updated successfully', 'ok');
      } else {
        // Create new user
        await API.users.create(data);
        showToast('User created successfully', 'ok');
      }
      modal.close();
      currentEditUserId = null;
      form.reset();
      loadUsers();
    } catch (error) {
      showToast(error.message || (currentEditUserId ? 'Failed to update user' : 'Failed to create user'), 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Add user button
  document.getElementById('btnAddUser')?.addEventListener('click', () => {
    currentEditUserId = null;
    form.reset();
    if (modalTitle) modalTitle.textContent = 'Add New User';
    if (submitBtn) submitBtn.innerHTML = '<span class="ico"></span> Create User';
    if (passwordField) {
      passwordField.required = true;
      passwordField.disabled = false;
    }
    if (passwordLabel) passwordLabel.innerHTML = 'Password *';
    modal.showModal();
  });
}

async function handleEditUser(e) {
  const userId = e.currentTarget.dataset.userId;
  if (!userId) return;
  
  try {
    showLoader();
    const result = await API.users.get(userId);
    const user = result.user;
    
    if (!user) {
      showToast('User not found', 'bad');
      return;
    }
    
    // Populate form
    const form = document.getElementById('userEditForm');
    const modal = document.getElementById('userEditModal');
    const modalTitle = modal?.querySelector('h3');
    const submitBtn = form?.querySelector('button[type="submit"]');
    const passwordField = form?.querySelector('#userPassword');
    const passwordLabel = form?.querySelector('label[for="userPassword"]');
    
    form.username.value = user.username || '';
    form.email.value = user.email || '';
    form.displayName.value = user.display_name || '';
    form.role.value = user.role || 'user';
    passwordField.value = '';
    
    // Update UI for edit mode
    currentEditUserId = userId;
    if (modalTitle) modalTitle.textContent = `Edit User: ${user.username}`;
    if (submitBtn) submitBtn.innerHTML = '<span class="ico"></span> Update User';
    if (passwordField) {
      passwordField.required = false;
      passwordField.placeholder = 'Leave blank to keep current password';
    }
    if (passwordLabel) passwordLabel.innerHTML = 'Password (leave blank to keep current)';
    
    modal.showModal();
  } catch (error) {
    showToast(error.message || 'Failed to load user', 'bad');
  } finally {
    hideLoader();
  }
}

async function handleViewUser(e) {
  const userId = e.currentTarget.dataset.userId;
  if (!userId) return;
  
  try {
    showLoader();
    const result = await API.users.get(userId);
    const user = result.user;
    
    if (!user) {
      showToast('User not found', 'bad');
      return;
    }
    
    // Show user details in a simple alert or modal
    const createdDate = user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A';
    const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
    const updatedDate = user.updated_at ? new Date(user.updated_at).toLocaleString() : 'N/A';
    
    const details = `
User Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${user.id}
Username: ${user.username}
Email: ${user.email}
Display Name: ${user.display_name || 'Not set'}
Role: ${user.role}
Created: ${createdDate}
Last Login: ${lastLogin}
Updated: ${updatedDate}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
    
    alert(details);
  } catch (error) {
    showToast(error.message || 'Failed to load user details', 'bad');
  } finally {
    hideLoader();
  }
}

async function handleDeleteUser(e) {
  const userId = e.currentTarget.dataset.userId;
  
  if (!confirm('Are you sure you want to delete this user?')) {
    return;
  }
  
  try {
    showLoader();
    await API.users.delete(userId);
    showToast('User deleted', 'ok');
    loadUsers();
  } catch (error) {
    showToast('Failed to delete user', 'bad');
  } finally {
    hideLoader();
  }
}

// ============================================================
// CLEAR INSTANCE OPTIONS
// ============================================================

function initClearInstanceOptions() {
  // Clear posts
  document.querySelectorAll('[data-clear-action="posts"]').forEach(btn => {
    btn.addEventListener('click', () => clearAllPosts());
  });
  
  // Clear settings
  document.querySelectorAll('[data-clear-action="settings"]').forEach(btn => {
    btn.addEventListener('click', () => clearAllSettings());
  });
  
  // Clear sessions
  document.querySelectorAll('[data-clear-action="sessions"]').forEach(btn => {
    btn.addEventListener('click', () => clearWorkflowSessions());
  });
  
  // Clear users
  document.querySelectorAll('[data-clear-action="users"]').forEach(btn => {
    btn.addEventListener('click', () => clearAllUsers());
  });
  
  // Full reset form
  const form = document.getElementById('instanceRefreshForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await fullInstanceReset();
    });
  }
  
  // Copy confirmation text button
  const copyBtn = document.getElementById('btnCopyConfirmation');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = "Humpty Dumpty sat on a wall. Humpty Dumpty had a great fall. All the king's horses and all the king's men couldn't put Humpty together again.";
      navigator.clipboard.writeText(text).then(() => {
        showToast('Confirmation text copied to clipboard', 'ok');
      }).catch(() => {
        showToast('Failed to copy text', 'bad');
      });
    });
  }
}

async function clearAllPosts() {
  if (!confirm('Are you sure you want to clear all posts? This action cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    const result = await API.call('/settings/clear/posts', { method: 'POST' });
    showToast(result.message || `Cleared ${result.count || 0} posts`, 'ok');
  } catch (error) {
    showToast(error.message || 'Failed to clear posts', 'bad');
  } finally {
    hideLoader();
  }
}

async function clearAllSettings() {
  if (!confirm('Are you sure you want to clear all settings? This will remove all API keys and configurations. This action cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    const result = await API.call('/settings/clear/settings', { method: 'POST' });
    showToast(result.message || `Cleared ${result.count || 0} settings`, 'ok');
  } catch (error) {
    showToast(error.message || 'Failed to clear settings', 'bad');
  } finally {
    hideLoader();
  }
}

async function clearWorkflowSessions() {
  if (!confirm('Are you sure you want to clear all workflow sessions? This action cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    const result = await API.call('/settings/clear/sessions', { method: 'POST' });
    showToast(result.message || `Cleared ${result.count || 0} sessions`, 'ok');
  } catch (error) {
    showToast(error.message || 'Failed to clear sessions', 'bad');
  } finally {
    hideLoader();
  }
}

async function clearAllUsers() {
  if (!confirm('Are you sure you want to clear all users except your admin account? This action cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    const result = await API.call('/settings/clear/users', { method: 'POST' });
    showToast(result.message || `Cleared ${result.count || 0} users`, 'ok');
    loadUsers();
  } catch (error) {
    showToast(error.message || 'Failed to clear users', 'bad');
  } finally {
    hideLoader();
  }
}

async function fullInstanceReset() {
  const form = document.getElementById('instanceRefreshForm');
  if (!form) return;
  
  const data = {
    adminUsername: form.refreshAdminUsername.value.trim(),
    adminPassword: form.refreshAdminPassword.value,
    confirmationText: form.refreshConfirmationText.value.trim()
  };
  
  if (!data.adminUsername || !data.adminPassword || !data.confirmationText) {
    showToast('All fields are required', 'bad');
    return;
  }
  
  try {
    showLoader();
    const result = await API.call('/settings/reset-instance', { method: 'POST', body: data });
    showToast(result.message || 'Instance reset successfully', 'ok');
    
    // Redirect to login after a delay
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  } catch (error) {
    showToast(error.message || 'Failed to reset instance', 'bad');
  } finally {
    hideLoader();
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

// ============================================================
// SETTINGS TILES NAVIGATION
// ============================================================

let tilesInitialized = false;

function initSettingsTiles() {
  const tilesGrid = document.getElementById('settingsTilesGrid');
  const backContainer = document.getElementById('settingsBack');
  const backBtn = document.getElementById('btnSettingsBack');
  
  if (!tilesGrid) {
    // Retry if tiles grid not found yet (page might still be loading)
    setTimeout(() => initSettingsTiles(), 100);
    return;
  }
  
  // Populate tile icons
  populateSettingsTileIcons();
  
  if (!tilesInitialized) {
    // Add click handlers to tiles
    tilesGrid.querySelectorAll('.settings-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        const section = tile.dataset.section;
        if (section) {
          showSection(section);
        }
      });
    });
    
    // Handle back button
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        showTiles();
      });
    }
    
    tilesInitialized = true;
  }
  
  // Always show tiles by default when settings tab is activated
  showTiles();
  
  function showTiles() {
    // Show tiles grid
    if (tilesGrid) tilesGrid.classList.remove('hidden');
    // Hide back button
    if (backContainer) backContainer.classList.add('hidden');
    // Hide all sections
    document.querySelectorAll('.settings-section-content').forEach(section => {
      section.classList.add('hidden');
    });
    // Remove active state from all tiles
    if (tilesGrid) {
      tilesGrid.querySelectorAll('.settings-tile').forEach(tile => {
        tile.classList.remove('active');
      });
    }
  }
  
  function showSection(sectionName) {
    // Hide tiles grid
    if (tilesGrid) tilesGrid.classList.add('hidden');
    // Show back button
    if (backContainer) backContainer.classList.remove('hidden');
    // Hide all sections
    document.querySelectorAll('.settings-section-content').forEach(section => {
      section.classList.add('hidden');
    });
    // Show target section
    const targetSection = document.querySelector(`.settings-section-content[data-section="${sectionName}"]`);
    if (targetSection) {
      targetSection.classList.remove('hidden');
      
      // Update URL hash
      window.location.hash = `#/settings/${sectionName}`;
      
      // Load users if admin section is shown
      if (sectionName === 'admin') {
        if (window.AppState.user?.role === 'admin') {
          loadUsers();
          // Explicitly show admin sections
          const userMgmtSection = document.getElementById('userManagementSection');
          const instanceRefreshSection = document.getElementById('instanceRefreshSection');
          if (userMgmtSection) userMgmtSection.classList.remove('hidden');
          if (instanceRefreshSection) instanceRefreshSection.classList.remove('hidden');
        } else {
          // Hide admin sections for non-admin users
          document.getElementById('userManagementSection')?.classList.add('hidden');
          document.getElementById('instanceRefreshSection')?.classList.add('hidden');
        }
      }
    }
    // Update active tile
    if (tilesGrid) {
      tilesGrid.querySelectorAll('.settings-tile').forEach(tile => {
        tile.classList.toggle('active', tile.dataset.section === sectionName);
      });
    }
  }
  
  // Make showSection available globally for other code
  window.showSettingsSection = showSection;
}

/**
 * Populate settings tile icons with Flaticon icons
 */
function populateSettingsTileIcons() {
  // Map section names to icon names
  const iconMap = {
    account: 'account',
    openai: 'openai',
    googledrive: 'googledrive',
    linkedin: 'linkedin',
    storage: 'storage',
    ai: 'ai',
    content: 'contentManagement', // Note: icon name is contentManagement
    admin: 'admin'
  };
  
  // Retry mechanism if Icons module not loaded yet
  if (!window.Icons || !window.Icons.get) {
    // Retry after a short delay
    setTimeout(() => populateSettingsTileIcons(), 100);
    return;
  }
  
  // Populate each tile icon
  Object.keys(iconMap).forEach(section => {
    const iconEl = document.getElementById(`tileIcon${section.charAt(0).toUpperCase() + section.slice(1)}`);
    if (iconEl) {
      const iconName = iconMap[section];
      const iconHtml = window.Icons.get(iconName, 'tile-icon-flaticon', { size: '24px' });
      if (iconHtml) {
        iconEl.innerHTML = iconHtml;
      }
    }
  });
}

function initPasswordVisibilityToggles() {
  // Add toggle buttons to all password fields in settings
  const passwordFields = document.querySelectorAll('input[type="password"]');
  
  passwordFields.forEach(field => {
    // Skip if already has a toggle
    if (field.parentElement.classList.contains('password-input-wrapper')) {
      const toggle = field.parentElement.querySelector('.password-toggle');
      if (toggle) {
        // Remove existing listeners and add new one
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener('click', () => {
          const isPassword = field.type === 'password';
          field.type = isPassword ? 'text' : 'password';
          if (window.Icons && window.Icons.get) {
            newToggle.innerHTML = isPassword ? window.Icons.get('eyeSlash', 'password-toggle-icon') : window.Icons.get('eye', 'password-toggle-icon');
          }
        });
        // Initialize icon
        if (window.Icons && window.Icons.get) {
          newToggle.innerHTML = window.Icons.get('eye', 'password-toggle-icon');
        }
      }
      return;
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'password-input-wrapper';
    
    // Create toggle button
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Toggle password visibility');
    if (window.Icons && window.Icons.get) {
      toggle.innerHTML = window.Icons.get('eye', 'password-toggle-icon');
    }
    
    // Wrap the field
    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    wrapper.appendChild(toggle);
    
    // Add click handler
    toggle.addEventListener('click', () => {
      const isPassword = field.type === 'password';
      field.type = isPassword ? 'text' : 'password';
      if (window.Icons && window.Icons.get) {
        toggle.innerHTML = isPassword ? window.Icons.get('eyeSlash', 'password-toggle-icon') : window.Icons.get('eye', 'password-toggle-icon');
      }
    });
  });
}

function initSettingsModule() {
  initPasswordForm();
  initApiSettingsForm();
  initPromptsSection();
  initStabilitySettings();
  initGoogleDrive();
  initPostEditModal();
  initCsvButtons();
  initUserEditModal();
  initClearInstanceOptions();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initSettingsModule);

// Make functions globally available
window.loadSettings = loadSettings;