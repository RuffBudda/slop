/**
 * Authentication Module
 * Handles login, setup, and logout functionality
 */

// ============================================================
// INITIALIZATION
// ============================================================

async function checkAuthStatus() {
  try {
    const result = await API.auth.status();
    
    if (result.setupRequired) {
      showSetupPage();
      return false;
    }
    
    if (result.authenticated) {
      window.AppState.user = result.user;
      return true;
    }
    
    showLoginPage();
    return false;
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginPage();
    return false;
  }
}

function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('setupPage').classList.add('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  const dock = document.getElementById('dock');
  if (dock) dock.classList.add('hidden');
  hideAppLoader();
  
  // Load saved username if "Remember me" was checked
  const savedUsername = localStorage.getItem('slop_remembered_username');
  const rememberMe = localStorage.getItem('slop_remember_me') === 'true';
  if (savedUsername && rememberMe) {
    const usernameInput = document.getElementById('loginUsername');
    if (usernameInput) {
      usernameInput.value = savedUsername;
    }
    const rememberMeCheckbox = document.getElementById('rememberMe');
    if (rememberMeCheckbox) {
      rememberMeCheckbox.checked = true;
    }
  }
  
  // Initialize password visibility toggles
  initLoginPasswordToggles();
}

function initLoginPasswordToggles() {
  const passwordField = document.getElementById('loginPassword');
  if (!passwordField) return;
  
  // Check if already has toggle
  if (passwordField.parentElement.classList.contains('password-input-wrapper')) {
    const toggle = passwordField.parentElement.querySelector('.password-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isPassword = passwordField.type === 'password';
        passwordField.type = isPassword ? 'text' : 'password';
        toggle.innerHTML = isPassword ? '🙈' : '👁️';
      });
    }
    return;
  }
  
  // Create wrapper and toggle if needed
  const wrapper = document.createElement('div');
  wrapper.className = 'password-input-wrapper';
  
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'password-toggle';
  toggle.setAttribute('aria-label', 'Toggle password visibility');
  toggle.innerHTML = '👁️';
  
  passwordField.parentNode.insertBefore(wrapper, passwordField);
  wrapper.appendChild(passwordField);
  wrapper.appendChild(toggle);
  
  toggle.addEventListener('click', () => {
    const isPassword = passwordField.type === 'password';
    passwordField.type = isPassword ? 'text' : 'password';
    toggle.innerHTML = isPassword ? '🙈' : '👁️';
  });
}

function showSetupPage() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('setupPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  const dock = document.getElementById('dock');
  if (dock) dock.classList.add('hidden');
  hideAppLoader();
}

function showMainApp() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('setupPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  const dock = document.getElementById('dock');
  if (dock) dock.classList.remove('hidden');
  hideAppLoader();
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function initAuthEventHandlers() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Setup form
  const setupForm = document.getElementById('setupForm');
  if (setupForm) {
    setupForm.addEventListener('submit', handleSetup);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  const rememberMe = form.rememberMe?.checked || false;
  
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:handleLogin-entry',message:'Login form submitted',data:{usernameLength:username?.length||0,passwordLength:password?.length||0,usernameValue:username,hasUsername:!!username,hasPassword:!!password},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  if (!username || !password) {
    showToast('Please enter username and password', 'bad');
    return;
  }
  
  try {
    showLoader();
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:before-api-call',message:'About to call API.auth.login',data:{username,passwordLength:password.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    const result = await API.auth.login(username, password);
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:api-success',message:'API call succeeded',data:{hasUser:!!result.user,userId:result.user?.id,username:result.user?.username},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    if (result.user) {
      // Save username if "Remember me" is checked
      if (rememberMe) {
        localStorage.setItem('slop_remembered_username', username);
        localStorage.setItem('slop_remember_me', 'true');
      } else {
        localStorage.removeItem('slop_remembered_username');
        localStorage.removeItem('slop_remember_me');
      }
      
      window.AppState.user = result.user;
      showToast('Welcome back!', 'ok');
      showMainApp();
      initApp();
    }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/ac1d92ae-f147-4a05-bb78-414fb2d198b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.js:api-error',message:'API call failed',data:{errorMessage:error.message,errorName:error.name,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    showToast(error.message || 'Login failed', 'bad');
  } finally {
    hideLoader();
  }
}

async function handleSetup(e) {
  e.preventDefault();
  
  const form = e.target;
  const data = {
    username: form.username.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    displayName: form.displayName.value.trim() || undefined
  };
  
  if (!data.username || !data.email || !data.password) {
    showToast('Please fill in all required fields', 'bad');
    return;
  }
  
  if (data.password.length < 8) {
    showToast('Password must be at least 8 characters', 'bad');
    return;
  }
  
  try {
    showLoader();
    const result = await API.auth.setup(data);
    
    if (result.user) {
      window.AppState.user = result.user;
      showToast('Account created! Welcome to SLOP!', 'ok');
      showMainApp();
      initApp();
    }
  } catch (error) {
    showToast(error.message || 'Setup failed', 'bad');
  } finally {
    hideLoader();
  }
}

async function handleLogout() {
  try {
    await API.auth.logout();
    window.AppState.user = null;
    clearCache();
    showToast('Logged out successfully', 'ok');
    showLoginPage();
  } catch (error) {
    showToast('Logout failed', 'bad');
  }
}

// Initialize auth handlers when DOM is ready
document.addEventListener('DOMContentLoaded', initAuthEventHandlers);
