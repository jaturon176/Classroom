/**
 * Main Application Controller & Router (With Automatic Cache-Busting System v=5.2)
 * Handles authentication checks, tab navigation, settings rendering,
 * central server 0.1s real-time updates across all devices, and user avatar updates.
 */

import { RBACModule } from './modules/rbac.js?v=5.2';
import { DashboardModule } from './modules/dashboard.js?v=5.2';
import { StudentsModule } from './modules/students.js?v=5.2';
import { HomeworkModule } from './modules/homework.js?v=5.2';
import { QuizModule } from './modules/quiz.js?v=5.2';
import { AttendanceModule } from './modules/attendance.js?v=5.2';
import { GradebookModule } from './modules/gradebook.js?v=5.2';
import { SettingsModule } from './modules/settings.js?v=5.2';
import { syncEngine } from './services/syncEngine.js?v=5.2';
import { decodeMojibakeThai } from './services/mojibakeDecoder.js?v=5.2';

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

    this.init();
  }

  init() {
    // Re-render current active tab on 0.1s Cloud DB sync updates across all devices
    window.addEventListener('ag_realtime_update', () => {
      this.renderActiveTabContent();
      this.updateHeaderProfile();
    });

    // Listen for avatar/profile updates
    window.addEventListener('ag_user_updated', () => {
      this.updateHeaderProfile();
    });

    // Initial render
    this.renderHeader();
    this.renderActiveTabContent();
  }

  handleAuthChange(user) {
    this.renderHeader();
    this.renderActiveTabContent();
  }

  handleSettingsUpdated() {
    this.renderHeader();
    this.renderActiveTabContent();
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    this.updateHeaderTabActiveState();
    this.renderActiveTabContent();

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderHeader() {
    const headerEl = document.getElementById('app-header');
    if (!headerEl) return;
    this.rbac.renderHeader(headerEl, this.activeTab, (tab) => this.switchTab(tab), this.settingsModule);
  }

  updateHeaderTabActiveState() {
    const navButtons = document.querySelectorAll('[data-tab]');
    navButtons.forEach(btn => {
      const tab = btn.dataset.tab;
      if (tab === this.activeTab) {
        btn.className = 'nav-tab-active flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-sm';
      } else {
        btn.className = 'nav-tab-inactive flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all hover:bg-slate-100';
      }
    });
  }

  updateHeaderProfile() {
    const currentUser = this.rbac.getCurrentUser();
    const avatarImg = document.getElementById('hdr-user-avatar');
    const nameEl = document.getElementById('hdr-user-name');

    if (avatarImg && currentUser) {
      avatarImg.src = currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250';
    }

    if (nameEl && currentUser) {
      nameEl.textContent = decodeMojibakeThai(currentUser.name);
    }
  }

  renderActiveTabContent() {
    const contentEl = document.getElementById('app-content');
    if (!contentEl) return;

    switch (this.activeTab) {
      case 'dashboard':
        this.dashboardModule.render(contentEl);
        break;
      case 'students':
        this.studentsModule.render(contentEl);
        break;
      case 'homework':
        this.homeworkModule.render(contentEl);
        break;
      case 'quiz':
        this.quizModule.render(contentEl);
        break;
      case 'attendance':
        this.attendanceModule.render(contentEl);
        break;
      case 'gradebook':
        this.gradebookModule.render(contentEl);
        break;
      case 'settings':
        this.settingsModule.render(contentEl);
        break;
      default:
        this.dashboardModule.render(contentEl);
    }
  }
}

// Instantiate global app controller
window.app = new SchoolApp();
