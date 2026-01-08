/**
 * Bin Tab Module
 * Displays rejected posts with restore functionality
 */

// ============================================================
// BIN LOADING
// ============================================================

async function loadBin(forceRefresh = false) {
  const container = document.getElementById('binWrap');
  
  // Check cache
  if (!forceRefresh && isCacheValid('rejected')) {
    const cached = getCache('rejected');
    if (cached) {
      renderBin(cached);
      return;
    }
  }
  
  try {
    container.innerHTML = '<div class="initial"><div class="spinner-container"><div class="spinner"></div></div><p>Loading bin...</p></div>';
    
    const result = await API.posts.getRejected();
    window.AppState.rejectedPosts = result.posts || [];
    setCache('rejected', result.posts);
    
    renderBin(result.posts);
  } catch (error) {
    console.error('Failed to load bin:', error);
    showToast('Failed to load bin', 'bad');
    container.innerHTML = '<div class="emptyState"><h2>Error</h2><p>Failed to load rejected posts.</p></div>';
  }
}

// ============================================================
// BIN RENDERING
// ============================================================

function renderBin(posts) {
  const container = document.getElementById('binWrap');
  
  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="emptyState">
        <h2>Bin is Empty</h2>
        <p>Rejected posts will appear here for recovery.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="bin-header">
      <p>${posts.length} rejected post${posts.length === 1 ? '' : 's'}</p>
    </div>
    <div class="bin-list">
      ${posts.map(post => renderBinItem(post)).join('')}
    </div>
  `;
  
  // Attach event listeners
  attachBinEventListeners();
}

function renderBinItem(post) {
  const variantNum = post.selected_variant || 1;
  const variantText = post[`variant_${variantNum}`] || post.instruction || '';
  const truncatedText = variantText.length > 200 ? variantText.substring(0, 200) + '...' : variantText;
  
  return `
    <div class="bin-item card" data-post-id="${post.id}">
      <header>
        <div class="left">
          <span class="chip">${escapeHtml(post.post_id)}</span>
          <span class="chip">${escapeHtml(post.type || 'General')}</span>
          <span class="chip status-bad">Rejected</span>
        </div>
      </header>
      <div class="bin-content" style="padding: 16px;">
        <p style="margin: 0 0 12px; color: #666; font-size: 14px;">${escapeHtml(truncatedText)}</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn undo" data-action="restore" data-post-id="${post.id}">
            Restore
          </button>
          <button class="btn reject" data-action="delete" data-post-id="${post.id}">
            <span class="ico"></span> Delete Permanently
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function attachBinEventListeners() {
  document.querySelectorAll('.bin-item [data-action]').forEach(btn => {
    btn.addEventListener('click', handleBinAction);
  });
}

async function handleBinAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const postId = btn.dataset.postId;
  
  switch (action) {
    case 'restore':
      await handleRestore(postId);
      break;
    case 'delete':
      await handlePermanentDelete(postId);
      break;
  }
}

async function handleRestore(postId) {
  try {
    showLoader();
    await API.posts.restore(postId);
    
    showToast('Post restored', 'ok');
    clearCache('rejected');
    clearCache('generated');
    loadBin(true);
  } catch (error) {
    showToast('Failed to restore post', 'bad');
  } finally {
    hideLoader();
  }
}

async function handlePermanentDelete(postId) {
  if (!confirm('Are you sure you want to permanently delete this post? This cannot be undone.')) {
    return;
  }
  
  try {
    showLoader();
    await API.posts.delete(postId);
    
    showToast('Post deleted permanently', 'neutral');
    clearCache('rejected');
    loadBin(true);
  } catch (error) {
    showToast('Failed to delete post', 'bad');
  } finally {
    hideLoader();
  }
}

// Make functions globally available
window.loadBin = loadBin;

// Additional styles for bin
const binStyles = document.createElement('style');
binStyles.textContent = `
  .bin-header {
    padding: 16px;
    border-bottom: 1px solid var(--bd);
    background: #fafafa;
    margin-bottom: 16px;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  
  .bin-header p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }
  
  .bin-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .bin-item {
    margin-bottom: 0;
  }
`;
document.head.appendChild(binStyles);
