/**
 * Content Tab Module
 * Displays and manages generated content posts
 */

// ============================================================
// CONTENT LOADING
// ============================================================

async function loadContent(forceRefresh = false) {
  const container = document.getElementById('contentCards');
  const loader = document.getElementById('initialLoader');
  
  // Check cache
  if (!forceRefresh && isCacheValid('generated')) {
    const cached = getCache('generated');
    if (cached) {
      renderContentCards(cached);
      return;
    }
  }
  
  try {
    // Show skeleton loading
    if (loader) loader.style.display = 'none';
    container.innerHTML = renderSkeletonCards(3);
    
    const result = await API.posts.getGenerated();
    window.AppState.generatedPosts = result.posts || [];
    setCache('generated', result.posts);
    
    renderContentCards(result.posts);
    updateDock();
  } catch (error) {
    console.error('Failed to load content:', error);
    
    let errorTitle = 'Error Loading Content';
    let errorMessage = 'An unexpected error occurred.';
    let errorDetails = '';
    let showSettingsButton = false;
    let isAuthError = false;
    
    // Check for specific error types
    if (error.message) {
      const errorMsg = error.message.toLowerCase();
      
      // Authentication errors - check if user is actually authenticated first
      if (errorMsg.includes('401') || errorMsg.includes('authentication') || errorMsg.includes('unauthorized') || errorMsg.includes('authentication required')) {
        isAuthError = true;
        
        // Check if user is actually authenticated
        try {
          const authStatus = await API.auth.status();
          if (authStatus.authenticated) {
            // User is authenticated but getting 401 - might be a session issue
            errorTitle = 'Session Issue';
            errorMessage = 'Your session may have expired. Please refresh the page.';
            errorDetails = 'If the problem persists, please log out and log in again.';
          } else {
            // User is not authenticated
            errorTitle = 'Authentication Required';
            errorMessage = 'Please log in to access this content.';
            errorDetails = 'You need to be logged in to view content.';
          }
        } catch (authCheckError) {
          // If auth check fails, check if it's a network error vs actual auth failure
          const authErrorMsg = authCheckError.message?.toLowerCase() || '';
          if (authErrorMsg.includes('timeout') || authErrorMsg.includes('network') || 
              authErrorMsg.includes('fetch') || authErrorMsg.includes('failed to fetch')) {
            // Network error during auth check - don't assume unauthenticated
            // Show generic error instead
            errorTitle = 'Error Loading Content';
            errorMessage = 'Unable to verify authentication. Please try again.';
            errorDetails = 'If the problem persists, please refresh the page.';
            isAuthError = false;
          } else {
            // Likely an actual auth failure
            errorTitle = 'Authentication Required';
            errorMessage = 'Please log in to access this content.';
            errorDetails = 'You need to be logged in to view content.';
          }
        }
      }
      // Network errors
      else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout') || errorMsg.includes('failed to fetch')) {
        errorTitle = 'Network Error';
        errorMessage = 'Unable to connect to the server.';
        errorDetails = 'Please check your internet connection and try again.';
      }
      // Server errors
      else if (errorMsg.includes('500') || errorMsg.includes('internal server error')) {
        errorTitle = 'Server Error';
        errorMessage = 'The server encountered an error while processing your request.';
        errorDetails = 'This may be a temporary issue. Please try again in a few moments.';
      }
      // Database errors
      else if (errorMsg.includes('database') || errorMsg.includes('sql') || errorMsg.includes('query')) {
        errorTitle = 'Database Error';
        errorMessage = 'Unable to retrieve content from the database.';
        errorDetails = 'There may be an issue with the database connection.';
      }
      // Configuration/API errors
      else if (errorMsg.includes('api') || errorMsg.includes('settings') || errorMsg.includes('configuration') || errorMsg.includes('key')) {
        errorTitle = 'Configuration Required';
        errorMessage = 'Please configure your API settings before generating content.';
        errorDetails = 'Go to Settings to configure:';
        showSettingsButton = true;
      }
      // Permission errors
      else if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('permission')) {
        errorTitle = 'Access Denied';
        errorMessage = 'You do not have permission to access this content.';
        errorDetails = 'Please contact an administrator if you believe this is an error.';
      }
      // Not found errors
      else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        errorTitle = 'Content Not Found';
        errorMessage = 'The requested content could not be found.';
        errorDetails = 'The content may have been deleted or moved.';
      }
      // Generic error with message
      else {
        errorTitle = 'Error Loading Content';
        errorMessage = error.message;
        errorDetails = 'Please try again or contact support if the problem persists.';
      }
    } else {
      errorMessage = 'An unexpected error occurred while loading content.';
      errorDetails = 'Please try refreshing the page or contact support if the problem persists.';
    }
    
    // Build error display
    let errorHTML = `
      <div class="emptyState">
        <h2>${errorTitle}</h2>
        <p style="margin-bottom: 12px;">${errorMessage}</p>
    `;
    
    if (errorDetails) {
      if (showSettingsButton) {
        errorHTML += `
          <p style="margin-top: 16px; color: var(--ink-muted);">
            ${errorDetails}
          </p>
          <ul style="text-align: left; margin: 16px auto; max-width: 400px; color: var(--ink-muted);">
            <li>OpenAI API Key</li>
            <li>Stability AI API Key (for images)</li>
            <li>Google Drive Integration (optional)</li>
          </ul>
          <button class="btn approve" onclick="window.activateTab('settings')" style="margin-top: 24px;">
            Go to Settings
          </button>
        `;
      } else if (isAuthError) {
        // For auth errors, show "Go to Login" button instead of retry
        errorHTML += `
          <p style="margin-top: 12px; color: var(--ink-muted); font-size: 14px;">
            ${errorDetails}
          </p>
          <button class="btn approve" onclick="if(typeof showLoginPage === 'function') { showLoginPage(); } else { window.location.reload(); }" style="margin-top: 24px;">
            Go to Login
          </button>
        `;
      } else {
        errorHTML += `
          <p style="margin-top: 12px; color: var(--ink-muted); font-size: 14px;">
            ${errorDetails}
          </p>
          <button class="btn approve" onclick="loadContent(true)" style="margin-top: 24px;">
            Retry
          </button>
        `;
      }
    } else {
      if (isAuthError) {
        errorHTML += `
          <button class="btn approve" onclick="if(typeof showLoginPage === 'function') { showLoginPage(); } else { window.location.reload(); }" style="margin-top: 24px;">
            Go to Login
          </button>
        `;
      } else {
        errorHTML += `
          <button class="btn approve" onclick="loadContent(true)" style="margin-top: 24px;">
            Retry
          </button>
        `;
      }
    }
    
    errorHTML += `</div>`;
    
    container.innerHTML = errorHTML;
    
    // Hide loader on error
    if (loader) loader.style.display = 'none';
    
    // Show toast for non-configuration errors, but not if login page is visible
    if (!showSettingsButton) {
      const loginPage = document.getElementById('loginPage');
      const isLoginPageVisible = loginPage && !loginPage.classList.contains('hidden');
      if (!isLoginPageVisible) {
        showToast(errorMessage, 'bad');
      }
    }
  }
}

// ============================================================
// CARD RENDERING
// ============================================================

function renderContentCards(posts) {
  const container = document.getElementById('contentCards');
  
  if (!posts || posts.length === 0) {
    container.innerHTML = renderEmptyState(
      'No Content Available',
      'Click Generate to create AI-powered LinkedIn posts.',
      `<div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <button class="btn clear" onclick="triggerGeneration()">Generate Content</button>
        <p style="font-size: 13px; color: #888; margin-top: 16px;">
          <strong>Tip:</strong> Press <span class="kbd">?</span> to see keyboard shortcuts
        </p>
      </div>`
    );
    return;
  }
  
  container.innerHTML = posts.map(post => renderCard(post)).join('');
  
  // Attach event listeners
  attachCardEventListeners();
}

function renderCard(post) {
  const variants = [
    { num: 1, text: post.variant_1, prompt: post.image_prompt_1 },
    { num: 2, text: post.variant_2, prompt: post.image_prompt_2 },
    { num: 3, text: post.variant_3, prompt: post.image_prompt_3 }
  ].filter(v => v.text);
  
  // Stability AI images (from generated prompts)
  const stabilityImages = [
    { num: 1, url: post.image_1, source: 'stability' },
    { num: 2, url: post.image_2, source: 'stability' },
    { num: 3, url: post.image_3, source: 'stability' }
  ].filter(img => img.url);
  
  // Google Drive images (if available)
  const driveImages = [
    { num: 4, url: post.drive_image_1, source: 'drive' },
    { num: 5, url: post.drive_image_2, source: 'drive' },
    { num: 6, url: post.drive_image_3, source: 'drive' }
  ].filter(img => img.url);
  
  // Combine all images (Stability first, then Drive)
  const images = [...stabilityImages, ...driveImages];
  
  const selectedVariant = post.selected_variant || 1;
  const selectedImage = post.selected_image || 1;
  
  return `
    <div class="card" data-post-id="${post.id}">
      <header>
        <div class="left">
          <span class="chip">${escapeHtml(post.post_id)}</span>
          <span class="chip">${escapeHtml(post.type || 'General')}</span>
          ${post.status ? `<span class="chip status-${getStatusClass(post.status)}">${getStatusIcon(post.status)} ${escapeHtml(post.status)}</span>` : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn clear btn-sm" data-action="preview" data-post-id="${post.id}" title="Preview (P)">
            <span class="preview-icon">${window.Icons ? window.Icons.get('eye', '', { size: '14px' }) : '👁'}</span> Preview
          </button>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" class="bulk-checkbox" data-post-id="${post.id}">
            <span style="font-size: 12px;">Select</span>
          </label>
        </div>
      </header>
      
      <div class="content">
        <div class="variants">
          ${variants.map(v => renderVariant(post.id, v, selectedVariant)).join('')}
        </div>
        
        <div class="images">
          <div class="imgUploadBar">
            <label class="btn clear btn-sm">
              Upload Image
              <input type="file" accept="image/*" class="hidden" data-upload-post="${post.id}">
            </label>
          </div>
          ${images.map(img => renderImageCell(post.id, img, selectedImage)).join('')}
        </div>
      </div>
      
      <div class="actions">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn approve" data-action="approve" data-post-id="${post.id}">
            <span class="ico"></span> Approve
          </button>
          <button class="btn reject" data-action="reject" data-post-id="${post.id}">
            <span class="ico"></span> Reject
          </button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <input type="datetime-local" class="scheduleInput" data-schedule-post="${post.id}" 
            value="${post.scheduled_date ? new Date(post.scheduled_date).toISOString().slice(0, 16) : ''}">
        </div>
      </div>
    </div>
  `;
}

function renderVariant(postId, variant, selected) {
  const isSelected = variant.num === selected;
  
  return `
    <div class="variant ${isSelected ? 'selected' : ''}" 
         data-variant="${variant.num}" 
         data-post-id="${postId}">
      <div class="controls">
        <span class="title">Variant ${variant.num}</span>
        <div class="rightCtrls">
          ${isSelected ? '<span class="chip editedBadge">Selected</span>' : ''}
          <button class="btn clear btn-sm editBtn" data-action="edit-variant" 
                  data-post-id="${postId}" data-variant="${variant.num}">Edit</button>
        </div>
      </div>
      <div class="text" data-variant-text="${variant.num}">${escapeHtml(variant.text)}</div>
    </div>
  `;
}

function renderImageCell(postId, image, selected) {
  const isSelected = image.num === selected;
  const imageUrl = convertGoogleDriveUrl(image.url);
  const sourceLabel = image.source === 'drive' ? 'Drive' : 'AI';
  
  return `
    <div class="imgCell ${isSelected ? 'selected' : ''}" 
         data-image="${image.num}" 
         data-post-id="${postId}"
         data-source="${image.source || 'stability'}">
      <div class="selectBadge">${window.Icons ? window.Icons.get('success', '', { size: '14px' }) : '✓'}</div>
      <div class="numberBadge">${image.num}</div>
      <div class="sourceBadge" style="position: absolute; top: 4px; right: 4px; background: ${image.source === 'drive' ? '#4285f4' : '#6366f1'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; z-index: 2;">${sourceLabel}</div>
      <img src="${imageUrl}" alt="Image ${image.num} (${sourceLabel})" 
           onerror="this.parentElement.innerHTML='<div class=\\'imgError\\'>Image unavailable</div>'">
      <a class="imgOverlay" href="${imageUrl}" target="_blank" rel="noopener">View Full</a>
    </div>
  `;
}

function renderEmptyState(title, description, action = '') {
  return `
    <div class="emptyState">
      <h2>${title}</h2>
      <p>${description}</p>
      ${action}
    </div>
  `;
}

function renderSkeletonCards(count = 3) {
  return Array(count).fill(0).map(() => `
    <div class="skeleton-card">
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <div class="skeleton skeleton-line" style="width: 80px; height: 24px; border-radius: 12px;"></div>
        <div class="skeleton skeleton-line" style="width: 100px; height: 24px; border-radius: 12px;"></div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 300px; gap: 16px;">
        <div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line medium"></div>
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line medium"></div>
        </div>
        <div>
          <div class="skeleton skeleton-image"></div>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function attachCardEventListeners() {
  const container = document.getElementById('contentCards');
  
  // Variant selection
  container.querySelectorAll('.variant').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('textarea')) return;
      handleVariantSelect(el);
    });
  });
  
  // Image selection
  container.querySelectorAll('.imgCell').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      handleImageSelect(el);
    });
  });
  
  // Action buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', handleActionClick);
  });
  
  // Schedule inputs
  container.querySelectorAll('.scheduleInput').forEach(input => {
    input.addEventListener('change', handleScheduleChange);
  });
  
  // Image upload
  container.querySelectorAll('[data-upload-post]').forEach(input => {
    input.addEventListener('change', handleImageUpload);
  });
  
  // Bulk select checkboxes
  container.querySelectorAll('.bulk-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const postId = e.target.dataset.postId;
      toggleBulkSelect(postId);
    });
  });
}

async function handleVariantSelect(el) {
  const postId = el.dataset.postId;
  const variantNum = parseInt(el.dataset.variant);
  
  try {
    await API.posts.updateChoices(postId, { selected_variant: variantNum });
    
    // Update UI
    const card = el.closest('.card');
    card.querySelectorAll('.variant').forEach(v => {
      v.classList.toggle('selected', parseInt(v.dataset.variant) === variantNum);
    });
    
    showToast(`Variant ${variantNum} selected`, 'ok');
  } catch (error) {
    showToast('Failed to update selection', 'bad');
  }
}

async function handleImageSelect(el) {
  const postId = el.dataset.postId;
  const imageNum = parseInt(el.dataset.image);
  const imageSource = el.dataset.source;
  const imageUrl = el.querySelector('img')?.src;
  
  // If it's a Drive image (4-6), include the URL
  const updateData = { selected_image: imageNum };
  if (imageSource === 'drive' && imageUrl) {
    updateData.drive_image_url = imageUrl;
  }
  
  try {
    await API.posts.updateChoices(postId, updateData);
    
    // Update UI
    const card = el.closest('.card');
    card.querySelectorAll('.imgCell').forEach(img => {
      img.classList.toggle('selected', parseInt(img.dataset.image) === imageNum);
    });
    
    const sourceLabel = imageSource === 'drive' ? 'Drive' : 'AI';
    showToast(`Image ${imageNum} (${sourceLabel}) selected`, 'ok');
  } catch (error) {
    showToast('Failed to update selection', 'bad');
  }
}

async function handleActionClick(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const postId = btn.dataset.postId;
  const variantNum = btn.dataset.variant;
  
  switch (action) {
    case 'approve':
      await handleApprove(postId);
      break;
    case 'reject':
      await handleReject(postId);
      break;
    case 'edit-variant':
      handleEditVariant(postId, variantNum);
      break;
    case 'preview':
      showPreview(postId);
      break;
  }
}

async function handleApprove(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const scheduleInput = card.querySelector('.scheduleInput');
  const scheduledDate = scheduleInput?.value;
  
  if (!scheduledDate) {
    showToast('Please select a schedule date', 'bad');
    scheduleInput?.focus();
    return;
  }
  
  try {
    card.classList.add('processing');
    document.body.classList.add('processing');
    
    await API.posts.updateStatus(postId, 'Scheduled');
    await API.posts.reschedule(postId, scheduledDate);
    
    // Success animation
    card.classList.remove('processing');
    card.classList.add('success');
    
    showToast('Post approved and scheduled!', 'ok');
    clearCache('generated');
    clearCache('scheduled');
    updateBadges();
    
    setTimeout(() => {
      loadContent(true);
    }, 500);
  } catch (error) {
    showToast('Failed to approve post', 'bad');
    card.classList.remove('processing');
  } finally {
    document.body.classList.remove('processing');
  }
}

async function handleReject(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  
  try {
    card.classList.add('processing');
    document.body.classList.add('processing');
    
    await API.posts.updateStatus(postId, 'rejected');
    
    showToast('Post rejected', 'neutral');
    clearCache('generated');
    clearCache('rejected');
    loadContent(true);
  } catch (error) {
    showToast('Failed to reject post', 'bad');
  } finally {
    card.classList.remove('processing');
    document.body.classList.remove('processing');
  }
}

function handleEditVariant(postId, variantNum) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const variant = card.querySelector(`.variant[data-variant="${variantNum}"]`);
  const textEl = variant.querySelector('.text');
  const currentText = textEl.textContent;
  
  // Replace with textarea
  textEl.style.display = 'none';
  
  const editContainer = document.createElement('div');
  editContainer.className = 'editContainer';
  editContainer.innerHTML = `
    <textarea class="variantTextarea">${escapeHtml(currentText)}</textarea>
    <div class="editActions">
      <button class="btn approve btn-sm" data-save>Save</button>
      <button class="btn clear btn-sm" data-cancel>Cancel</button>
    </div>
  `;
  
  variant.appendChild(editContainer);
  
  const textarea = editContainer.querySelector('textarea');
  textarea.focus();
  
  // Save handler
  editContainer.querySelector('[data-save]').addEventListener('click', async () => {
    const newText = textarea.value.trim();
    if (!newText) {
      showToast('Variant text cannot be empty', 'bad');
      return;
    }
    
    try {
      await API.posts.updateVariant(postId, {
        variant_number: parseInt(variantNum),
        text: newText
      });
      
      textEl.textContent = newText;
      editContainer.remove();
      textEl.style.display = '';
      showToast('Variant updated', 'ok');
    } catch (error) {
      showToast('Failed to save variant', 'bad');
    }
  });
  
  // Cancel handler
  editContainer.querySelector('[data-cancel]').addEventListener('click', () => {
    editContainer.remove();
    textEl.style.display = '';
  });
}

async function handleScheduleChange(e) {
  const input = e.target;
  const postId = input.dataset.schedulePost;
  const newDate = input.value;
  
  if (!newDate) return;
  
  // Don't auto-save, just keep the value for when user approves
}

async function handleImageUpload(e) {
  const input = e.target;
  const postId = input.dataset.uploadPost;
  const file = input.files[0];
  
  if (!file) return;
  
  // Validate file
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'bad');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showToast('Image must be less than 10MB', 'bad');
    return;
  }
  
  try {
    showLoader();
    const result = await API.workflow.uploadImage(file, postId);
    showToast('Image uploaded successfully', 'ok');
    clearCache('generated');
    loadContent(true);
  } catch (error) {
    showToast('Failed to upload image', 'bad');
  } finally {
    hideLoader();
    input.value = '';
  }
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

function handleContentKeyboard(e) {
  const cards = document.querySelectorAll('.card');
  if (cards.length === 0) return;
  
  // Get focused card or first card
  let focusedCard = document.querySelector('.card.focused') || cards[0];
  const postId = focusedCard.dataset.postId;
  
  switch (e.key) {
    case '1':
    case '2':
    case '3':
      e.preventDefault();
      const variantEl = focusedCard.querySelector(`.variant[data-variant="${e.key}"]`);
      if (variantEl) handleVariantSelect(variantEl);
      break;
    case 'a':
    case 'A':
      e.preventDefault();
      handleApprove(postId);
      break;
    case 'r':
    case 'R':
      e.preventDefault();
      handleReject(postId);
      break;
    case 'e':
    case 'E':
      e.preventDefault();
      const selectedVariant = focusedCard.querySelector('.variant.selected')?.dataset.variant || '1';
      handleEditVariant(postId, selectedVariant);
      break;
    case 'ArrowDown':
      e.preventDefault();
      navigateCards(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      navigateCards(-1);
      break;
  }
}

function navigateCards(direction) {
  const cards = Array.from(document.querySelectorAll('.card'));
  if (cards.length === 0) return;
  
  const focused = document.querySelector('.card.focused');
  let currentIdx = focused ? cards.indexOf(focused) : -1;
  
  cards.forEach(c => c.classList.remove('focused'));
  
  let newIdx = currentIdx + direction;
  if (newIdx < 0) newIdx = 0;
  if (newIdx >= cards.length) newIdx = cards.length - 1;
  
  cards[newIdx].classList.add('focused');
  cards[newIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================================
// CONTENT GENERATION
// ============================================================

async function triggerGeneration() {
  try {
    showLoader();
    showToast('Starting content generation...', 'neutral');
    
    const result = await API.workflow.generate(10);
    
    if (result.sessionId) {
      showToast(`Generation started for ${result.queued || 0} posts`, 'ok');
      pollGenerationStatus(result.sessionId);
    }
  } catch (error) {
    showToast(error.message || 'Failed to start generation', 'bad');
    hideLoader();
  }
}

async function pollGenerationStatus(sessionId) {
  const maxAttempts = 60; // 5 minutes with 5s interval
  let attempts = 0;
  
  const poll = async () => {
    try {
      const status = await API.workflow.session(sessionId);
      
      if (status.status === 'completed') {
        hideLoader();
        hideGenerationProgress();
        showToast('Content generation completed!', 'ok');
        clearCache('generated');
        loadContent(true);
        updateBadges();
        return;
      }
      
      if (status.status === 'failed') {
        hideLoader();
        hideGenerationProgress();
        showToast('Generation failed: ' + (status.error || 'Unknown error'), 'bad');
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        hideLoader();
        hideGenerationProgress();
        showToast('Generation taking too long, check back later', 'neutral');
        return;
      }
      
      // Update progress UI
      if (status.completed !== undefined && status.total !== undefined) {
        showGenerationProgress(status.completed, status.total, `Processing post ${status.completed + 1} of ${status.total}...`);
      }
      
      setTimeout(poll, 5000);
    } catch (error) {
      hideLoader();
      hideGenerationProgress();
      showToast('Failed to check generation status', 'bad');
    }
  };
  
  poll();
}

// Make functions globally available
window.loadContent = loadContent;
window.handleContentKeyboard = handleContentKeyboard;
window.triggerGeneration = triggerGeneration;