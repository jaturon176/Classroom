/**
 * Main Application Controller & Router (With Automatic Cache-Busting System v=4.0)
 * Handles authentication checks, tab navigation, settings rendering,
 * central server 0.1s real-time updates across all devices, and user avatar updates.
 */

import { RBACModule } from './modules/rbac.js?v=8.9';
import { DashboardModule } from './modules/dashboard.js?v=8.9';
import { StudentsModule } from './modules/students.js?v=8.9';
import { HomeworkModule } from './modules/homework.js?v=8.9';
import { QuizModule } from './modules/quiz.js?v=8.9';
import { AttendanceModule } from './modules/attendance.js?v=8.9';
import { GradebookModule } from './modules/gradebook.js?v=8.9';
import { SettingsModule } from './modules/settings.js?v=8.9';
import { syncEngine } from './services/syncEngine.js?v=8.9';
import { decodeMojibakeThai } from './services/mojibakeDecoder.js?v=8.9';

class SchoolApp {
  constructor() {
    this.activeTab = 'dashboard';
    this.rbac = new RBACModule((user) => this.handleAuthChange(user));

    this.settingsModule = new SettingsModule(this.rbac, () => this.handleSettingsUpdated());
    this.dashboardModule = new DashboardModule(this.rbac, (tab) => this.switchTab(tab), this.settingsModule);
    this.studentsModule = new StudentsModule(this.rbac);
    this.homeworkModule = new HomeworkModule(this.rbac);
    this.quizModule = new QuizModule(this.rbac);
    this.attendanceModule = new AttendanceModule(this.rbac);
    this.gradebookModule = new GradebookModule(this.rbac);

    this.initSyncStatus();
    this.renderHeader();
    this.renderActiveTab();

    // 🌐 Central Primary Server 0.1s Realtime Sync Listener for all connected devices
    window.addEventListener('ag_realtime_update', () => {
      // 🎨 Always apply central system theme sync across all connected users
      try {
        const remoteSettings = firebaseService.getCollection('school_settings');
        if (remoteSettings && remoteSettings.length > 0) {
          const activeSettings = remoteSettings.find(s => s.id === 'active') || remoteSettings[0];
          if (activeSettings && activeSettings.theme) {
            localStorage.setItem('antigravity_school_settings', JSON.stringify(activeSettings));
            if (this.settingsModule) {
              this.settingsModule.settings = activeSettings;
              this.settingsModule.applyTheme();
            }
          }
        } else {
          if (this.settingsModule) this.settingsModule.applyTheme();
        }
      } catch (e) {
        console.warn('Realtime theme sync check notice:', e);
      }

      // 🛡️ UNIVERSAL UI & SESSION PROTECTION SHIELD
      // Prevent kicking user out or resetting active screens during live updates:
      
      // 1. Check if user is currently taking an active quiz
      const isQuizActive = this.activeTab === 'quiz' && this.quizModule && this.quizModule.isSessionActive;

      // 2. Check if any modal or pop-up window is open on screen
      const hasOpenModal = !!document.querySelector('.fixed.inset-0, [id*="modal"], [id*="dialog"]');

      // 3. Check if user is actively typing in any input, textarea, or select field
      const activeEl = document.activeElement;
      const isTyping = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);

      if (isQuizActive || hasOpenModal || isTyping) {
        // Silently keep background data updated without wiping UI or kicking user out!
        return;
      }

      this.renderActiveTab();
    });
  }

  handleSettingsUpdated() {
    this.renderHeader();
    this.renderActiveTab();
  }

  initSyncStatus() {
    syncEngine.subscribe(({ status, pendingCount }) => {
      const badge = document.getElementById('sync-status-badge');
      if (!badge) return;

      if (status === 'synced' || status === 'syncing') {
        badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1.5';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Central Server Live (0.1s)';
      } else {
        badge.className = 'px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> Offline Local Cache';
      }
    });
  }

  handleAuthChange(user) {
    if (!user) {
      this.activeTab = 'dashboard';
    }
    if (this.settingsModule) {
      this.settingsModule.initSettings();
    }
    this.renderHeader();
    this.renderActiveTab();
  }

  switchTab(tabName) {
    if (tabName !== 'quiz' && this.quizModule) {
      this.quizModule.isSessionActive = false;
    }
    this.activeTab = tabName;
    this.renderHeader();
    this.renderActiveTab();
  }

  renderHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer) return;

    if (!this.rbac.isAuthenticated()) {
      headerContainer.innerHTML = '';
      return;
    }

    const currentUser = this.rbac.getCurrentUser();
    const settings = this.settingsModule.getSettings();

    // Dynamic Permanent School Logo (Default = ./logo school.jpg)
    const schoolLogoPath = (settings.schoolLogo && settings.schoolLogo !== '⚡') ? settings.schoolLogo : './logo school.jpg';
    const logoContent = schoolLogoPath.startsWith('http') || schoolLogoPath.startsWith('data:image') || schoolLogoPath.includes('logo') || schoolLogoPath.includes('.')
      ? `<img src="${schoolLogoPath}" class="w-full h-full object-cover">`
      : `<span>${schoolLogoPath}</span>`;

    // Default avatar icon per role if not customized
    const defaultAvatar = currentUser.role === 'Admin' ? '👑' : currentUser.role === 'Teacher' ? '👨‍🏫' : '🎓';
    const avatarContent = currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:image'))
      ? `<img src="${currentUser.avatar}" class="w-full h-full object-cover rounded-full">`
      : `<span class="text-base">${currentUser.avatar || defaultAvatar}</span>`;

    // Navigation Tabs Allowed per Role
    const allTabs = [
      { id: 'dashboard', label: '🖥️ Dashboard', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'students', label: '👨‍🎓 รายชื่อนักเรียน', roles: ['Admin', 'Teacher'] },
      { id: 'homework', label: '📚 วิชา/การบ้าน', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'quiz', label: '✨ แบบทดสอบ', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'attendance', label: '⏱️ เช็กชื่อรายคาบ', roles: ['Admin', 'Teacher'] },
      { id: 'gradebook', label: '📊 คะแนน/รายงาน', roles: ['Admin', 'Teacher', 'Student'] },
      { id: 'users', label: '👑 จัดการผู้ใช้ (RBAC)', roles: ['Admin'] },
      { id: 'settings', label: '⚙️ ตั้งค่าระบบ', roles: ['Admin', 'Teacher'] },
    ];

    const visibleTabs = allTabs.filter(t => t.roles.includes(currentUser.role));

    // Ensure active tab is allowed for current role
    if (!visibleTabs.some(t => t.id === this.activeTab)) {
      this.activeTab = visibleTabs[0].id;
    }

    headerContainer.innerHTML = `
      <header class="glass-nav sticky top-0 z-50 px-3 sm:px-6 py-2.5 transition-all bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto space-y-2">
          
          <!-- Top Row: Logo & School Title (Left) + User Profile & Actions (Right) -->
          <div class="flex items-center justify-between gap-3">
            
            <!-- Left: Logo, School Name & Subtitle -->
            <div class="flex items-center gap-2.5 cursor-pointer group" id="brand-logo">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-extrabold shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                ${logoContent}
              </div>
              <div class="whitespace-nowrap">
                <div class="font-heading font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
                  <span>${decodeMojibakeThai(settings.schoolName)}</span>
                  <span class="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Central Server Live
                  </span>
                </div>
                <div class="text-[11px] text-slate-500 font-heading font-medium whitespace-nowrap">ระบบบริหารจัดการห้องเรียนอัจฉริยะ (${settings.semester}/${settings.academicYear})</div>
              </div>
            </div>

            <!-- Right: Toolbar & User Profile Avatar Actions -->
            <div class="flex items-center gap-2 shrink-0">
              <!-- Sync Status Badge -->
              <div id="sync-status-badge" class="hidden md:block"></div>

              <!-- Active System Theme Pill Indicator -->
              <button id="btn-quick-theme" class="hidden lg:flex items-center gap-1.5 bg-white/90 hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/90 text-xs font-heading font-semibold shadow-xs transition-all cursor-pointer" title="คลิกเพื่อเปลี่ยนธีมระบบ">
                <span>🎨 ธีม:</span>
                <span class="text-indigo-600 font-bold">${(this.settingsModule ? this.settingsModule.getSettings().theme : 'indigo-classic').split('-')[0]}</span>
              </button>

              <!-- Role Badge -->
              <div class="hidden sm:flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-heading font-semibold ${
                currentUser.role === 'Admin' ? 'text-purple-700 bg-purple-50/80 border-purple-200' :
                currentUser.role === 'Teacher' ? 'text-indigo-700 bg-indigo-50/80 border-indigo-200' :
                'text-emerald-700 bg-emerald-50/80 border-emerald-200'
              }">
                <span class="text-slate-400 font-normal text-[10px]">สิทธิ์:</span>
                <span>${currentUser.role === 'Admin' ? '👑 Admin' : currentUser.role === 'Teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}</span>
              </div>

              <!-- Profile Info & Actions -->
              <div class="flex items-center gap-2 pl-2 border-l border-slate-200">
                <button id="btn-user-avatar" class="relative group cursor-pointer" title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์">
                  <div class="w-8 h-8 rounded-full bg-white border border-slate-300 group-hover:border-indigo-500 flex items-center justify-center overflow-hidden shadow-xs transition-all group-hover:scale-105">
                    ${avatarContent}
                  </div>
                  <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full text-[8px] flex items-center justify-center shadow">✏️</span>
                </button>

                <div class="hidden md:block text-left max-w-[130px] truncate">
                  <div class="text-xs font-heading font-bold text-slate-800 leading-tight truncate">${decodeMojibakeThai(currentUser.name)}</div>
                  <div class="text-[10px] text-slate-400 font-mono leading-tight truncate">${currentUser.email || currentUser.studentId || ''}</div>
                </div>

                <!-- Password Change Button -->
                <button id="btn-change-pass" class="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs px-2.5 py-1 rounded-lg font-heading font-semibold transition-all shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <span>🔑</span> <span class="hidden sm:inline">เปลี่ยนรหัส</span>
                </button>

                <!-- Logout Button -->
                <button id="btn-logout" class="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs px-2.5 py-1 rounded-lg font-heading font-semibold transition-all shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <span>🚪</span> ออก<span class="hidden sm:inline">ระบบ</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Navigation Menu Tabs (Single Horizontal Row Directly Under Subtitle) -->
          <nav class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 border-t border-slate-100/90 w-full justify-start whitespace-nowrap font-heading">
            ${visibleTabs.map(t => `
              <button 
                data-tab="${t.id}" 
                class="tab-btn px-3.5 py-1.5 rounded-xl text-xs font-heading whitespace-nowrap font-bold transition-all shrink-0 ${
                  this.activeTab === t.id ? 'nav-tab-active shadow-sm' : 'nav-tab-inactive hover:bg-slate-100/80'
                }"
              >
                ${t.label}
              </button>
            `).join('')}
          </nav>
        </div>
      </header>
    `;

    // Event Listeners
    headerContainer.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

    headerContainer.querySelector('#btn-quick-theme')?.addEventListener('click', () => this.switchTab('settings'));
    headerContainer.querySelector('#btn-user-avatar')?.addEventListener('click', () => this.rbac.showAvatarModal());
    headerContainer.querySelector('#btn-avatar-mobile')?.addEventListener('click', () => this.rbac.showAvatarModal());
    headerContainer.querySelector('#btn-change-pass')?.addEventListener('click', () => this.rbac.showChangePasswordModal());
    headerContainer.querySelector('#btn-change-pass-mobile')?.addEventListener('click', () => this.rbac.showChangePasswordModal());
    headerContainer.querySelector('#btn-logout')?.addEventListener('click', () => this.rbac.logout());
    headerContainer.querySelector('#btn-logout-mobile')?.addEventListener('click', () => this.rbac.logout());
  }

  renderActiveTab() {
    const mainContainer = document.getElementById('app-content');
    if (!mainContainer) return;

    if (!this.rbac.isAuthenticated()) {
      this.rbac.renderLoginScreen(mainContainer);
      return;
    }

    if (this.activeTab === 'dashboard') {
      this.dashboardModule.render(mainContainer);
    } else if (this.activeTab === 'students') {
      this.studentsModule.render(mainContainer);
    } else if (this.activeTab === 'homework') {
      this.homeworkModule.render(mainContainer);
    } else if (this.activeTab === 'quiz') {
      this.quizModule.render(mainContainer);
    } else if (this.activeTab === 'attendance') {
      this.attendanceModule.render(mainContainer);
    } else if (this.activeTab === 'gradebook') {
      this.gradebookModule.render(mainContainer);
    } else if (this.activeTab === 'users' && this.rbac.canManageUsers()) {
      this.rbac.renderUserManagement(mainContainer, () => this.renderActiveTab());
    } else if (this.activeTab === 'settings') {
      this.settingsModule.render(mainContainer);
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SchoolApp();
});
