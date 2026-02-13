// ========== GLOBAL ERROR HANDLER ==========
// Suppress focus() errors and other non-critical DOM errors
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('focus')) {
    console.warn('Ignoring focus error:', event.message);
    event.preventDefault();
    return true;
  }
  // Log other errors but don't crash
  console.error('Application error:', event.error);
  return false;
});

// Suppress unhandled promise rejections from focus errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('focus')) {
    event.preventDefault();
    console.warn('Ignoring focus promise rejection');
  }
});

// Global state
let currentUser = null;
let currentUserAvatar = null;
let allCourses = [];
let allCoursesFullData = {}; // Store full course data for all courses
let courseData = null;
let currentCourseId = 1;
let userProgress = []; // Progress for current course
let allUserProgress = []; // All progress across all courses
let userSettings = {};
let currentVideoId = null;
let currentSectionId = null;
let currentSectionName = null;
let player = null;
let videoWatchProgress = 0;
let videoTotalDuration = 0;
let userCurrentLevel = 1; // Track current level for level-up detection

// API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(endpoint, options);
  if (!response.ok) {
    if (response.status === 401) {
      handleLogout();
      throw new Error('Unauthorized');
    }
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

// ========== LOGIN & AUTH ==========
function discordLogin() {
  window.location.href = '/api/auth/discord';
}

function handleLogout() {
  localStorage.removeItem('token');
  currentUser = null;
  courseData = null;
  allCourses = [];
  try {
    const form = document.getElementById('loginForm');
    if (form) form.reset();
  } catch (e) {
    // Ignore errors
  }
  showLoginScreen(true);
}

// ========== UI UTILITIES ==========
function showLoginScreen(show) {
  try {
    const loginScreen = document.getElementById('loginScreen');
    const appLayout = document.getElementById('appLayout');
    
    if (show) {
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (appLayout) appLayout.classList.remove('visible');
      // Don't try to focus - it causes errors
    } else {
      if (loginScreen) loginScreen.classList.add('hidden');
      if (appLayout) appLayout.classList.add('visible');
    }
  } catch (e) {
    console.error('Error in showLoginScreen:', e);
  }
}

function showError(message) {
  try {
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.classList.add('show');
    }
  } catch (e) {
    console.error('Error displaying error message:', e);
  }
}

function showToast(message) {
  try {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      try {
        toast.remove();
      } catch (e) {}
    }, 3000);
  } catch (e) {
    console.error('Error showing toast:', e);
  }
}

function toggleSidebar() {
  try {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  } catch (e) {
    console.error('Error toggling sidebar:', e);
  }
}

// ========== UTILITIES ==========
// Calculate level based on videos watched (+2, +3, +4, +5, +6...)
function calculateLevel(videosWatched) {
  let level = 1;
  let cumulative = 0;
  let increment = 2;
  
  while (cumulative + increment <= videosWatched) {
    cumulative += increment;
    increment++;
    level++;
  }
  
  return level;
}

// Get progress to next level
function getProgressToNextLevel(videosWatched) {
  let level = 1;
  let cumulative = 0;
  let increment = 2;
  
  while (cumulative + increment <= videosWatched) {
    cumulative += increment;
    increment++;
    level++;
  }
  
  const needed = cumulative + increment;
  const current = videosWatched;
  const progress = ((current - cumulative) / increment) * 100;
  
  return { current: current - cumulative, needed: increment, progress: Math.min(progress, 100) };
}

async function login() {
  try {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }
    
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      showError(error.error || 'Login failed');
      return;
    }
    
    const data = await response.json();
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    
    // Redirect to app
    window.location.reload();
  } catch (error) {
    console.error('Login error:', error);
    showError('Login failed: ' + error.message);
  }
}

async function loadAllCourses() {
  try {
    allCourses = await apiCall('/api/courses');
    allCoursesFullData = {};
    
    for (const course of allCourses) {
      allCoursesFullData[course.id] = course;
    }
  } catch (error) {
    console.error('Error loading courses:', error);
    showToast('Failed to load courses');
  }
}

async function loadCourse(courseId) {
  try {
    if (!allCoursesFullData[courseId]) {
      await loadAllCourses();
    }
    
    courseData = allCoursesFullData[courseId];
    currentCourseId = courseId;
    await loadProgress(courseId);
  } catch (error) {
    console.error('Error loading course:', error);
    showToast('Failed to load course');
  }
}

async function loadProgress(courseId) {
  try {
    userProgress = await apiCall(`/api/progress/${courseId}`);
    
    // Also load all progress for level calculation
    const allCourses = await apiCall('/api/courses');
    allUserProgress = [];
    
    for (const course of allCourses) {
      const progress = await apiCall(`/api/progress/${course.id}`);
      allUserProgress = allUserProgress.concat(progress);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
}

async function markVideoWatched(courseId, sectionId, videoId) {
  try {
    await apiCall('/api/progress', 'POST', {
      courseId,
      sectionId,
      videoId
    });
    
    await loadProgress(courseId);
    updateProgressUI();
    
    const totalCompleted = allUserProgress.filter(p => p.completed).length;
    const newLevel = calculateLevel(totalCompleted);
    
    if (newLevel > userCurrentLevel) {
      userCurrentLevel = newLevel;
      showLevelUpPopup(newLevel);
    }
  } catch (error) {
    console.error('Error marking video watched:', error);
  }
}

async function markCourseComplete(courseId) {
  try {
    await apiCall('/api/completion', 'POST', { courseId });
    showToast('Course completed! 🎉');
  } catch (error) {
    console.error('Error completing course:', error);
    showToast('Failed to mark course complete');
  }
}

async function loadUserSettings() {
  // Placeholder - settings would be loaded from API
  userSettings = { theme: 'light' };
}

async function loadUserAvatar() {
  try {
    const user = await apiCall('/api/user');
    currentUserAvatar = user.avatar_url;
  } catch (error) {
    console.error('Error loading user avatar:', error);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function updateUserInfo() {
  try {
    const userNameEl = document.getElementById('userName');
    if (userNameEl && currentUser) {
      userNameEl.textContent = currentUser.name || currentUser.username;
    }
  } catch (e) {
    console.error('Error updating user info:', e);
  }
}

function restoreSidebar() {
  try {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
    }
  } catch (e) {
    console.error('Error restoring sidebar:', e);
  }
}

function updateNavHighlight(section) {
  try {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-section="${section}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  } catch (e) {
    console.error('Error updating nav:', e);
  }
}

// Show sections
function showHome() {
  try {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const homeSection = document.getElementById('homeSection');
    if (homeSection) homeSection.classList.remove('hidden');
    updateProgressUI();
  } catch (e) {
    console.error('Error showing home:', e);
  }
}

function showCourses() {
  try {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const coursesSection = document.getElementById('coursesSection');
    if (coursesSection) coursesSection.classList.remove('hidden');
    renderCourses();
  } catch (e) {
    console.error('Error showing courses:', e);
  }
}

function showCourse(courseId) {
  try {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    const courseSection = document.getElementById('courseSection');
    if (courseSection) courseSection.classList.remove('hidden');
    renderCourseContent();
  } catch (e) {
    console.error('Error showing course:', e);
  }
}

function renderCourses() {
  try {
    const coursesGrid = document.getElementById('coursesGrid');
    if (!coursesGrid) return;
    
    coursesGrid.innerHTML = allCourses.map(course => `
      <div class="course-card" onclick="handleCourseSelect(${course.id})">
        <div class="course-icon">${course.icon}</div>
        <h3>${course.name}</h3>
        <p>${course.sections.length} sections</p>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error rendering courses:', e);
  }
}

function handleCourseSelect(courseId) {
  try {
    loadCourse(courseId);
    showCourse(courseId);
    updateNavHighlight('course');
  } catch (e) {
    console.error('Error selecting course:', e);
  }
}

function renderCourseContent() {
  // Render course content
  if (!courseData) return;
  
  try {
    const courseContent = document.getElementById('courseContent');
    if (!courseContent) return;
    
    courseContent.innerHTML = `
      <h2>${courseData.name}</h2>
      ${courseData.sections.map(section => `
        <div class="section-container">
          <h3>${section.title}</h3>
          ${section.videos.map(video => `
            <div class="video-item" onclick="playVideo(${courseData.id}, ${section.id}, ${video.id})">
              ${video.title}
              ${userProgress.some(p => p.video_id === video.id && p.completed) ? ' ✓' : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  } catch (e) {
    console.error('Error rendering course content:', e);
  }
}

function playVideo(courseId, sectionId, videoId) {
  try {
    const video = courseData.sections
      .find(s => s.id === sectionId)?.videos
      .find(v => v.id === videoId);
    
    if (!video) return;
    
    currentVideoId = videoId;
    currentSectionId = sectionId;
    currentSectionName = courseData.sections.find(s => s.id === sectionId)?.title;
    
    // Show video player
    const playerContainer = document.getElementById('videoPlayer');
    if (playerContainer) {
      playerContainer.innerHTML = `<video controls width="100%" src="${video.url}"></video>`;
      playerContainer.addEventListener('play', () => {
        markVideoWatched(courseId, sectionId, videoId);
      });
    }
  } catch (e) {
    console.error('Error playing video:', e);
  }
}

function updateProgressUI() {
  try {
    const progressContainer = document.getElementById('progressContainer');
    if (!progressContainer || !courseData) return;
    
    const totalVideos = courseData.sections.reduce((sum, s) => sum + s.videos.length, 0);
    const completedVideos = userProgress.filter(p => p.completed).length;
    
    progressContainer.innerHTML = `
      <div class="progress-info">
        <p>${completedVideos} / ${totalVideos} videos watched</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(completedVideos / totalVideos) * 100}%"></div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Error updating progress:', e);
  }
}

function showLevelUpPopup(newLevel) {
  try {
    const popup = document.createElement('div');
    popup.className = 'level-up-popup';
    popup.innerHTML = `
      <div class="level-up-content">
        <div class="level-up-emoji">🎉</div>
        <h2>Level ${newLevel}</h2>
        <p>You've reached a new level!</p>
        <button onclick="this.parentElement.parentElement.remove()">Continue</button>
      </div>
    `;
    document.body.appendChild(popup);
  } catch (e) {
    console.error('Error showing level up popup:', e);
  }
}

// JWT decode function
function jwt_decode(token) {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    throw new Error('Invalid token');
  }
}

// Page initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check for error in URL
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const details = params.get('details');
    
    if (error) {
      console.error('Login error:', error, details);
      let errorMsg = `Login failed: ${error}`;
      if (details) errorMsg += ` - ${details}`;
      showError(errorMsg);
      // Clear URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        currentUser = jwt_decode(token);
        await loadAllCourses();
        await loadCourse(1);
        await Promise.all([loadUserSettings(), loadUserAvatar()]);
        
        const totalCompleted = allUserProgress.filter(p => p.completed).length;
        userCurrentLevel = calculateLevel(totalCompleted);
        
        applyTheme(userSettings.theme || 'light');
        showLoginScreen(false);
        updateUserInfo();
        restoreSidebar();
        updateNavHighlight('home');
        showHome();
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
        showLoginScreen(true);
      }
    } else {
      showLoginScreen(true);
    }
    
    // Close user menu when clicking outside
    document.addEventListener('click', (e) => {
      try {
        const dropdown = document.getElementById('userMenuDropdown');
        if (dropdown && !e.target.closest('.user-menu-wrapper')) {
          dropdown.classList.remove('open');
        }
      } catch (e) {}
    });
  } catch (err) {
    console.error('Initialization error:', err);
    showLoginScreen(true);
  }
});
