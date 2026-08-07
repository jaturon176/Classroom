/**
 * System Settings Module
 * Manages school info, school logo image upload & presets, banner titles,
 * rich background theme presets (10+ presets + Custom Color Picker),
 * and comprehensive system-wide preferences.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export const THEME_PRESETS = [
  { id: 'indigo-classic', name: 'คลาสสิกอินดิโก้ (Indigo Executive)', icon: '💙', bgClass: 'bg-indigo-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.08) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.04) 0px, transparent 50%)', primary: '#4f46e5', secondary: '#6366f1', description: 'โทนสีม่วงอินดิโก้และสเลท พรีเมียม คลาสสิก เรียบหรู' },
  { id: 'ocean-blue', name: 'ฟ้ามงคลมหาสมุทร (Oceanic Azure)', icon: '🌊', bgClass: 'bg-sky-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.18) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(14, 165, 233, 0.14) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(99, 102, 241, 0.06) 0px, transparent 50%)', primary: '#0284c7', secondary: '#0ea5e9', description: 'โทนสีฟ้ามหาสมุทร สดชื่น โปร่งสบาย ผ่อนคลายสายตา' },
  { id: 'emerald-mint', name: 'เขียวมินต์มงคล (Fresh Emerald)', icon: '🌿', bgClass: 'bg-emerald-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(20, 184, 166, 0.14) 0px, transparent 50%)', primary: '#059669', secondary: '#10b981', description: 'โทนสีเขียวมินต์ธรรมชาติ สดชื่น มีพลัง ให้ความรู้สึกสงบ' },
  { id: 'royal-purple', name: 'ม่วงกาแล็กซีพรีเมียม (Royal Purple)', icon: '🔮', bgClass: 'bg-purple-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(192, 132, 252, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(147, 51, 234, 0.14) 0px, transparent 50%)', primary: '#7c3aed', secondary: '#9333ea', description: 'โทนสีม่วงกาแล็กซี ล้ำสมัย พรีเมียม มีเสน่ห์น่าดึงดูด' },
  { id: 'rose-coral', name: 'ชมพูกุหลาบสดใส (Rose Coral)', icon: '🌹', bgClass: 'bg-rose-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(251, 113, 133, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(225, 29, 72, 0.14) 0px, transparent 50%)', primary: '#e11d48', secondary: '#f43f5e', description: 'โทนสีชมพูกุหลาบคอรัล อบอุ่น สดใส สนุกสนานกับการเรียน' },
  { id: 'sunset-amber', name: 'ส้มทองอบอุ่น (Sunset Amber)', icon: '🌅', bgClass: 'bg-amber-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(251, 146, 60, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.14) 0px, transparent 50%)', primary: '#d97706', secondary: '#f59e0b', description: 'โทนสีส้มทองอบอุ่น มีพลัง มีชีวิตชีวา กระตุ้นความคิดสร้างสรรค์' },
  { id: 'dark-midnight', name: 'ดาร์กโหมดพรีเมียม (Midnight Dark)', icon: '🌙', bgClass: 'bg-slate-900', bgStyle: '#0b1329', primary: '#38bdf8', secondary: '#818cf8', description: 'ดาร์กโหมดหรูหรา สไตล์ Midnight Executive ถนอมสายตา' },
  { id: 'cyberpunk-neon', name: 'ไซเบอร์พังก์นีออน (Cyberpunk Neon)', icon: '🌌', bgClass: 'bg-slate-950', bgStyle: '#090d16', primary: '#06b6d4', secondary: '#d946ef', description: 'โทนสีนีออนไซเบอร์ปังก์ ล้ำยุค โดดเด่น มีสไตล์' },
  { id: 'bamboo-forest', name: 'เขียวป่าไผ่ (Bamboo Forest)', icon: '🍃', bgClass: 'bg-emerald-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(34, 197, 94, 0.16) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(21, 128, 61, 0.12) 0px, transparent 50%)', primary: '#15803d', secondary: '#047857', description: 'โทนสีเขียวป่าไผ่อบอุ่นเป็นธรรมชาติ ผ่อนคลายสูงสุด' },
  { id: 'sakura-blossom', name: 'ชมพูซากุระพาสเทล (Sakura Blossom)', icon: '🌸', bgClass: 'bg-pink-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(244, 114, 182, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(219, 39, 119, 0.12) 0px, transparent 50%)', primary: '#db2777', secondary: '#f472b6', description: 'โทนสีชมพูซากุระอ่อนหวาน ละมุน น่ารัก' },
  { id: 'deep-space', name: 'อวกาศลึกลับ (Cosmic Deep Space)', icon: '🪐', bgClass: 'bg-slate-950', bgStyle: '#050814', primary: '#6366f1', secondary: '#a855f7', description: 'โทนสีอวกาศลึกซึ้ง พรีเมียม ดาร์กโหมดลึกลับ' },
  { id: 'golden-sand', name: 'ทรายทองอบอุ่น (Golden Terracotta)', icon: '🏖️', bgClass: 'bg-amber-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(245, 158, 11, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(180, 83, 9, 0.12) 0px, transparent 50%)', primary: '#b45309', secondary: '#d97706', description: 'โทนสีทรายทองและเทอราคอตตา อบอุ่น มีคุณค่า' },
  { id: 'nordic-berry', name: 'บลูเบอร์รีนอร์ดิค (Nordic Blueberry)', icon: '🫐', bgClass: 'bg-indigo-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(129, 140, 248, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(55, 48, 163, 0.14) 0px, transparent 50%)', primary: '#3730a3', secondary: '#4338ca', description: 'โทนสีบลูเบอร์รีนอร์ดิค เข้มขรึม มีเสน่ห์ เย็นสบาย' },
  { id: 'volcanic-ruby', name: 'ทับทิมภูเขาไฟ (Volcanic Ruby Red)', icon: '🌋', bgClass: 'bg-red-50/80', bgStyle: 'radial-gradient(at 0% 0%, rgba(248, 113, 113, 0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(185, 28, 28, 0.12) 0px, transparent 50%)', primary: '#dc2626', secondary: '#b91c1c', description: 'โทนสีแดงทับทิมร้อนแรง มีพลัง กระตือรือร้น' },
  { id: 'espresso-warm', name: 'เอสเพรสโซหรูหรา (Warm Espresso Mocha)', icon: '☕', bgClass: 'bg-stone-100', bgStyle: 'radial-gradient(at 0% 0%, rgba(168, 162, 158, 0.2) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(120, 53, 15, 0.12) 0px, transparent 50%)', primary: '#78350f', secondary: '#92400e', description: 'โทนสีกาแฟเอสเพรสโซ คลาสสิก อบอุ่น สไตล์ผู้บริหาร' }
];

export class SettingsModule {
  constructor(rbac, onSettingsChange) {
    this.rbac = rbac;
    this.onSettingsChange = onSettingsChange;
    this.initSettings();
  }

  initSettings() {
    const raw = localStorage.getItem('antigravity_school_settings');
    const defaultSettings = {
      schoolName: 'โรงเรียนพนมดงรักวิทยา',
      schoolLogo: './logo school.jpg',
      academicYear: '2026',
      semester: 'ภาคเรียนที่ 1',
      theme: 'indigo-classic',
      customBgColor: '',
      bannerTitle: 'ยินดีต้อนรับสู่ห้องเรียนครูน้อย',
      showClock: true,
      pageSize: 10,
      allowStudentAvatar: true
    };

    if (!raw) {
      this.settings = defaultSettings;
      this.saveSettings();
    } else {
      try {
        const parsed = JSON.parse(raw);
        this.settings = {
          ...defaultSettings,
          ...parsed
        };
        if (!this.settings.schoolLogo || this.settings.schoolLogo === '⚡') {
          this.settings.schoolLogo = './logo school.jpg';
        }
        if (!this.settings.bannerTitle || this.settings.bannerTitle === 'ยินดีต้อนรับสู่ระบบบริหารจัดการห้องเรียนยุคใหม่') {
          this.settings.bannerTitle = 'ยินดีต้อนรับสู่ห้องเรียนครูน้อย';
        }
      } catch (e) {
        this.settings = defaultSettings;
      }
    }
    this.applyTheme();
  }

  getSettings() {
    return this.settings;
  }

  saveSettings() {
    localStorage.setItem('antigravity_school_settings', JSON.stringify(this.settings));
    this.applyTheme();

    // 🌐 Realtime Multi-Device Sync: Push active theme & settings to Central Firebase Realtime DB
    try {
      firebaseService.updateItem('school_settings', 'active', this.settings);
    } catch (e) {
      console.warn('Realtime settings sync notice:', e);
    }
  }

  // Directly apply theme gradient / custom background color to body & document root
  applyTheme() {
    const customColor = this.settings.customBgColor;
    if (customColor) {
      document.body.removeAttribute('data-theme');
      document.body.style.backgroundColor = customColor;
      document.body.style.backgroundImage = 'none';
      return;
    }

    const themeId = this.settings.theme || 'indigo-classic';
    const preset = THEME_PRESETS.find(p => p.id === themeId) || THEME_PRESETS[0];

    document.body.setAttribute('data-theme', themeId);

    const darkThemes = ['dark-midnight', 'cyberpunk-neon', 'deep-space'];
    if (darkThemes.includes(themeId)) {
      document.body.style.backgroundColor = preset.bgStyle.startsWith('#') ? preset.bgStyle : '#0b1329';
      document.body.style.backgroundImage = 'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(217, 70, 239, 0.12) 0px, transparent 50%)';
      document.body.style.color = '#f8fafc';
    } else {
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.backgroundImage = preset.bgStyle;
      document.body.style.color = '#0f172a';
    }
    document.body.style.backgroundAttachment = 'fixed';
  }

  render(containerEl) {
    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in max-w-5xl mx-auto">
        <!-- Header -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex items-center justify-between bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 text-xl">⚙️</span>
              ตั้งค่าระบบและธีมพื้นหลัง (System Settings & Customization)
            </h2>
            <p class="text-slate-500 text-xs mt-1">กำหนดชื่อและโลโก้โรงเรียน, เลือกธีมสีพื้นหลัง 10+ แบบ + เลือกสีเองได้, และตั้งค่าการทำงานแอปพลิเคชัน</p>
          </div>
        </div>

        <!-- Section 1: School Profile & Logo Settings -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-6">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>🏫</span> 1. ข้อมูลสถานศึกษาและโลโก้โรงเรียน (School Profile & Emblem)
          </h3>

          <form id="settings-school-form" class="space-y-5">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อสถานศึกษา / โรงเรียน <span class="text-rose-500">*</span></label>
              <input type="text" id="set-school-name" value="${decodeMojibakeThai(this.settings.schoolName)}" required class="input-field" placeholder="โรงเรียนพนมดงรักวิทยา">
            </div>

            <!-- School Logo Customization Field -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <label class="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>🖼️</span> โลโก้/ตราสัญลักษณ์โรงเรียน (School Logo & Emblem)
              </label>

              <div class="flex flex-col sm:flex-row items-center gap-4">
                <!-- Live Header Logo Preview -->
                <div class="flex flex-col items-center gap-1 shrink-0">
                  <div class="text-[10px] font-bold text-slate-500">ตัวอย่างบนแถบเมนู</div>
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-lg font-extrabold shadow-sm shadow-indigo-500/20 overflow-hidden border border-white" id="logo-preview-box">
                    ${this.settings.schoolLogo && (this.settings.schoolLogo.startsWith('http') || this.settings.schoolLogo.startsWith('data:image')) 
                      ? `<img src="${this.settings.schoolLogo}" class="w-full h-full object-cover">` 
                      : `<span>${this.settings.schoolLogo || '⚡'}</span>`}
                  </div>
                </div>

                <div class="space-y-3 flex-1 w-full">
                  <!-- Preset Icon Choice -->
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">1. เลือกสัญลักษณ์สำเร็จรูป</label>
                    <div class="flex flex-wrap gap-1.5">
                      ${['⚡', '🎓', '🏫', '🏛️', '📚', '👑', '🌟', '🛡️', '🦁', '🦊'].map(p => `
                        <button type="button" data-logo-preset="${p}" class="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-sm flex items-center justify-center hover:scale-105 transition-all">
                          ${p}
                        </button>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Image File Upload -->
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">2. หรืออัปโหลดไฟล์ตราโรงเรียน (.png, .jpg, .svg)</label>
                    <input type="file" id="set-logo-file" accept="image/*" class="input-field py-1 text-xs">
                  </div>

                  <!-- Image URL Input -->
                  <div>
                    <label class="block text-[11px] font-semibold text-slate-600 mb-1">3. หรือวางลิงก์รูปภาพโลโก้ (Image URL)</label>
                    <input type="url" id="set-logo-url" value="${this.settings.schoolLogo && this.settings.schoolLogo.startsWith('http') ? this.settings.schoolLogo : ''}" class="input-field py-1 text-xs" placeholder="https://domain.com/school-logo.png">
                  </div>
                </div>
              </div>
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
                💾 บันทึกข้อมูลและโลโก้โรงเรียน
              </button>
            </div>
          </form>
        </div>

        <!-- Section 2: Theme Presets & Custom Background Color Picker -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <h3 class="text-lg font-bold font-heading text-slate-900 flex items-center gap-2">
              <span>🎨</span> 2. เลือกธีมสีพื้นหลังระบบ (Theme Presets & Custom Picker)
            </h3>

            <!-- Custom Color Picker Input -->
            <div class="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
              <label class="text-xs font-bold text-slate-700">🎨 เลือกสีพื้นหลังเอง:</label>
              <input type="color" id="set-custom-bg" value="${this.settings.customBgColor || '#f8fafc'}" class="w-8 h-8 rounded-lg cursor-pointer border-0">
              ${this.settings.customBgColor ? `
                <button type="button" id="btn-reset-custom-bg" class="text-xs text-rose-600 font-bold hover:underline ml-1">
                  ล้างสี
                </button>
              ` : ''}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            ${THEME_PRESETS.map(preset => `
              <div 
                data-theme-id="${preset.id}" 
                class="p-4.5 rounded-2xl border cursor-pointer transition-all space-y-3 flex flex-col justify-between hover:scale-[1.02] ${
                  !this.settings.customBgColor && this.settings.theme === preset.id 
                    ? 'ring-2 ring-indigo-500 bg-indigo-50/70 border-indigo-400 shadow-md' 
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                }"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="font-bold text-slate-900 text-xs sm:text-sm font-heading flex items-center gap-1.5">
                    <span class="text-base">${preset.icon || '🎨'}</span>
                    <span>${preset.name}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <span class="w-4 h-4 rounded-full border border-white shadow-xs" style="background-color: ${preset.primary}"></span>
                    <span class="w-4 h-4 rounded-full border border-white shadow-xs" style="background-color: ${preset.secondary || preset.primary}"></span>
                  </div>
                </div>
                
                <p class="text-xs text-slate-500 font-heading leading-relaxed">${preset.description}</p>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100/80 text-[11px] font-bold">
                  <span class="${!this.settings.customBgColor && this.settings.theme === preset.id ? 'text-indigo-600' : 'text-slate-400'}">
                    ${!this.settings.customBgColor && this.settings.theme === preset.id ? '✓ ธีมที่เปิดใช้อยู่ (Active)' : 'คลิกเพื่อเลือกธีมนี้'}
                  </span>
                  <span class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                    Realtime Sync
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Section 3: App Display & Behavior Settings -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
          <h3 class="text-lg font-bold font-heading text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span>⚙️</span> 3. ตั้งค่าการแสดงผลและพฤติกรรมแอปพลิเคชัน
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">⏰ แสดงนาฬิการายงานเวลาเรียลไทม์</div>
                <div class="text-[11px] text-slate-500 mt-0.5">แสดงนาฬิกาดิจิทัลและวันที่แบบไทยบนแบนเนอร์หน้าแรก</div>
              </div>
              <input type="checkbox" id="set-show-clock" ${this.settings.showClock ? 'checked' : ''} class="w-5 h-5 text-indigo-600 rounded cursor-pointer">
            </div>

            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">🖼️ อนุญาตให้นักเรียนเปลี่ยนรูปโปรไฟล์</div>
                <div class="text-[11px] text-slate-500 mt-0.5">ให้นักเรียนทุกคนสามารถอัปโหลดและเปลี่ยนรูปโปรไฟล์ได้เอง</div>
              </div>
              <input type="checkbox" id="set-allow-avatar" ${this.settings.allowStudentAvatar ? 'checked' : ''} class="w-5 h-5 text-indigo-600 rounded cursor-pointer">
            </div>
          </div>
        </div>
      </div>
    `;

    // Interactive Logo Preview & Handlers
    let currentSelectedLogo = this.settings.schoolLogo || '⚡';
    const logoPreviewBox = containerEl.querySelector('#logo-preview-box');

    const updateLogoPreview = (val) => {
      currentSelectedLogo = val;
      if (val.startsWith('http') || val.startsWith('data:image')) {
        logoPreviewBox.innerHTML = `<img src="${val}" class="w-full h-full object-cover">`;
      } else {
        logoPreviewBox.innerHTML = `<span>${val}</span>`;
      }
    };

    containerEl.querySelectorAll('[data-logo-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        updateLogoPreview(e.currentTarget.dataset.logoPreset);
      });
    });

    containerEl.querySelector('#set-logo-file')?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          updateLogoPreview(ev.target.result);
        };
        reader.readAsDataURL(file);
      }
    });

    containerEl.querySelector('#set-logo-url')?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) updateLogoPreview(val);
    });

    // Event Handlers for School Form
    containerEl.querySelector('#settings-school-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      this.settings.schoolName = document.getElementById('set-school-name').value.trim();
      this.settings.schoolLogo = currentSelectedLogo;
      this.settings.bannerTitle = document.getElementById('set-banner-title').value.trim();
      this.settings.academicYear = document.getElementById('set-year').value.trim();
      this.settings.semester = document.getElementById('set-semester').value.trim();

      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();

      await showAlertModal({
        title: '💾 บันทึกการตั้งค่าสำเร็จ',
        message: 'อัปเดตข้อมูลและโลโก้โรงเรียนเรียบร้อยแล้ว',
        type: 'success'
      });
    });

    // Preset Theme Card Handlers
    containerEl.querySelectorAll('[data-theme-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        const themeId = e.currentTarget.dataset.themeId;
        this.settings.theme = themeId;
        this.settings.customBgColor = ''; // Reset custom color when preset is clicked
        this.saveSettings();
        if (this.onSettingsChange) this.onSettingsChange();
        this.render(containerEl);
      });
    });

    // Custom Color Picker Handler
    const colorPicker = containerEl.querySelector('#set-custom-bg');
    colorPicker?.addEventListener('input', (e) => {
      const val = e.target.value;
      this.settings.customBgColor = val;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });

    // Reset Custom Color Handler
    containerEl.querySelector('#btn-reset-custom-bg')?.addEventListener('click', () => {
      this.settings.customBgColor = '';
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
      this.render(containerEl);
    });

    // App Preferences Checkboxes
    containerEl.querySelector('#set-show-clock')?.addEventListener('change', (e) => {
      this.settings.showClock = e.target.checked;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });

    containerEl.querySelector('#set-allow-avatar')?.addEventListener('change', (e) => {
      this.settings.allowStudentAvatar = e.target.checked;
      this.saveSettings();
      if (this.onSettingsChange) this.onSettingsChange();
    });
  }
}
