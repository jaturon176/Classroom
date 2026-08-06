/**
 * Main Application Controller & Router (With Automatic Cache-Busting System v=4.0)
 * Handles authentication checks, tab navigation, settings rendering,
 * central server 0.1s real-time updates across all devices, and user avatar updates.
 */

import { RBACModule } from './modules/rbac.js?v=5.3';
import { DashboardModule } from './modules/dashboard.js?v=5.3';
import { StudentsModule } from './modules/students.js?v=5.3';
import { HomeworkModule } from './modules/homework.js?v=5.3';
import { QuizModule } from './modules/quiz.js?v=5.3';
import { AttendanceModule } from './modules/attendance.js?v=5.3';
import { GradebookModule } from './modules/gradebook.js?v=5.3';
import { SettingsModule } from './modules/settings.js?v=5.3';
import { syncEngine } from './services/syncEngine.js?v=5.3';
import { decodeMojibakeThai } from './services/mojibakeDecoder.js?v=5.3';

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

    // Dynamic School Logo
    const logoContent = settings.schoolLogo && (settings.schoolLogo.startsWith('http') || settings.schoolLogo.startsWith('data:image'))
      ? `<img src="${settings.schoolLogo}" class="w-full h-full object-cover">`
      : `<span>${settings.schoolLogo || '⚡'}</span>`;

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
      <header class="glass-nav sticky top-0 z-50 px-3 lg:px-6 py-2 transition-all">
        <div class="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-2.5">
          
          <!-- Left: Logo & School Name (Strictly Single Line, No Line Wrap) -->
          <div class="flex items-center justify-between w-full xl:w-auto shrink-0">
            <div class="flex items-center gap-2.5 cursor-pointer group" id="brand-logo">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-extrabold shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform overflow-hidden">
                ${logoContent}
              </div>
              <div class="whitespace-nowrap">
                <div class="font-heading font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
                  <span>${decodeMojibakeThai(settings.schoolName)}</span>
                  <span class="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Central Server Live
                  </span>
                </div>
                <div class="text-[10px] text-slate-500 font-heading whitespace-nowrap">ระบบบริหารจัดการห้องเรียนอัจฉริยะ (${settings.semester}/${settings.academicYear})</div>
              </div>
            </div>

            <!-- Mobile Controls -->
            <div class="flex xl:hidden items-center gap-1.5">
              <button id="btn-avatar-mobile" class="w-7 h-7 rounded-full bg-white border border-sky-300 flex items-center justify-center overflow-hidden">
                ${avatarContent}
              </button>
              <button id="btn-change-pass-mobile" class="text-[11px] text-sky-800 font-bold px-2 py-1 bg-sky-50 rounded-lg border border-sky-200">🔑 รหัสผ่าน</button>
              <button id="btn-logout-mobile" class="text-[11px] text-rose-600 font-bold px-2 py-1 bg-rose-50 rounded-lg border border-rose-200">🚪 ออกจากระบบ</button>
            </div>
          </div>

          <!-- Center: Navigation Tabs (Pro Compact Pills) -->
          <nav class="flex items-center gap-1 overflow-x-auto w-full xl:w-auto py-0.5 scrollbar-none justify-start xl:justify-center">
            ${visibleTabs.map(t => `
              <button 
                data-tab="${t.id}" 
                class="tab-btn px-3 py-1.5 rounded-xl text-xs font-heading whitespace-nowrap font-medium transition-all ${
                  this.activeTab === t.id ? 'nav-tab-active' : 'nav-tab-inactive'
                }"
              >
                ${t.label}
              </button>
            `).join('')}
          </nav>

          <!-- Right: Toolbar & User Profile Avatar Actions (Compact Pro Layout) -->
          <div class="hidden xl:flex items-center gap-2 shrink-0">
            <!-- Sync Status Badge -->
            <div id="sync-status-badge"></div>

            <!-- Role Badge -->
            <div class="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-heading font-semibold ${
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

              <div class="text-left max-w-[120px] truncate">
                <div class="text-xs font-heading font-bold text-slate-800 leading-tight truncate">${decodeMojibakeThai(currentUser.name)}</div>
                <div class="text-[10px] text-slate-400 font-mono leading-tight truncate">${currentUser.email || currentUser.studentId || ''}</div>
              </div>

              <!-- Password Change Button (Compact) -->
              <button id="btn-change-pass" class="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-[11px] px-2.5 py-1 rounded-lg font-heading font-semibold transition-all shadow-xs flex items-center gap-1">
                <span>🔑</span> เปลี่ยนรหัส
              </button>

              <!-- Logout Button (Compact) -->
              <button id="btn-logout" class="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[11px] px-2.5 py-1 rounded-lg font-heading font-semibold transition-all shadow-xs flex items-center gap-1">
                <span>🚪</span> ออก
              </button>
            </div>
          </div>
        </div>
      </header>
    `;

    // Event Listeners
    headerContainer.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.currentTarget.dataset.tab);
      });
    });

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
