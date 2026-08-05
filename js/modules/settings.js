/**
 * System Settings Module
 * Manages school info, banner titles, and background theme color presets.
 */

import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export const THEME_PRESETS = [
  { id: 'ocean', name: 'Ocean Breeze (ฟ้าพาสเทล)', bgClass: 'bg-sky-50/70', primary: '#0284c7', description: 'โทนสีฟ้าพาสเทล ละมุนตา เหมาะกับการเรียนรู้' },
  { id: 'mint', name: 'Emerald Mint (เขียวมิ้นต์)', bgClass: 'bg-emerald-50/60', primary: '#059669', description: 'โทนสีเขียวมิ้นต์ สดชื่น ผ่อนคลายสายตา' },
  { id: 'slate', name: 'Classic Slate (เทาเรียบหรู)', bgClass: 'bg-slate-50', primary: '#475569', description: 'โทนสีเทาเรียบหรู สบายตา อ่านง่าย' },
  { id: 'sakura', name: 'Sakura Blossom (ชมพูพาสเทล)', bgClass: 'bg-pink-50/60', primary: '#db2777', description: 'โทนสีชมพูพาสเทล อบอุ่น อ่อนโยน' },
  { id: 'midnight', name: 'Midnight Light (ม่วงฟิวเจอร์)', bgClass: 'bg-indigo-50/60', primary: '#4f46e5', description: 'โทนสีม่วงอินดิโก้ สไตล์ Futuristic' }
];

export class SettingsModule {
  constructor(rbac, onSettingsChange) {
    this.rbac = rbac;
    this.onSettingsChange = onSettingsChange;
    this.initSettings();
  }

  initSettings() {
    const raw = localStorage.getItem('antigravity_school_settings');
    if (!raw) {
      this.settings = {
        schoolName: 'โรงเรียนพนมดงรักวิทยา',
        academicYear: '2026',
        semester: 'ภาคเรียนที่ 1',
        theme: 'ocean',
        bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่'
      };
      this.saveSettings();
    } else {
      try {
        this.settings = JSON.parse(raw);
      } catch (e) {
        this.settings = {
          schoolName: 'โรงเรียนพนมดงรักวิทยา',
          academicYear: '2026',
          semester: 'ภาคเรียนที่ 1',
          theme: 'ocean',
          bannerTitle: 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่'
        };
      }
    }
  }

  getSettings() {
    return this.settings;
  }

  saveSettings() {
    localStorage.setItem('antigravity_school_settings', JSON.stringify(this.settings));
  }

  render(containerEl) {
    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in max-w-4xl mx-auto">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex items-center justify-between bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 text-xl">⚙️</span>
              ตั้งค่าระบบและธีมพื้นหลัง (System Settings)
            </h2>
            <p class="text-slate-500 text-xs mt-1">กำหนดชื่อโรงเรียน, โทนสีพื้นหลังระบบ, ข้อความแบนเนอร์ และปีการศึกษา</p>
          </div>
        </div>

        <!-- Section 1: School Profile Settings -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-6">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>🏫</span> ข้อมูลสถานศึกษาและแบนเนอร์
          </h3>

          <form id="settings-school-form" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อสถานศึกษา / โรงเรียน</label>
              <input type="text" id="set-school-name" value="${decodeMojibakeThai(this.settings.schoolName)}" required class="input-field" placeholder="โรงเรียนพนมดงรักวิทยา">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ข้อความหัวข้อแบนเนอร์หน้าแรก (Banner Title)</label>
              <input type="text" id="set-banner-title" value="${decodeMojibakeThai(this.settings.bannerTitle || '')}" required class="input-field" placeholder="ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ปีการศึกษา</label>
                <input type="text" id="set-year" value="${this.settings.academicYear}" required class="input-field" placeholder="2026">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ภาคเรียน</label>
                <input type="text" id="set-semester" value="${this.settings.semester}" required class="input-field" placeholder="ภาคเรียนที่ 1">
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="btn-primary text-xs px-6 py-2.5 rounded-xl font-heading font-bold shadow-md">
                💾 บันทึกการตั้งค่า
              </button>
            </div>
          </form>
        </div>

        <!-- Section 2: Theme Presets Selection -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>🎨</span> เลือกธีมและโทนสีระบบ (Theme Presets)
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            ${THEME_PRESETS.map(preset => `
              <div 
                data-theme-id="${preset.id}" 
                class="p-4 rounded-2xl border cursor-pointer transition-all space-y-2 flex flex-col justify-between ${
                  this.settings.theme === preset.id 
                    ? 'ring-2 ring-sky-500 bg-sky-50/80 border-sky-400 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                }"
              >
                <div class="flex items-center justify-between">
                  <div class="font-bold text-slate-900 text-sm font-heading">${preset.name}</div>
                  <span class="w-4 h-4 rounded-full border border-white shadow-sm" style="background-color: ${preset.primary}"></span>
                </div>
                <p class="text-xs text-slate-500">${preset.description}</p>
                <div class="text-[11px] font-bold ${this.settings.theme === preset.id ? 'text-sky-700' : 'text-slate-400'} pt-1">
                  ${this.settings.theme === preset.id ? '✓ ธีมปัจจุบัน' : 'คลิกเพื่อเลือกธีมนี้'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Event Handlers
    containerEl.querySelector('#settings-school-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      this.settings.schoolName = document.getElementById('set-school-name').value.trim();
      this.settings.bannerTitle = document.getElementById('set-banner-title').value.trim();
      this.settings.academicYear = document.getElementById('set-year').value.trim();
      this.settings.semester = document.getElementById('set-semester').value.trim();

      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();

      await showAlertModal({
        title: '💾 บันทึกการตั้งค่าสำเร็จ',
        message: 'อัปเดตข้อมูลสถานศึกษาและภาคเรียนเรียบร้อยแล้ว',
        type: 'success'
      });
    });

    // Theme Selection Handlers
    containerEl.querySelectorAll('[data-theme-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        const themeId = e.currentTarget.dataset.themeId;
        this.settings.theme = themeId;
        this.saveSettings();
        if (this.onSettingsChange) this.onSettingsChange();
        this.render(containerEl);
      });
    });
  }
}
