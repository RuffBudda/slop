/**
 * Settings Tab Module
 * Handles API key configuration and sheet management
 */

// ============================================================
// SETTINGS LOADING
// ============================================================

async function loadSettings() {
  try {
    // Load profile settings
    await loadProfileSettings();
    
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
    
    // Load LinkedIn settings
    await loadLinkedInSettings();
    
    // Load posts for sheet view
    await loadSheetData();
    
    // Load users (admin only)
    if (window.AppState.user?.role === 'admin') {
      await loadUsers();
      document.getElementById('userManagementSection')?.classList.remove('hidden');
    } else {
      document.getElementById('userManagementSection')?.classList.add('hidden');
    }
    
    // Re-initialize calculator when settings tab is loaded
    // This ensures sliders work even if tab wasn't visible on page load
    initCalculator();
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('Failed to load settings', 'bad');
  }
}

// ============================================================
// PROFILE SETTINGS
// ============================================================

async function loadProfileSettings() {
  try {
    const result = await API.settings.getProfile();
    const profile = result.profile || {};
    
    const form = document.getElementById('profileSettingsForm');
    if (!form) return;
    
    form.username.value = profile.username || '';
    form.email.value = profile.email || '';
    form.displayName.value = profile.display_name || '';
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

function initProfileSettingsForm() {
  const form = document.getElementById('profileSettingsForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      displayName: form.displayName.value.trim()
    };
    
    if (!data.username || !data.email) {
      showToast('Username and email are required', 'bad');
      return;
    }
    
    try {
      showLoader();
      const result = await API.settings.updateProfile(data);
      showToast('Profile updated successfully', 'ok');
      
      // Update AppState with new user info
      if (result.profile) {
        window.AppState.user = { ...window.AppState.user, ...result.profile };
      }
    } catch (error) {
      showToast(error.message || 'Failed to update profile', 'bad');
    } finally {
      hideLoader();
    }
  });
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
      statusText.textContent = isConnected 
        ? '✓ Google Drive is connected' 
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
        <span style="font-size: 20px;">📁</span>
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
// LINKEDIN SETTINGS
// ============================================================

async function loadLinkedInSettings() {
  try {
    const result = await API.settings.getAll();
    const settings = result.settings || {};
    
    // Load LinkedIn credentials (masked for sensitive fields)
    const clientIdInput = document.getElementById('linkedInClientId');
    const clientSecretInput = document.getElementById('linkedInClientSecret');
    const accessTokenInput = document.getElementById('linkedInAccessToken');
    const refreshTokenInput = document.getElementById('linkedInRefreshToken');
    
    if (clientIdInput) {
      const clientId = settings.linkedin_client_id;
      clientIdInput.value = clientId && typeof clientId === 'string' ? clientId : '';
    }
    
    if (clientSecretInput) {
      const clientSecret = settings.linkedin_client_secret;
      if (clientSecret && typeof clientSecret === 'object' && clientSecret.isSet) {
        // Sensitive field - already masked
        clientSecretInput.placeholder = clientSecret.isSet ? '••••••••' : '';
      } else {
        clientSecretInput.value = clientSecret && typeof clientSecret === 'string' ? clientSecret : '';
      }
    }
    
    if (accessTokenInput) {
      const accessToken = settings.linkedin_access_token;
      if (accessToken && typeof accessToken === 'object' && accessToken.isSet) {
        accessTokenInput.placeholder = accessToken.isSet ? '••••••••' : '';
      } else {
        accessTokenInput.value = accessToken && typeof accessToken === 'string' ? accessToken : '';
      }
    }
    
    if (refreshTokenInput) {
      const refreshToken = settings.linkedin_refresh_token;
      if (refreshToken && typeof refreshToken === 'object' && refreshToken.isSet) {
        refreshTokenInput.placeholder = refreshToken.isSet ? '••••••••' : '';
      } else {
        refreshTokenInput.value = refreshToken && typeof refreshToken === 'string' ? refreshToken : '';
      }
    }
    
    // Update status
    await updateLinkedInStatus();
  } catch (error) {
    console.error('Failed to load LinkedIn settings:', error);
  }
}

async function updateLinkedInStatus() {
  const statusText = document.getElementById('linkedInStatusText');
  const testBtn = document.getElementById('btnTestLinkedIn');
  
  try {
    const result = await API.settings.getAll();
    const settings = result.settings || {};
    
    const hasClientId = settings.linkedin_client_id && 
      (typeof settings.linkedin_client_id === 'string' || settings.linkedin_client_id.isSet);
    const hasClientSecret = settings.linkedin_client_secret && 
      (typeof settings.linkedin_client_secret === 'object' ? settings.linkedin_client_secret.isSet : true);
    const hasAccessToken = settings.linkedin_access_token && 
      (typeof settings.linkedin_access_token === 'object' ? settings.linkedin_access_token.isSet : true);
    
    const isConfigured = hasClientId && hasClientSecret && hasAccessToken;
    
    if (statusText) {
      statusText.textContent = isConfigured 
        ? '✓ LinkedIn API is configured' 
        : 'LinkedIn API is not configured';
    }
    
    if (testBtn) {
      testBtn.style.display = isConfigured ? 'inline-flex' : 'none';
    }
  } catch (error) {
    console.error('Failed to update LinkedIn status:', error);
    if (statusText) {
      statusText.textContent = 'Failed to check LinkedIn status';
    }
  }
}

function initLinkedIn() {
  const form = document.getElementById('linkedInSettingsForm');
  const testBtn = document.getElementById('btnTestLinkedIn');
  
  if (!form) return;
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const settings = [];
    
    // Only include non-empty values
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
      showToast('LinkedIn settings saved successfully', 'ok');
      
      // Reload to show updated status
      await loadLinkedInSettings();
    } catch (error) {
      showToast('Failed to save LinkedIn settings', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Test button
  testBtn?.addEventListener('click', async () => {
    try {
      showLoader();
      const result = await API.settings.test('linkedin');
      
      if (result.success) {
        showToast('LinkedIn connection successful!', 'ok');
        if (result.profile) {
          showToast(`Connected as: ${result.profile.name || result.profile.email || 'LinkedIn User'}`, 'ok');
        }
      } else {
        showToast(`LinkedIn test failed: ${result.error}`, 'bad');
      }
    } catch (error) {
      showToast(`LinkedIn test failed: ${error.message}`, 'bad');
    } finally {
      hideLoader();
    }
  });
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
    
    container.innerHTML = users.map(user => `
      <div class="user-item" data-user-id="${user.id}">
        <div class="user-info">
          <span class="user-name">${escapeHtml(user.display_name || user.username)}</span>
          <span class="user-email">${escapeHtml(user.email)}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span class="user-role ${user.role === 'admin' ? 'admin' : ''}">${user.role}</span>
          ${user.id !== window.AppState.user.id ? `
            <button class="btn reject btn-sm" data-action="delete-user" data-user-id="${user.id}">Delete</button>
          ` : ''}
        </div>
      </div>
    `).join('');
    
    // Attach event listeners
    container.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', handleDeleteUser);
    });
  } catch (error) {
    console.error('Failed to load users:', error);
    container.innerHTML = '<p style="color: #666;">Failed to load users</p>';
  }
}

function initUserEditModal() {
  const modal = document.getElementById('userEditModal');
  const form = document.getElementById('userEditForm');
  const closeBtn = document.getElementById('userEditClose');
  const cancelBtn = document.getElementById('userEditCancel');
  
  // Close handlers
  closeBtn?.addEventListener('click', () => modal.close());
  cancelBtn?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
  
  // Form submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      username: form.username.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      displayName: form.displayName.value.trim() || undefined,
      role: form.role.value
    };
    
    if (!data.username || !data.email || !data.password) {
      showToast('Please fill in all required fields', 'bad');
      return;
    }
    
    try {
      showLoader();
      await API.auth.register(data);
      showToast('User created', 'ok');
      modal.close();
      loadUsers();
    } catch (error) {
      showToast(error.message || 'Failed to create user', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Add user button
  document.getElementById('btnAddUser')?.addEventListener('click', () => {
    form.reset();
    modal.showModal();
  });
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
// ENVIRONMENTAL CALCULATOR
// ============================================================

// Environmental impact constants (based on research estimates)
const CALC_CONSTANTS = {
  GPT_ENERGY_WH: 0.03,        // Wh per GPT request
  IMAGE_ENERGY_WH: 0.1,       // Wh per Stability AI image
  CO2_PER_KWH: 0.4,           // kg CO2 per kWh (global average)
  TREE_ABSORPTION: 21,         // kg CO2 absorbed per tree per year
};

async function loadCalculatorStats() {
  try {
    const result = await API.workflow.stats();
    const stats = result.stats || { totalGenerations: 0, totalImages: 0 };
    
    updateCalculatorDisplay(stats.totalGenerations || 0, stats.totalImages || 0);
  } catch (error) {
    console.error('Failed to load calculator stats:', error);
    updateCalculatorDisplay(0, 0);
  }
}

function updateCalculatorDisplay(gptCount, imageCount) {
  // Calculate energy usage
  const gptEnergy = gptCount * CALC_CONSTANTS.GPT_ENERGY_WH;
  const imageEnergy = imageCount * CALC_CONSTANTS.IMAGE_ENERGY_WH;
  const totalEnergy = gptEnergy + imageEnergy;
  
  // Calculate CO2 equivalent (convert Wh to kWh first)
  const co2Kg = (totalEnergy / 1000) * CALC_CONSTANTS.CO2_PER_KWH;
  
  // Calculate trees needed to offset
  const treesNeeded = co2Kg / CALC_CONSTANTS.TREE_ABSORPTION;
  
  // Get display elements
  const totalGen = document.getElementById('calcTotalGenerations');
  const energyUsed = document.getElementById('calcEnergyUsed');
  const co2Saved = document.getElementById('calcCO2Saved');
  const treesEquiv = document.getElementById('calcTreesEquiv');
  const gptCountEl = document.getElementById('calcGptCount');
  const imageCountEl = document.getElementById('calcImageCount');
  const gptEnergyEl = document.getElementById('calcGptEnergy');
  const imageEnergyEl = document.getElementById('calcImageEnergy');
  
  // Store actual values as data attributes for manual calculator to use
  if (totalGen) {
    totalGen.dataset.actualGpt = gptCount;
    totalGen.dataset.actualImages = imageCount;
  }
  if (energyUsed) {
    energyUsed.dataset.actualEnergy = totalEnergy;
  }
  if (co2Saved) {
    co2Saved.dataset.actualCO2 = co2Kg;
  }
  if (treesEquiv) {
    treesEquiv.dataset.actualTrees = treesNeeded;
  }
  
  // Don't update display here - let calculateManualImpact handle it
  // This ensures manual calculator values are always included
  calculateManualImpact();
}

function formatEnergy(wh) {
  if (wh < 1000) {
    return wh.toFixed(2) + ' Wh';
  } else {
    return (wh / 1000).toFixed(3) + ' kWh';
  }
}

function initCalculator() {
  // Use event delegation on the calculator container to handle sliders
  const calculatorContainer = document.getElementById('calculatorContainer');
  
  if (calculatorContainer) {
    // Remove any existing listeners by using a single delegated listener
    calculatorContainer.addEventListener('input', function(e) {
      if (e.target.id === 'calcManualPosts') {
        const valueEl = document.getElementById('calcManualPostsValue');
        if (valueEl) valueEl.textContent = e.target.value;
        calculateManualImpact();
      } else if (e.target.id === 'calcManualVariants') {
        const valueEl = document.getElementById('calcManualVariantsValue');
        if (valueEl) valueEl.textContent = e.target.value;
        calculateManualImpact();
      } else if (e.target.id === 'calcManualImages') {
        const valueEl = document.getElementById('calcManualImagesValue');
        if (valueEl) valueEl.textContent = e.target.value;
        calculateManualImpact();
      }
    });
  }
  
  // Load actual stats
  loadCalculatorStats();
  
  // Calculate initial impact (with a small delay to ensure DOM is ready)
  setTimeout(() => {
    calculateManualImpact();
  }, 100);
}

function calculateManualImpact() {
  const postsSlider = document.getElementById('calcManualPosts');
  const variantsSlider = document.getElementById('calcManualVariants');
  const imagesSlider = document.getElementById('calcManualImages');
  
  if (!postsSlider || !variantsSlider || !imagesSlider) {
    return; // Elements not available yet
  }
  
  const posts = parseInt(postsSlider.value) || 0;
  const variants = parseInt(variantsSlider.value) || 3;
  const images = parseInt(imagesSlider.value) || 3;
  
  // Calculate totals
  // GPT generates all variants in one request, but variants affect the output size/complexity
  // More variants = more tokens generated = more energy consumed
  const totalGptRequests = posts;
  const totalVariants = posts * variants; // Total variants generated
  const totalImages = posts * images;
  const totalRequests = totalGptRequests + totalImages;
  
  // Calculate energy
  // Variants affect energy: more variants = more tokens = more energy
  // Base energy per request, multiplied by variant complexity
  // Each variant adds ~20% more tokens, so energy scales with variants
  const baseGptEnergy = totalGptRequests * CALC_CONSTANTS.GPT_ENERGY_WH;
  const variantMultiplier = 1 + (variants - 3) * 0.2; // 20% more energy per extra variant (more realistic)
  const gptEnergy = baseGptEnergy * Math.max(0.5, variantMultiplier); // Minimum 50% of base
  const imageEnergy = totalImages * CALC_CONSTANTS.IMAGE_ENERGY_WH;
  const totalEnergy = gptEnergy + imageEnergy;
  
  // Calculate CO2 (in kg)
  const co2Kg = (totalEnergy / 1000) * CALC_CONSTANTS.CO2_PER_KWH;
  
  // Calculate trees needed to offset
  const treesNeeded = co2Kg / CALC_CONSTANTS.TREE_ABSORPTION;
  
  // Get comparison
  const comparison = getEnergyComparison(totalEnergy);
  
  // Update usage breakdown
  const gptCountEl = document.getElementById('calcGptCount');
  const imageCountEl = document.getElementById('calcImageCount');
  const gptEnergyEl = document.getElementById('calcGptEnergy');
  const imageEnergyEl = document.getElementById('calcImageEnergy');
  
  // Update main stats
  const totalGenEl = document.getElementById('calcTotalGenerations');
  const energyUsedEl = document.getElementById('calcEnergyUsed');
  const co2SavedEl = document.getElementById('calcCO2Saved');
  const treesEquivEl = document.getElementById('calcTreesEquiv');
  
  // Update result display
  const resultEl = document.getElementById('calcManualResult');
  const requestsEl = document.getElementById('calcResultRequests');
  const energyEl = document.getElementById('calcResultEnergy');
  const co2El = document.getElementById('calcResultCO2');
  const equivEl = document.getElementById('calcResultEquiv');
  
  // Get actual stats from data attributes (set by updateCalculatorDisplay)
  const actualGpt = parseInt(totalGenEl?.dataset.actualGpt || '0');
  const actualImages = parseInt(totalGenEl?.dataset.actualImages || '0');
  const actualEnergy = parseFloat(energyUsedEl?.dataset.actualEnergy || '0');
  const actualCO2 = parseFloat(co2SavedEl?.dataset.actualCO2 || '0');
  const actualTrees = parseFloat(treesEquivEl?.dataset.actualTrees || '0');
  
  // Calculate combined totals (actual + manual)
  const combinedGpt = actualGpt + totalGptRequests;
  const combinedImages = actualImages + totalImages;
  const combinedTotalGen = combinedGpt + combinedImages;
  const combinedEnergy = actualEnergy + totalEnergy;
  const combinedCO2 = actualCO2 + co2Kg;
  const combinedTrees = actualTrees + treesNeeded;
  
  // Calculate combined energy breakdown
  const actualGptEnergy = actualGpt * CALC_CONSTANTS.GPT_ENERGY_WH;
  const actualImageEnergy = actualImages * CALC_CONSTANTS.IMAGE_ENERGY_WH;
  const combinedGptEnergy = actualGptEnergy + gptEnergy;
  const combinedImageEnergy = actualImageEnergy + imageEnergy;
  
  // Update usage breakdown (show combined actual + manual)
  if (gptCountEl) gptCountEl.textContent = combinedGpt;
  if (imageCountEl) imageCountEl.textContent = combinedImages;
  if (gptEnergyEl) gptEnergyEl.textContent = formatEnergy(combinedGptEnergy);
  if (imageEnergyEl) imageEnergyEl.textContent = formatEnergy(combinedImageEnergy);
  
  // Update main stats (show combined actual + manual)
  if (totalGenEl) {
    totalGenEl.textContent = combinedTotalGen;
  }
  if (energyUsedEl) {
    energyUsedEl.textContent = formatEnergy(combinedEnergy);
  }
  if (co2SavedEl) {
    co2SavedEl.textContent = combinedCO2.toFixed(4) + ' kg';
  }
  if (treesEquivEl) {
    treesEquivEl.textContent = (Math.ceil(combinedTrees * 100) / 100).toFixed(2);
  }
  
  // Update manual calculator result
  if (resultEl) {
    resultEl.classList.remove('hidden');
    resultEl.style.opacity = '0';
    setTimeout(() => {
      resultEl.style.transition = 'opacity 0.3s';
      resultEl.style.opacity = '1';
    }, 10);
  }
  if (requestsEl) requestsEl.textContent = totalRequests;
  if (energyEl) energyEl.textContent = formatEnergy(totalEnergy);
  if (co2El) co2El.textContent = co2Kg.toFixed(4) + ' kg';
  if (equivEl) equivEl.textContent = comparison;
}

function getEnergyComparison(wh) {
  // Fun comparisons for context
  const ledBulbMinutes = wh / (10 / 60); // 10W LED bulb
  const phoneCharges = wh / 10; // ~10Wh to charge a smartphone
  const kettleSeconds = wh / (2000 / 3600); // 2kW kettle
  const laptopMinutes = wh / (50 / 60); // 50W laptop
  
  if (wh < 0.5) {
    return `${(kettleSeconds * 60).toFixed(0)} seconds of kettle use`;
  } else if (wh < 5) {
    return `${ledBulbMinutes.toFixed(1)} minutes of LED bulb`;
  } else if (wh < 20) {
    return `${phoneCharges.toFixed(2)} phone charges`;
  } else {
    return `${laptopMinutes.toFixed(1)} minutes of laptop use`;
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

function initSettingsModule() {
  initProfileSettingsForm();
  initPasswordForm();
  initApiSettingsForm();
  initPromptsSection();
  initStabilitySettings();
  initGoogleDrive();
  initLinkedIn();
  initPostEditModal();
  initCsvButtons();
  initUserEditModal();
  initCalculator();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initSettingsModule);

// Make functions globally available
window.loadSettings = loadSettings;
