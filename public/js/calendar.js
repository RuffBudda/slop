/**
 * Calendar Tab Module
 * Displays scheduled posts in a calendar view
 */

// ============================================================
// CALENDAR LOADING
// ============================================================

async function loadCalendar(forceRefresh = false) {
  const container = document.getElementById('calendarContainer');
  
  // Check cache
  if (!forceRefresh && isCacheValid('scheduled')) {
    const cached = getCache('scheduled');
    if (cached) {
      window.AppState.scheduledPosts = cached;
      renderCalendar();
      return;
    }
  }
  
  try {
    container.innerHTML = '<div class="initial"><div class="spinner-container"><div class="spinner"></div></div><p>Loading calendar...</p></div>';
    
    const result = await API.posts.getScheduled();
    window.AppState.scheduledPosts = result.posts || [];
    setCache('scheduled', result.posts);
    
    renderCalendar();
  } catch (error) {
    console.error('Failed to load calendar:', error);
    showToast('Failed to load calendar', 'bad');
    // Still render calendar outline even on error
    renderCalendar();
  }
}

// ============================================================
// CALENDAR RENDERING
// ============================================================

function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  const { calMonth, calYear, scheduledPosts } = window.AppState;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Get first day of month and number of days
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  
  // Group posts by date
  const postsByDate = {};
  scheduledPosts.forEach(post => {
    if (post.scheduled_date) {
      const date = new Date(post.scheduled_date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!postsByDate[key]) postsByDate[key] = [];
      postsByDate[key].push(post);
    }
  });
  
  // Build calendar HTML
  let html = `
    <div class="calHeader">
      <button class="btn clear btn-sm" id="calPrev">← Previous</button>
      <span class="title">${monthNames[calMonth]} ${calYear}</span>
      <button class="btn clear btn-sm" id="calNext">Next →</button>
    </div>
    <div class="calGrid">
      ${dayNames.map(d => `<div class="calDow">${d}</div>`).join('')}
  `;
  
  // Empty cells for days before first of month
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calCell empty"></div>';
  }
  
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calYear, calMonth, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isToday = date.toDateString() === today.toDateString();
    const key = `${calYear}-${calMonth}-${day}`;
    const dayPosts = postsByDate[key] || [];
    
    let cellClass = 'calCell';
    if (isWeekend) cellClass += ' weekend';
    if (isToday) cellClass += ' today';
    
    html += `
      <div class="${cellClass}" 
           data-date="${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}"
           ondragover="handleDragOver(event)"
           ondrop="handleDrop(event)">
        <div class="dt">${day}</div>
        ${dayPosts.map(post => `
          <div class="ev" 
               draggable="true"
               data-post-id="${post.id}"
               ondragstart="handleDragStart(event)"
               title="${escapeHtml(post.instruction || post.post_id)}">
            ${formatTime(post.scheduled_date)}
          </div>
        `).join('')}
      </div>
    `;
  }
  
  html += '</div>';
  container.innerHTML = html;
  
  // Attach event listeners
  attachCalendarEventListeners();
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function attachCalendarEventListeners() {
  // Navigation
  document.getElementById('calPrev')?.addEventListener('click', () => {
    window.AppState.calMonth--;
    if (window.AppState.calMonth < 0) {
      window.AppState.calMonth = 11;
      window.AppState.calYear--;
    }
    renderCalendar();
  });
  
  document.getElementById('calNext')?.addEventListener('click', () => {
    window.AppState.calMonth++;
    if (window.AppState.calMonth > 11) {
      window.AppState.calMonth = 0;
      window.AppState.calYear++;
    }
    renderCalendar();
  });
  
  // Event clicks
  document.querySelectorAll('.ev').forEach(ev => {
    ev.addEventListener('click', (e) => {
      const postId = e.currentTarget.dataset.postId;
      showRescheduleModal(postId);
    });
  });
}

// ============================================================
// DRAG AND DROP
// ============================================================

let draggedPostId = null;

function handleDragStart(e) {
  draggedPostId = e.target.dataset.postId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e) {
  e.preventDefault();
  
  const cell = e.target.closest('.calCell');
  if (!cell || !draggedPostId) return;
  
  const newDate = cell.dataset.date;
  if (!newDate) return;
  
  // Get current time from the post or default to noon
  const post = window.AppState.scheduledPosts.find(p => p.id == draggedPostId);
  let time = '12:00';
  if (post?.scheduled_date) {
    const oldDate = new Date(post.scheduled_date);
    time = `${String(oldDate.getHours()).padStart(2, '0')}:${String(oldDate.getMinutes()).padStart(2, '0')}`;
  }
  
  const newDateTime = `${newDate}T${time}:00`;
  
  try {
    showLoader();
    await API.posts.reschedule(draggedPostId, newDateTime);
    
    // Clear drag state
    document.querySelectorAll('.ev.dragging').forEach(el => el.classList.remove('dragging'));
    draggedPostId = null;
    
    showToast('Post rescheduled', 'ok');
    clearCache('scheduled');
    loadCalendar(true);
  } catch (error) {
    showToast('Failed to reschedule', 'bad');
  } finally {
    hideLoader();
  }
}

// Make drag functions global
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;

// ============================================================
// RESCHEDULE MODAL
// ============================================================

function initRescheduleModal() {
  const modal = document.getElementById('rescheduleModal');
  const cancelBtn = document.getElementById('rescheduleCancel');
  const confirmBtn = document.getElementById('rescheduleConfirm');
  
  cancelBtn?.addEventListener('click', () => {
    modal.close();
    window.AppState.modalCtx = null;
  });
  
  confirmBtn?.addEventListener('click', async () => {
    const input = document.getElementById('rescheduleDate');
    const newDate = input.value;
    
    if (!newDate) {
      showToast('Please select a date and time', 'bad');
      return;
    }
    
    const postId = window.AppState.modalCtx?.postId;
    if (!postId) return;
    
    try {
      showLoader();
      await API.posts.reschedule(postId, newDate);
      
      modal.close();
      window.AppState.modalCtx = null;
      
      showToast('Post rescheduled', 'ok');
      clearCache('scheduled');
      loadCalendar(true);
    } catch (error) {
      showToast('Failed to reschedule', 'bad');
    } finally {
      hideLoader();
    }
  });
  
  // Close on backdrop click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.close();
      window.AppState.modalCtx = null;
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initRescheduleModal);

// Make functions globally available
window.loadCalendar = loadCalendar;
