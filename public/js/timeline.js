/**
 * Timeline/List Tab Module
 * Displays scheduled posts in a list view
 */

// ============================================================
// TIMELINE LOADING
// ============================================================

async function loadTimeline(forceRefresh = false) {
  const container = document.getElementById('timelineContainer');
  
  // Check cache (reuse scheduled cache)
  if (!forceRefresh && isCacheValid('scheduled')) {
    const cached = getCache('scheduled');
    if (cached) {
      renderTimeline(cached);
      return;
    }
  }
  
  try {
    container.innerHTML = '<div class="initial"><div class="spinner-container"><div class="spinner"></div></div><p>Loading timeline...</p></div>';
    
    const result = await API.posts.getScheduled();
    window.AppState.scheduledPosts = result.posts || [];
    setCache('scheduled', result.posts);
    
    renderTimeline(result.posts);
  } catch (error) {
    console.error('Failed to load timeline:', error);
    showToast('Failed to load timeline', 'bad');
    container.innerHTML = '<div class="emptyState"><h2>Error</h2><p>Failed to load scheduled posts.</p></div>';
  }
}

// ============================================================
// TIMELINE RENDERING
// ============================================================

function renderTimeline(posts) {
  const container = document.getElementById('timelineContainer');
  
  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="emptyState">
        <h2>No Scheduled Posts</h2>
        <p>Approve posts from the Content tab to see them here.</p>
      </div>
    `;
    return;
  }
  
  // Sort by scheduled date
  const sorted = [...posts].sort((a, b) => {
    const dateA = new Date(a.scheduled_date || 0);
    const dateB = new Date(b.scheduled_date || 0);
    return dateA - dateB;
  });
  
  container.innerHTML = sorted.map(post => renderTimelineRow(post)).join('');
  
  // Attach event listeners
  attachTimelineEventListeners();
}

function renderTimelineRow(post) {
  const scheduledDate = post.scheduled_date ? new Date(post.scheduled_date) : null;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  let dateDisplay = 'Not scheduled';
  let timeDisplay = '';
  let dayDisplay = '';
  
  if (scheduledDate) {
    dayDisplay = dayNames[scheduledDate.getDay()];
    dateDisplay = `${monthNames[scheduledDate.getMonth()]} ${scheduledDate.getDate()}`;
    timeDisplay = formatTime(post.scheduled_date);
  }
  
  // Get selected variant text
  const variantNum = post.selected_variant || 1;
  const variantText = post[`variant_${variantNum}`] || '';
  const truncatedText = variantText.length > 150 ? variantText.substring(0, 150) + '...' : variantText;
  
  // Get images
  const images = [post.image_1, post.image_2, post.image_3].filter(Boolean);
  const selectedImage = post.selected_image || 1;
  
  return `
    <div class="tline" data-post-id="${post.id}">
      <div class="tleft">
        <span>${dayDisplay}</span>
        <strong>${dateDisplay}</strong>
        <span>${timeDisplay}</span>
      </div>
      <div class="tright">
        <div class="trowHead">
          <span class="chip">${escapeHtml(post.post_id)}</span>
          <span class="chip">${escapeHtml(post.type || 'General')}</span>
          <span class="chip">V${variantNum}</span>
          <button class="tarrow" data-toggle-details="${post.id}">▼</button>
          <button class="btn clear btn-sm" data-action="reschedule" data-post-id="${post.id}">Reschedule</button>
        </div>
        <div class="trowBody" id="details-${post.id}">
          <div class="text">${escapeHtml(truncatedText)}</div>
          ${images.length > 0 ? `
            <div class="gridImgs grid-${Math.min(images.length, 3)}">
              ${images.map((img, idx) => `
                <img src="${convertGoogleDriveUrl(img)}" 
                     alt="Image ${idx + 1}"
                     class="${idx + 1 === selectedImage ? 'selected' : ''}"
                     onerror="this.style.display='none'">
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function attachTimelineEventListeners() {
  // Toggle details
  document.querySelectorAll('[data-toggle-details]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const postId = e.currentTarget.dataset.toggleDetails;
      const details = document.getElementById(`details-${postId}`);
      const isOpen = details.classList.toggle('show');
      e.currentTarget.textContent = isOpen ? '▲' : '▼';
    });
  });
  
  // Reschedule buttons
  document.querySelectorAll('[data-action="reschedule"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const postId = e.currentTarget.dataset.postId;
      const post = window.AppState.scheduledPosts.find(p => p.id == postId);
      showRescheduleModal(postId, post?.scheduled_date);
    });
  });
}

// Make functions globally available
window.loadTimeline = loadTimeline;
