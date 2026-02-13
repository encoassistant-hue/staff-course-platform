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
  // Safely reset form if it exists
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.reset();
  }
  showLoginScreen(true);
}

// ========== UI UTILITIES ==========
function showLoginScreen(show) {
  const loginScreen = document.getElementById('loginScreen');
  const appLayout = document.getElementById('appLayout');
  
  if (show) {
    loginScreen.classList.remove('hidden');
    appLayout.classList.remove('visible');
    // Safely focus on username field if it exists
    const usernameField = document.getElementById('username');
    if (usernameField) {
      usernameField.focus();
    }
  } else {
    loginScreen.classList.add('hidden');
    appLayout.classList.add('visible');
  }
}

function showError(message) {
  const errorMsg = document.getElementById('errorMessage');
  errorMsg.textContent = message;
  errorMsg.classList.add('show');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// ========== UTILITIES ==========
// Calculate level based on videos watched (+2, +3, +4, +5, +6...)
// Level 1: 0 videos
// Level 2: 2 videos total (cumulative)
// Level 3: 5 videos total (cumulative: 2 + 3)
// Level 4: 9 videos total (cumulative: 2 + 3 + 4)
// Level 5: 14 videos total (cumulative: 2 + 3 + 4 + 5)
function calculateLevel(videosWatched) {
  const thresholds = [0, 2, 5, 9, 14, 20, 27, 35, 44, 54, 65, 77, 90, 104, 119, 135, 152, 170, 189, 209]; // Cumulative thresholds
  
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (videosWatched >= thresholds[i]) {
      return i + 1; // +1 because thresholds[0] is for level 1
    }
  }
  
  return 1;
}

// Calculate progress to next level (0-100%)
function calculateLevelProgress(videosWatched) {
  const thresholds = [0, 2, 5, 9, 14, 20, 27, 35, 44, 54, 65, 77, 90, 104, 119, 135, 152, 170, 189, 209];
  const currentLevel = calculateLevel(videosWatched);
  
  // If at max level, return 100%
  if (currentLevel >= thresholds.length) {
    return 100;
  }
  
  const currentThreshold = thresholds[currentLevel - 1];
  const nextThreshold = thresholds[currentLevel];
  const videosInCurrentLevel = videosWatched - currentThreshold;
  const videosNeededForLevel = nextThreshold - currentThreshold;
  
  return Math.round((videosInCurrentLevel / videosNeededForLevel) * 100);
}

// ========== DATA LOADING ==========
async function loadAllCourses() {
  try {
    allCourses = await apiCall('/api/courses');
    
    // Load full data for each course
    for (const course of allCourses) {
      try {
        const fullCourseData = await apiCall(`/api/course?courseId=${course.id}`);
        allCoursesFullData[course.id] = fullCourseData;
      } catch (error) {
        console.error(`Failed to load full data for course ${course.id}:`, error);
      }
    }
    
    // Load all user progress across all courses
    await loadAllUserProgress();
  } catch (error) {
    console.error('Failed to load courses:', error);
  }
}

async function loadAllUserProgress() {
  try {
    allUserProgress = [];
    for (const course of allCourses) {
      try {
        const courseProgress = await apiCall(`/api/progress?courseId=${course.id}`);
        allUserProgress.push(...courseProgress);
      } catch (error) {
        console.error(`Failed to load progress for course ${course.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to load all user progress:', error);
  }
}

async function loadUserAvatar() {
  try {
    const user = await apiCall('/api/user');
    currentUserAvatar = user.avatar_url;
  } catch (error) {
    console.error('Failed to load user avatar:', error);
  }
}

async function loadCourse(courseId = 1) {
  try {
    currentCourseId = courseId;
    courseData = await apiCall(`/api/course?courseId=${courseId}`);
    userProgress = await apiCall(`/api/progress?courseId=${courseId}`);
  } catch (error) {
    console.error('Failed to load course:', error);
  }
}

async function loadUserSettings() {
  try {
    userSettings = await apiCall('/api/user/settings');
  } catch (error) {
    console.error('Failed to load settings:', error);
    userSettings = {};
  }
}

// ========== USER INFO ==========
function updateUserInfo() {
  if (currentUser) {
    const userBtn = document.getElementById('userAvatarBtn');
    
    if (currentUserAvatar) {
      // Use Discord avatar if available
      userBtn.innerHTML = `<img src="${currentUserAvatar}" alt="${currentUser.name}" onerror="setFallbackAvatar()">`;
    } else {
      // Fallback to emoji avatar
      userBtn.textContent = '👤';
    }
    userBtn.title = currentUser.name;
  }
}

function setFallbackAvatar() {
  document.getElementById('userAvatarBtn').textContent = '👤';
}

// ========== NAVIGATION ==========
function updateNavHighlight(page) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  // Find and highlight the corresponding nav item
  if (page === 'home') {
    navItems[0].classList.add('active');
  } else if (page === 'courses') {
    navItems[1].classList.add('active');
  } else if (page === 'certificates') {
    navItems[2].classList.add('active');
  } else if (page === 'settings') {
    navItems[3].classList.add('active');
  }
}

function updatePageTitle(title) {
  const pageTitle = document.getElementById('pageTitle');
  const navbarLogo = document.getElementById('navbarLogo');
  
  // On mobile (< 768px), show logo; on desktop, show title
  if (window.innerWidth < 768) {
    pageTitle.style.display = 'none';
    navbarLogo.classList.add('visible');
  } else {
    pageTitle.textContent = title;
    pageTitle.style.display = 'block';
    navbarLogo.classList.remove('visible');
  }
}

function restoreSidebar() {
  const sidebar = document.getElementById('sidebar');
  const navSection = sidebar.querySelector('.sidebar-nav');
  navSection.innerHTML = `
    <div class="nav-item active" onclick="showHome()">
      <i class="fas fa-home" style="margin-right: 10px;"></i> Home
    </div>
    <div class="nav-item" onclick="showCourses()">
      <i class="fas fa-book" style="margin-right: 10px;"></i> Courses
    </div>
    <div class="nav-item" onclick="showCertificates()">
      <i class="fas fa-certificate" style="margin-right: 10px;"></i> Certificates
    </div>
    <div class="nav-item" onclick="showSettings()">
      <i class="fas fa-cog" style="margin-right: 10px;"></i> Settings
    </div>
  `;
}

function showHome() {
  restoreSidebar();
  updateNavHighlight('home');
  hideAllSections();
  document.getElementById('homeSection').classList.add('visible');
  updatePageTitle('Dashboard');
  renderCoursesForHome();
  hideSidebar();
}

function showCourses() {
  restoreSidebar();
  updateNavHighlight('courses');
  hideAllSections();
  document.getElementById('coursesSection').classList.add('visible');
  updatePageTitle('My Courses');
  renderCourses();
  hideSidebar();
}

function showCertificates() {
  restoreSidebar();
  updateNavHighlight('certificates');
  hideAllSections();
  document.getElementById('certificatesSection').classList.add('visible');
  updatePageTitle('My Certificates');
  renderCertificates();
  hideSidebar();
}

function showSettings() {
  restoreSidebar();
  updateNavHighlight('settings');
  hideAllSections();
  document.getElementById('settingsSection').classList.add('visible');
  updatePageTitle('Settings');
  loadSettingsUI();
  hideSidebar();
}

function hideAllSections() {
  document.querySelectorAll('.home-section, .settings-section, .course-player').forEach(el => {
    el.classList.remove('visible');
  });
}

// ========== COURSE RENDERING ==========
function renderCoursesForHome() {
  // Update greeting with username
  if (currentUser) {
    document.getElementById('homeGreeting').textContent = `Welcome back, ${currentUser.name}! 👋`;
  }
  
  // Categorize courses
  const unlockedCourses = [];
  const unfinishedCourses = [];
  let completedCoursesCount = 0;
  
  allCourses.forEach(course => {
    const courseFullData = allCoursesFullData[course.id];
    let totalVideos = course.videoCount;
    let completedVideos = 0;
    
    if (courseFullData) {
      totalVideos = courseFullData.sections.reduce((sum, s) => sum + s.videos.length, 0);
      
      // Count completed videos by checking all progress entries for this course
      completedVideos = userProgress.filter(p => {
        const videoInCourse = courseFullData.sections.some(section =>
          section.videos.some(video => video.id === p.video_id)
        );
        return videoInCourse && p.completed;
      }).length;
    }
    
    // Categorize course
    if (completedVideos === 0) {
      // Never started - unlocked (available)
      unlockedCourses.push({
        ...course,
        completedVideos: 0,
        totalVideos,
        progressPercent: 0
      });
    } else if (completedVideos < totalVideos) {
      // Started but not finished
      unfinishedCourses.push({
        ...course,
        completedVideos,
        totalVideos,
        progressPercent: Math.round((completedVideos / totalVideos) * 100)
      });
    } else {
      // Fully completed
      completedCoursesCount++;
    }
  });
  
  // Render unlocked courses (newest to oldest = reverse order of allCourses)
  const unlockedGrid = document.getElementById('homeUnlockedGrid');
  if (unlockedCourses.length > 0) {
    unlockedGrid.innerHTML = unlockedCourses.reverse().map(course => `
      <div class="course-card">
        <div class="course-icon">${course.icon}</div>
        <div class="course-title">${course.name}</div>
        <p style="color: var(--text-light); font-size: 13px; margin-bottom: 15px;">Ready to start learning</p>
        <button class="btn" onclick="selectAndStartCourse(${course.id})">Start Course →</button>
      </div>
    `).join('');
  } else {
    unlockedGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">No new courses available</p>';
  }
  
  // Render unfinished courses
  const unfinishedGrid = document.getElementById('homeUnfinishedGrid');
  const noUnfinished = document.getElementById('homeNoUnfinished');
  
  if (unfinishedCourses.length > 0) {
    unfinishedGrid.innerHTML = unfinishedCourses.map(course => `
      <div class="course-card">
        <div class="course-icon">${course.icon}</div>
        <div class="course-title">${course.name}</div>
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${course.progressPercent}%"></div>
          </div>
          <div class="progress-text">${course.completedVideos}/${course.totalVideos} videos</div>
        </div>
        <button class="btn" onclick="selectAndStartCourse(${course.id})">Continue Learning →</button>
      </div>
    `).join('');
    noUnfinished.style.display = 'none';
  } else {
    unfinishedGrid.innerHTML = '';
    noUnfinished.style.display = 'block';
  }
  
  // Render progress stats
  let totalCompleted = 0;
  let totalVideos = 0;
  allCourses.forEach(course => {
    const courseFullData = allCoursesFullData[course.id];
    if (courseFullData) {
      const courseTotal = courseFullData.sections.reduce((sum, s) => sum + s.videos.length, 0);
      const courseDone = userProgress.filter(p => {
        const videoInCourse = courseFullData.sections.some(section =>
          section.videos.some(video => video.id === p.video_id)
        );
        return videoInCourse && p.completed;
      }).length;
      totalVideos += courseTotal;
      totalCompleted += courseDone;
    }
  });
  
  const overallPercent = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;
  const isDarkTheme = document.body.classList.contains('dark-theme');
  const textColor = isDarkTheme ? '#e0e0e0' : '#333';
  const bgColor = isDarkTheme ? '#404050' : '#e0e0e0';
  
  document.getElementById('homeProgressStats').innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <div style="flex: 1;">
        <div style="height: 8px; background: ${bgColor}; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
          <div style="height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--primary-dark) 100%); width: ${overallPercent}%; border-radius: 4px;"></div>
        </div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${textColor};">${totalCompleted}/${totalVideos} videos (${overallPercent}%)</p>
      </div>
    </div>
  `;
  
  const userLevel = calculateLevel(totalCompleted);
  userCurrentLevel = userLevel;
  const levelProgress = calculateLevelProgress(totalCompleted);
  const isDarkTheme2 = document.body.classList.contains('dark-theme');
  const levelTextColor = isDarkTheme2 ? '#e0e0e0' : '#666';
  const bgColor2 = isDarkTheme2 ? '#404050' : '#e0e0e0';
  
  document.getElementById('homeLevelStats').innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <div style="flex: 1;">
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: var(--primary);">Level ${userLevel}</p>
        <div style="height: 8px; background: ${bgColor2}; border-radius: 4px; overflow: hidden; margin-top: 12px; margin-bottom: 8px;">
          <div style="height: 100%; background: linear-gradient(90deg, var(--primary) 0%, var(--primary-dark) 100%); width: ${levelProgress}%; border-radius: 4px;"></div>
        </div>
        <p style="margin: 0; font-size: 12px; color: ${levelTextColor};">${totalCompleted} video${totalCompleted !== 1 ? 's' : ''} watched · ${levelProgress}% to next level</p>
      </div>
    </div>
  `;
  
  // Render weekly chart (last 7 days)
  renderWeeklyChart();
}

function renderWeeklyChart() {
  const today = new Date();
  const weekData = {};
  
  // Initialize last 7 days
  const dateKeys = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    dateKeys.push(dateStr);
    weekData[dateStr] = 0;
  }
  
  // Count videos watched per day from allUserProgress (all courses)
  allUserProgress.forEach(progress => {
    if (progress.completed && progress.watched_at) {
      // Handle both ISO format and SQLite format
      let watchDate;
      if (progress.watched_at.includes('T')) {
        // ISO format: "2026-02-10T22:34:00"
        watchDate = progress.watched_at.split('T')[0];
      } else {
        // SQLite format: "2026-02-10 22:34:00"
        watchDate = progress.watched_at.split(' ')[0];
      }
      
      if (weekData.hasOwnProperty(watchDate)) {
        weekData[watchDate]++;
      }
    }
  });
  
  // Get day names for last 7 days
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxVideos = Math.max(...Object.values(weekData), 1);
  const isDarkTheme = document.body.classList.contains('dark-theme');
  const textColor = isDarkTheme ? '#999' : '#999';
  const dateColor = isDarkTheme ? '#b0b0c0' : '#666';
  
  const chartHTML = dateKeys.map((dateStr) => {
    const date = new Date(dateStr);
    const dayName = dayNames[date.getDay()];
    const count = weekData[dateStr];
    const height = (count / maxVideos) * 120;
    
    return `
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
        <span style="font-size: 12px; color: ${textColor}; margin-bottom: 4px; height: 16px; font-weight: 600;">${count}</span>
        <div style="width: 100%; background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: 4px 4px 0 0; height: ${height}px; min-height: 4px; transition: all 0.3s;"></div>
        <span style="font-size: 11px; color: ${dateColor}; margin-top: 8px;">${dayName}</span>
      </div>
    `;
  }).join('');
  
  document.getElementById('homeWeekChart').innerHTML = chartHTML;
}

function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  if (!allCourses.length) return;
  
  grid.innerHTML = allCourses.map(course => {
    let completedVideos = 0;
    let totalVideos = course.videoCount;
    
    if (course.id === currentCourseId && courseData) {
      completedVideos = userProgress.filter(p => p.completed).length;
      totalVideos = courseData.sections.reduce((sum, s) => sum + s.videos.length, 0);
    }
    
    const progressPercent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
    
    return `
      <div class="course-card">
        <div class="course-icon">${course.icon}</div>
        <div class="course-title">${course.name}</div>
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-text">${completedVideos}/${totalVideos} completed</div>
        </div>
        <button class="btn" onclick="selectAndStartCourse(${course.id})">Start Course →</button>
      </div>
    `;
  }).join('');
}

function renderCertificates() {
  const grid = document.getElementById('certificatesGrid');
  if (!allCourses.length) return;
  
  let html = '';
  allCourses.forEach(course => {
    if (course.id === currentCourseId && courseData) {
      const totalVideos = courseData.sections.reduce((sum, s) => sum + s.videos.length, 0);
      const completedVideos = userProgress.filter(p => p.completed).length;
      const isCompleted = completedVideos === totalVideos && totalVideos > 0;
      
      if (isCompleted) {
        html += `
          <div class="course-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; position: relative;">
            <div style="position: absolute; top: 10px; right: 10px; background: #ffc107; color: #333; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;">
              🏆 NEW
            </div>
            <div class="course-icon">${course.icon}</div>
            <div class="course-title" style="color: white;">${course.name} Certificate</div>
            <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 15px;">✓ Completed & Verified</p>
            <button class="btn" onclick="downloadCertificate()" style="background: rgba(255,255,255,0.2); border: 2px solid white;">📥 Download</button>
          </div>
        `;
      }
    }
  });
  
  if (!html) {
    html = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 40px;">No certificates yet. Complete a course to earn one!</p>';
  }
  
  grid.innerHTML = html;
}

function showCertificatesWithBadge() {
  // Show certificates with badge
  restoreSidebar();
  updateNavHighlight('certificates');
  hideAllSections();
  document.getElementById('certificatesSection').classList.add('visible');
  document.getElementById('pageTitle').textContent = 'My Certificates';
  renderCertificates();
  hideSidebar();
}

// ========== COURSE SELECTION ==========
function selectAndStartCourse(courseId) {
  loadCourse(courseId).then(() => {
    hideSidebar();
    showCoursePlayer();
  });
}

function showCoursePlayer() {
  hideAllSections();
  document.getElementById('coursePlayer').classList.add('visible');
  updatePageTitle(courseData.name);
  
  // Change sidebar to course mode (course outline)
  renderCourseSidebar();
  selectFirstIncompleteVideo();
  
  // Highlight current video after rendering sidebar
  setTimeout(() => {
    if (currentVideoId) {
      updateSidebarHighlight(currentVideoId);
    }
  }, 150);
}

function goHome() {
  currentVideoId = null;
  currentSectionId = null;
  showHome();
}

function renderCourseSidebar() {
  if (!courseData) return;
  
  const sidebar = document.getElementById('sidebar');
  const navContent = sidebar.querySelector('.sidebar-nav');
  
  let html = `<div style="padding: 20px 0;">`;
  
  // Back to courses button
  html += `
    <div style="padding: 0 20px 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
      <button onclick="goHome()" style="background: none; border: none; cursor: pointer; color: var(--primary); font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 5px;">
        ← Back
      </button>
    </div>
  `;
  
  // Sections and videos
  courseData.sections.forEach((section, sectionIdx) => {
    const sectionId = `section-${section.id}`;
    
    html += `
      <div style="margin-bottom: 10px;">
        <div onclick="toggleSection('${sectionId}')" style="padding: 12px 20px; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--primary);">
          <span class="section-toggle" id="${sectionId}-toggle" style="display: inline-block; width: 16px; text-align: center;">▼</span>
          ${section.title}
        </div>
        <div id="${sectionId}" style="display: block;">
          ${section.videos.map((video, videoIdx) => {
            const isCompleted = userProgress.some(p => p.video_id === video.id && p.completed);
            const isCurrent = currentVideoId === video.id;
            const isFirstVideo = videoIdx === 0 && sectionIdx === 0;
            
            // Get the immediate previous video
            let previousVideoId = null;
            if (videoIdx > 0) {
              previousVideoId = section.videos[videoIdx - 1].id;
            } else if (sectionIdx > 0) {
              const prevSection = courseData.sections[sectionIdx - 1];
              previousVideoId = prevSection.videos[prevSection.videos.length - 1].id;
            }
            
            const prevCompleted = previousVideoId && userProgress.some(p => p.video_id === previousVideoId && p.completed);
            const isLocked = !isFirstVideo && !prevCompleted && !isCompleted;
            
            // Use same highlight as home page nav items for current video
            const currentBg = 'rgba(102, 126, 234, 0.2)';
            const currentBorder = '4px solid var(--primary)';
            const currentColor = 'var(--primary)';
            const currentFontWeight = '700';
            
            return `<div class="sidebar-video-item" data-video-id="${video.id}" data-section-id="${section.id}" onclick="selectVideoFromSidebarData(this)" style="padding: 10px 20px 10px 36px; cursor: ${isLocked ? 'not-allowed' : 'pointer'}; font-size: 13px; color: ${isLocked ? '#999' : 'white'}; background: ${isLocked ? 'rgba(0, 0, 0, 0.05)' : (isCurrent ? currentBg : 'transparent')}; border-left: ${isCurrent ? currentBorder : '4px solid transparent'}; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: ${isLocked ? '0.5' : '1'}; font-weight: ${isCurrent ? currentFontWeight : '400'};" title="${isLocked ? 'Watch previous video to unlock' : ''}"><span style="color: ${isLocked ? '#999' : (isCompleted ? 'var(--success)' : 'white')}; font-weight: ${isCompleted ? '600' : '400'}; margin-right: 5px;">${isLocked ? '🔒' : (isCompleted ? '✓' : '○')}</span>${video.title}</div>`;
          }).join('')}
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  
  navContent.innerHTML = html;
}

function selectFirstIncompleteVideo() {
  const allVideos = getAllVideosInOrder();
  
  // Find the last watched video
  let lastWatchedVideo = null;
  for (let i = allVideos.length - 1; i >= 0; i--) {
    const progress = userProgress.find(p => p.video_id === allVideos[i].id);
    if (progress) {
      lastWatchedVideo = allVideos[i];
      break;
    }
  }
  
  // If there's a last watched video and it's completed, find the next incomplete
  if (lastWatchedVideo) {
    const lastWatchedComplete = userProgress.some(p => p.video_id === lastWatchedVideo.id && p.completed);
    if (lastWatchedComplete) {
      // Find next incomplete
      const nextIncomplete = allVideos.find(v => {
        const idx = allVideos.indexOf(v);
        const lastIdx = allVideos.indexOf(lastWatchedVideo);
        return idx > lastIdx && !userProgress.some(p => p.video_id === v.id && p.completed);
      });
      if (nextIncomplete) {
        loadAndPlayVideoFromOrder(nextIncomplete);
        return;
      }
    } else {
      // Resume last watched video
      loadAndPlayVideoFromOrder(lastWatchedVideo);
      return;
    }
  }
  
  // If no progress, load first video
  if (allVideos.length > 0) {
    loadAndPlayVideoFromOrder(allVideos[0]);
  }
}

function loadAndPlayVideoFromOrder(videoData) {
  // Find section
  for (const section of courseData.sections) {
    const video = section.videos.find(v => v.id === videoData.id);
    if (video) {
      loadAndPlayVideo(videoData.id, section.id, video.title, video.url, section.title, video.resources || []);
      // Highlight the video in sidebar after loading
      setTimeout(() => {
        updateSidebarHighlight(videoData.id);
      }, 100);
      return;
    }
  }
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const toggle = document.getElementById(`${sectionId}-toggle`);
  
  if (section.style.display === 'none') {
    section.style.display = 'block';
    toggle.textContent = '▼';
  } else {
    section.style.display = 'none';
    toggle.textContent = '▶';
  }
}

function selectVideoFromSidebarData(element) {
  const videoId = parseInt(element.dataset.videoId);
  const sectionId = parseInt(element.dataset.sectionId);
  
  // Find the video in courseData
  let video = null;
  let sectionIdx = 0;
  let videoIdx = 0;
  
  for (let i = 0; i < courseData.sections.length; i++) {
    const section = courseData.sections[i];
    if (section.id === sectionId) {
      sectionIdx = i;
      video = section.videos.find((v, idx) => {
        if (v.id === videoId) {
          videoIdx = idx;
          return true;
        }
        return false;
      });
      break;
    }
  }
  
  if (!video) return;
  
  // Check if video is locked
  const isFirstVideo = videoIdx === 0 && sectionIdx === 0;
  
  // Get the immediate previous video
  let previousVideoId = null;
  if (videoIdx > 0) {
    previousVideoId = courseData.sections[sectionIdx].videos[videoIdx - 1].id;
  } else if (sectionIdx > 0) {
    const prevSection = courseData.sections[sectionIdx - 1];
    previousVideoId = prevSection.videos[prevSection.videos.length - 1].id;
  }
  
  const prevCompleted = previousVideoId && userProgress.some(p => p.video_id === previousVideoId && p.completed);
  const isLocked = !isFirstVideo && !prevCompleted;
  
  if (isLocked) {
    showError('Watch the previous video first to unlock this one');
    return;
  }
  
  loadAndPlayVideo(videoId, sectionId, video.title, video.url, courseData.sections[sectionIdx].title, video.resources || []);
  updateSidebarHighlight(videoId);
  hideSidebar();
}

function getAllVideosInOrder() {
  const videos = [];
  if (!courseData) return videos;
  
  courseData.sections.forEach(section => {
    section.videos.forEach(video => {
      videos.push({
        id: video.id,
        title: video.title,
        url: video.url,
        sectionId: section.id
      });
    });
  });
  
  return videos;
}

function loadAndPlayVideo(videoId, sectionId, title, url, sectionName = '', resources = []) {
  currentVideoId = videoId;
  currentSectionId = sectionId;
  currentSectionName = sectionName;
  videoWatchProgress = 0;
  
  document.getElementById('videoSection').textContent = sectionName;
  document.getElementById('videoTitle').textContent = title;
  
  // Render resources
  renderVideoResources(resources);
  
  // Check if video is already watched
  const isAlreadyWatched = userProgress.some(p => p.video_id === videoId && p.completed);
  
  const videoInfoEl = document.getElementById('videoInfo');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  
  if (isAlreadyWatched) {
    // Video already completed
    videoInfoEl.innerHTML = '✅ <strong>Video Completed!</strong> You can now proceed to the next video.';
    videoInfoEl.classList.remove('incomplete');
    videoInfoEl.classList.add('complete');
    videoInfoEl.style.background = 'rgba(39, 174, 96, 0.15)';
    videoInfoEl.style.borderLeft = '4px solid var(--success)';
    videoInfoEl.style.color = 'var(--success)';
    
    // Enable next/finish button if available
    if (isLastVideo()) {
      nextBtn.textContent = '🎓 Finish Course';
      nextBtn.disabled = false;
    } else if (canGoNext()) {
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = false;
    } else {
      nextBtn.disabled = true;
    }
  } else {
    // Video not yet completed
    videoInfoEl.innerHTML = '⏱️ <strong>Watch the entire video to unlock next lesson</strong>';
    videoInfoEl.classList.add('incomplete');
    // Apply dark theme colors if enabled
    if (document.body.classList.contains('dark-theme')) {
      videoInfoEl.style.background = 'rgba(243, 156, 18, 0.15)';
      videoInfoEl.style.borderLeft = '4px solid #f39c12';
      videoInfoEl.style.color = '#ffd700';
      videoInfoEl.style.border = '2px solid #f39c12';
    } else {
      videoInfoEl.style.background = 'var(--light)';
      videoInfoEl.style.border = 'none';
      videoInfoEl.style.borderLeft = '4px solid #f39c12';
      videoInfoEl.style.color = 'var(--text-light)';
    }
    
    // Disable next button until video is fully watched
    nextBtn.disabled = true;
  }
  
  // Update next button text based on position
  if (!isAlreadyWatched) {
    if (isLastVideo()) {
      nextBtn.textContent = '🎓 Finish Course';
    } else {
      nextBtn.textContent = 'Next →';
    }
  }
  
  // Enable/disable previous button based on position
  prevBtn.disabled = !canGoPrevious();
  
  const playerEl = document.getElementById('player');
  playerEl.src = url;
  playerEl.load();
  
  setTimeout(() => {
    attachPlayerListeners(videoId, sectionId);
  }, 100);
}

function attachPlayerListeners(videoId, sectionId) {
  const playerEl = document.getElementById('player');
  let hasMarked = false;
  let videoEnded = false;
  
  playerEl.addEventListener('timeupdate', () => {
    if (!playerEl.duration) return;
    const progress = (playerEl.currentTime / playerEl.duration) * 100;
    videoWatchProgress = progress;
    
    // Enable next button when video is fully watched
    if (progress >= 99.9 && !hasMarked) {
      hasMarked = true;
      markVideoWatched(videoId, sectionId);
    }
  });
  
  playerEl.addEventListener('ended', () => {
    videoEnded = true;
    if (!hasMarked) {
      hasMarked = true;
      markVideoWatched(videoId, sectionId);
    }
  });
}

async function markVideoWatched(videoId, sectionId) {
  try {
    const oldLevel = userCurrentLevel;
    
    await apiCall('/api/video-watched', 'POST', {
      course_id: currentCourseId,
      video_id: videoId,
      section_id: sectionId
    });
    
    userProgress = await apiCall(`/api/progress?courseId=${currentCourseId}`);
    
    // Reload all user progress for charts/stats
    await loadAllUserProgress();
    
    // Calculate new level
    const totalCompleted = allUserProgress.filter(p => p.completed).length;
    const newLevel = calculateLevel(totalCompleted);
    userCurrentLevel = newLevel;
    
    // Check if level increased
    if (newLevel > oldLevel) {
      showLevelUpPopup(newLevel);
    }
    
    // Update video info to show completion
    const videoInfoEl = document.getElementById('videoInfo');
    if (videoInfoEl) {
      videoInfoEl.innerHTML = '✅ <strong>Video Completed!</strong> You can now proceed to the next video.';
      videoInfoEl.style.background = 'rgba(39, 174, 96, 0.15)';
      videoInfoEl.style.borderLeft = '4px solid var(--success)';
      videoInfoEl.style.color = 'var(--success)';
    }
    
    // Enable next button (or finish button if last video)
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn && (canGoNext() || isLastVideo())) {
      nextBtn.disabled = false;
    }
    
    // Re-render sidebar to show checkmarks
    renderCourseSidebar();
    
    showToast('Progress saved!');
  } catch (error) {
    console.error('Failed to mark video watched:', error);
  }
}

function canGoNext() {
  const videos = getAllVideosInOrder();
  const currentIdx = videos.findIndex(v => v.id === currentVideoId);
  return currentIdx < videos.length - 1;
}

function isLastVideo() {
  const videos = getAllVideosInOrder();
  const currentIdx = videos.findIndex(v => v.id === currentVideoId);
  return currentIdx === videos.length - 1;
}

function canGoPrevious() {
  const videos = getAllVideosInOrder();
  const currentIdx = videos.findIndex(v => v.id === currentVideoId);
  return currentIdx > 0;
}

function nextVideo() {
  const videos = getAllVideosInOrder();
  const currentIdx = videos.findIndex(v => v.id === currentVideoId);
  const isCurrentCompleted = userProgress.some(p => p.video_id === currentVideoId && p.completed);
  
  if (!isCurrentCompleted) {
    showError('Please finish watching this video first');
    return;
  }
  
  // Check if this is the last video
  if (currentIdx === videos.length - 1) {
    // Finish course - show certificate page
    finishCourse();
    return;
  }
  
  if (currentIdx < videos.length - 1) {
    const next = videos[currentIdx + 1];
    // Find section for next video
    for (const section of courseData.sections) {
      const video = section.videos.find(v => v.id === next.id);
      if (video) {
        loadAndPlayVideo(next.id, section.id, next.title, next.url, section.title, video.resources || []);
        // Update sidebar highlighting
        updateSidebarHighlight(next.id);
        // Re-render sidebar to reflect unlocked videos
        renderCourseSidebar();
        break;
      }
    }
  }
}

function finishCourse() {
  // Show certificate popup
  showCertificatePopup();
}

function showCertificatePopup() {
  const courseName = courseData ? courseData.name : 'Training Course';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  document.getElementById('certificateCourseName').textContent = courseName;
  document.getElementById('certificateUserName').textContent = currentUser.name;
  document.getElementById('certificateDate').textContent = `Completed on ${date}`;
  
  document.getElementById('certificateOverlay').classList.add('visible');
}

function closeCertificatePopup() {
  document.getElementById('certificateOverlay').classList.remove('visible');
}

function showLevelUpPopup(newLevel) {
  document.getElementById('levelUpNumber').textContent = newLevel;
  document.getElementById('levelUpOverlay').classList.add('visible');
  
  // Auto-close after 4 seconds
  setTimeout(() => {
    closeLevelUpPopup();
  }, 4000);
}

function closeLevelUpPopup() {
  document.getElementById('levelUpOverlay').classList.remove('visible');
}

function claimCertificate() {
  closeCertificatePopup();
  showCertificatesWithBadge();
  showToast('🎉 Certificate claimed! Check your certificates page.');
}

function downloadCertificateFromPopup() {
  downloadCertificate();
}

function previousVideo() {
  const videos = getAllVideosInOrder();
  const currentIdx = videos.findIndex(v => v.id === currentVideoId);
  if (currentIdx > 0) {
    const prev = videos[currentIdx - 1];
    // Find section for prev video
    for (const section of courseData.sections) {
      const video = section.videos.find(v => v.id === prev.id);
      if (video) {
        loadAndPlayVideo(prev.id, section.id, prev.title, prev.url, section.title, video.resources || []);
        // Update sidebar highlighting
        updateSidebarHighlight(prev.id);
        break;
      }
    }
  }
}

function updateSidebarHighlight(videoId) {
  // Remove all highlights
  document.querySelectorAll('.sidebar-video-item').forEach(item => {
    item.style.background = 'transparent';
    item.style.borderLeft = '4px solid transparent';
    item.style.color = 'white';
    item.style.fontWeight = '400';
  });
  
  // Highlight current video
  const currentItem = document.querySelector(`[data-video-id="${videoId}"]`);
  if (currentItem) {
    currentItem.style.background = 'rgba(102, 126, 234, 0.2)';
    currentItem.style.borderLeft = '4px solid var(--primary)';
    currentItem.style.color = 'white';
    currentItem.style.fontWeight = '700';
  }
}

function renderVideoResources(resources = []) {
  const resourcesContainer = document.getElementById('videoResources');
  
  if (!resources || resources.length === 0) {
    resourcesContainer.innerHTML = '';
    resourcesContainer.classList.add('empty');
    return;
  }
  
  resourcesContainer.classList.remove('empty');
  
  let html = '<h3>📚 Resources</h3>';
  resources.forEach(resource => {
    html += `
      <div class="resource-item">
        <span class="resource-title">${resource.title}</span>
        <a href="${resource.url}" target="_blank" rel="noopener noreferrer" class="resource-link">Open →</a>
      </div>
    `;
  });
  
  resourcesContainer.innerHTML = html;
}

// ========== SETTINGS ==========
function loadSettingsUI() {
  // Load theme
  const theme = userSettings.theme || 'light';
  document.querySelectorAll('.select-option').forEach(opt => {
    opt.classList.remove('active');
    const text = opt.innerText.toLowerCase().trim();
    if (text.includes(theme) || text === theme) {
      opt.classList.add('active');
    }
  });
  
  // Load notification toggles
  const notifToggle = document.getElementById('notificationsToggle');
  const emailToggle = document.getElementById('emailToggle');
  
  if (userSettings.notifications_enabled) {
    notifToggle.classList.add('active');
  } else {
    notifToggle.classList.remove('active');
  }
  
  if (userSettings.email_notifications) {
    emailToggle.classList.add('active');
  } else {
    emailToggle.classList.remove('active');
  }
  
  // Apply theme
  applyTheme(theme);
}

function toggleUserMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const dropdown = document.getElementById('userMenuDropdown');
  dropdown.classList.toggle('open');
}

function setSetting(key, value) {
  userSettings[key] = value;
  
  // Update UI
  if (key === 'theme') {
    document.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('active'));
    const target = event.target.closest('.select-option');
    if (target) {
      target.classList.add('active');
    }
    applyTheme(value);
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    // Apply dark theme to video info if it exists
    const videoInfo = document.getElementById('videoInfo');
    if (videoInfo) {
      videoInfo.style.background = '#1a1a2e';
      videoInfo.style.borderTop = '1px solid #404050';
    }
  } else {
    document.body.classList.remove('dark-theme');
    // Apply light theme to video info if it exists
    const videoInfo = document.getElementById('videoInfo');
    if (videoInfo) {
      videoInfo.style.background = 'var(--light)';
      videoInfo.style.borderTop = 'none';
    }
  }
}

function toggleSetting(key) {
  userSettings[key] = !userSettings[key];
  
  const toggles = {
    'notifications_enabled': document.getElementById('notificationsToggle'),
    'email_notifications': document.getElementById('emailToggle')
  };
  
  if (toggles[key]) {
    toggles[key].classList.toggle('active');
  }
}

async function saveSettings() {
  try {
    await apiCall('/api/user/settings', 'POST', userSettings);
    applyTheme(userSettings.theme || 'light');
    showToast('Settings saved!');
  } catch (error) {
    showError('Failed to save settings');
  }
}

// ========== CERTIFICATE ==========
function downloadCertificate() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = 1200;
  canvas.height = 800;
  
  const courseName = courseData ? courseData.name : 'Training Course';
  
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  
  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${courseName} Certificate`, canvas.width / 2, 150);
  
  // Emoji
  ctx.font = '120px Arial';
  ctx.fillText('🎓', canvas.width / 2, 280);
  
  // Name
  ctx.font = 'bold 48px Arial';
  ctx.fillText(currentUser.name, canvas.width / 2, 400);
  
  // Text
  ctx.font = '24px Arial';
  ctx.fillText(`has successfully completed the ${courseName} course`, canvas.width / 2, 480);
  
  // Date
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = '20px Arial';
  ctx.fillText(`Completed on ${date}`, canvas.width / 2, 580);
  
  // Download
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseName.toLowerCase().replace(' ', '-')}-certificate.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function hideSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
  }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Check if Discord is configured
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    if (config.discord_enabled) {
      document.getElementById('discordBtn').style.display = 'block';
    } else {
      document.getElementById('discordBtn').style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load config:', error);
    document.getElementById('discordBtn').style.display = 'none';
  }
  
  // Check for errors in URL (Discord login errors)
  const params = new URLSearchParams(window.location.search);
  if (params.has('error')) {
    const errorCode = params.get('error');
    const errorMessages = {
      'missing_role': '❌ You don\'t have the required role to access this platform. Please ask an admin to give you the "editors" role.',
      'not_in_guild': '❌ You\'re not in the required Discord server. Please join the server first.',
      'role_check_failed': '❌ Error checking your role. Please try again.',
      'auth_error': '❌ Discord authentication failed. Please try again.',
      'no_code': '❌ Discord authorization was cancelled.',
      'db_error': '❌ Database error. Please try again.',
      'create_user_error': '❌ Error creating user account. Please try again.'
    };
    showError(errorMessages[errorCode] || `❌ Error: ${errorCode}`);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  // Check for token in URL (Discord login)
  if (params.has('token')) {
    localStorage.setItem('token', params.get('token'));
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    try {
      // Verify token is valid
      currentUser = jwt_decode(token);
      
      // Load data
      await loadAllCourses();
      await loadCourse(1);
      await Promise.all([loadUserSettings(), loadUserAvatar()]);
      
      // Initialize user level
      const totalCompleted = allUserProgress.filter(p => p.completed).length;
      userCurrentLevel = calculateLevel(totalCompleted);
      
      // Apply theme
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
    if (!e.target.closest('.user-menu-wrapper')) {
      document.getElementById('userMenuDropdown').classList.remove('open');
    }
  });
});

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

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu-wrapper')) {
    document.querySelectorAll('.user-menu-dropdown').forEach(d => d.classList.remove('open'));
  }
});

// Close certificate popup when clicking outside
document.addEventListener('click', (e) => {
  const certOverlay = document.getElementById('certificateOverlay');
  const levelUpOverlay = document.getElementById('levelUpOverlay');
  
  if (e.target === certOverlay) {
    closeCertificatePopup();
  }
  
  if (e.target === levelUpOverlay) {
    closeLevelUpPopup();
  }
});

// Close popups with ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCertificatePopup();
    closeLevelUpPopup();
  }
});

// Handle window resize for responsive navbar
window.addEventListener('resize', () => {
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle && pageTitle.textContent) {
    updatePageTitle(pageTitle.textContent);
  }
});
// Cache bust: 1771006890
