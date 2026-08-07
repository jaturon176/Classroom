/**
 * Courses & Homework Module
 * - Cloudinary CDN & Data URL Image Upload Service (Cloud Name: gibfwtj2).
 * - Firebase Realtime Database: 0.1s Live Sync across PC, iPad, iPhone, Android.
 * - Multiple Images & Multiple YouTube Videos Attachments for Homework.
 * - Multi-Room Homework Assignment: Assign homework to multiple rooms simultaneously.
 * - Multi-Room Course Selection: Choose multiple taught rooms pulled from system users.
 * - Teacher Scope Control & Admin Full Control.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showConfirmModal, showAlertModal, showImagePreviewModal, showPDFPreviewModal } from '../services/dialogService.js';
import { uploadImageToCloudinary } from '../services/cloudinaryService.js';

export function extractYouTubeId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = str.match(regExp);
  return (match && match[2].length === 11) ? match[2] : (str.length === 11 ? str : null);
}

export class HomeworkModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedCourseId = 'All';

    // Listen for 0.1s Cloud Realtime Database updates from other devices
    window.addEventListener('ag_realtime_update', () => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);
      const hasOpenModal = !!document.querySelector('.fixed.inset-0, [id*="modal"], [id*="dialog"]');

      if (!isTyping && !hasOpenModal) {
        const container = document.getElementById('app-content');
        if (container && container.querySelector('#hw-module-container')) {
          this.render(container);
        }
      }
    });
  }

  render(containerEl) {
    if (!containerEl) return;

    try {
      const courses = firebaseService.getCollection('courses') || [];
      const homeworkList = firebaseService.getCollection('homework') || [];
      const currentUser = (this.rbac ? this.rbac.getCurrentUser() : null) || { role: 'Student', name: 'Guest', studentId: '-' };

      // Teacher Scope Control: Teachers see ONLY courses/homework they teach
      let visibleCourses = Array.isArray(courses) ? courses.filter(Boolean) : [];
      if (currentUser && currentUser.role === 'Teacher') {
        visibleCourses = visibleCourses.filter(c => c && decodeMojibakeThai(c.teacher || '') === decodeMojibakeThai(currentUser.name || ''));
      }

      // Filter homework by role & target class/room
      let visibleHomework = Array.isArray(homeworkList) ? homeworkList.filter(Boolean) : [];

      if (currentUser && currentUser.role === 'Teacher') {
        visibleHomework = visibleHomework.filter(hw => {
          if (!hw) return false;
          const targetCourse = visibleCourses.find(c => c && c.id === hw.courseId);
          return targetCourse && decodeMojibakeThai(targetCourse.teacher || '') === decodeMojibakeThai(currentUser.name || '');
        });
      } else if (currentUser && currentUser.role === 'Student') {
        // Re-fetch latest student profile from central users collection (in case grade/room was updated on server)
        const allUsers = firebaseService.getCollection('users') || [];
        const latestProfile = Array.isArray(allUsers) ? allUsers.find(u => 
          u && (
            (u.id && currentUser.id && String(u.id) === String(currentUser.id)) ||
            (u.studentId && currentUser.studentId && String(u.studentId) !== '-' && String(u.studentId).trim() === String(currentUser.studentId).trim()) ||
            (u.email && currentUser.email && String(u.email).trim().toLowerCase() === String(currentUser.email).trim().toLowerCase())
          )
        ) : null;

        const studentProfile = latestProfile || currentUser || {};
        const studentGrade = String(studentProfile.grade || '').trim();
        const studentRoom = String(studentProfile.room || '').trim();
        const cleanStudentRoom = studentRoom.replace(/\D/g, ''); // Extract digits e.g. "3" from "ห้อง 3"

        visibleHomework = visibleHomework.filter(hw => {
          if (!hw) return false;
          const tGrade = String(hw.targetGrade || 'All').trim();
          const rawRooms = hw.targetRooms || (hw.targetRoom ? [hw.targetRoom] : ['All']);
          const hwRooms = Array.isArray(rawRooms) ? rawRooms.map(r => String(r).trim()) : [String(rawRooms).trim()];
          const cleanHwRooms = hwRooms.map(r => r.replace(/\D/g, ''));

          // Grade check (e.g. "ม.1" vs "ม.1" or "1" vs "1")
          if (tGrade !== 'All' && studentGrade && studentGrade !== '-') {
            const tGradeClean = tGrade.replace(/\D/g, '');
            const sGradeClean = studentGrade.replace(/\D/g, '');
            const exactGradeMatch = tGrade === studentGrade;
            const cleanGradeMatch = tGradeClean && sGradeClean && tGradeClean === sGradeClean;
            if (!exactGradeMatch && !cleanGradeMatch) {
              return false;
            }
          }

          // Room check (e.g. "3" or "ห้อง 3" vs ["3", "5"])
          if (!hwRooms.includes('All')) {
            if (studentRoom && studentRoom !== '-') {
              const hasExactMatch = hwRooms.includes(studentRoom);
              const hasCleanMatch = cleanStudentRoom && cleanHwRooms.includes(cleanStudentRoom);
              if (!hasExactMatch && !hasCleanMatch) {
                return false;
              }
            }
          }
          return true;
        });
      }

      if (this.selectedCourseId !== 'All') {
        visibleHomework = visibleHomework.filter(hw => hw && hw.courseId === this.selectedCourseId);
      }

    containerEl.innerHTML = `
      <div id="hw-module-container" class="space-y-8 animate-fade-in">
        <!-- Header & Top Actions -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 text-xl">📚</span>
              วิชาเรียนและการบ้าน (Courses & Homework)
            </h2>
            <p class="text-slate-500 text-xs mt-1">จัดการวิชาเรียน, สั่งการบ้านแนบรูปภาพ/YouTube หลายไฟล์, มอบหมายรายห้อง และตรวจงานนักเรียน</p>
          </div>

          ${this.rbac.canManageHomework() ? `
            <div class="flex flex-wrap gap-3">
              <button id="btn-add-course" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1.5">
                <span>➕</span> เพิ่มวิชาเรียนใหม่
              </button>
              <button id="btn-add-hw" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/20">
                <span>📝</span> สั่งการบ้านใหม่
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Course Category Selector -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-slate-700 font-heading uppercase tracking-wider">รายวิชาที่คุณรับผิดชอบ</h3>
          <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            <button 
              data-course-id="All" 
              class="course-card px-5 py-3 rounded-2xl text-xs font-heading font-bold whitespace-nowrap transition-all border ${
                this.selectedCourseId === 'All'
                  ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20 border-transparent'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }"
            >
              🌐 ทุกรายวิชา (All)
            </button>

            ${visibleCourses.map(c => {
              const cRooms = c.targetRooms || (c.targetRoom ? [c.targetRoom] : ['All']);
              const roomsLabel = !cRooms.includes('All') ? ` (ห้อง ${cRooms.join(', ')})` : '';
              return `
                <div 
                  data-course-id="${c.id}" 
                  class="course-card px-5 py-3 rounded-2xl text-xs font-heading font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-3 ${
                    this.selectedCourseId === c.id
                      ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20 border-transparent'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }"
                >
                  <div>
                    <div>${c.code} - ${c.name}</div>
                    <div class="text-[10px] opacity-80 font-normal mt-0.5">${c.teacher}${roomsLabel}</div>
                  </div>

                  ${this.rbac.canManageHomework() ? `
                    <div class="flex items-center gap-1 pl-2 border-l border-slate-200/40">
                      <button data-edit-course="${c.id}" class="hover:text-amber-300 p-0.5" title="แก้ไขวิชา">✏️</button>
                      <button data-del-course="${c.id}" data-course-name="${c.name}" class="hover:text-rose-300 p-0.5" title="ลบวิชา">🗑️</button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Homework List -->
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-slate-900 font-heading flex items-center justify-between">
            <span>📋 รายการการบ้านที่มอบหมาย</span>
            <span class="text-xs font-normal text-slate-500">จำนวน ${visibleHomework.length} รายการ</span>
          </h3>

          ${visibleHomework.length === 0 ? `
            <div class="glass-card p-8 sm:p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <div class="text-3xl">📭</div>
              <div class="text-sm font-bold font-heading text-slate-700">
                ${currentUser.role === 'Student' ? 'ไม่มีการบ้านที่มอบหมายสำหรับระดับชั้นและห้องเรียนของคุณในขณะนี้' : 'ไม่พบรายการการบ้านในวิชานี้'}
              </div>
              ${currentUser.role === 'Student' ? `
                <div class="inline-flex flex-wrap items-center justify-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl text-xs text-slate-600 font-heading">
                  <span>👤 ข้อมูลชั้นเรียนของคุณในระบบ:</span>
                  <span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-mono">
                    ${(studentProfile && studentProfile.grade && studentProfile.grade !== '-') ? studentProfile.grade : 'ไม่ระบุชั้น'} 
                    ${(studentProfile && studentProfile.room && studentProfile.room !== '-') ? `(ห้อง ${studentProfile.room})` : '(ไม่ระบุห้อง)'}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 italic">*(หากห้องเรียนไม่ตรง สามารถแจ้งคุณครูหรือแอดมินให้เปลี่ยนห้องในเมนูจัดการผู้ใช้ได้ครับ)*</p>
              ` : ''}
            </div>
          ` : visibleHomework.map(hw => {
            const rawSubs = hw.submissions || [];
            const submissionsList = Array.isArray(rawSubs) ? rawSubs : Object.values(rawSubs);
            const validSubmissions = submissionsList.filter(s => s && typeof s === 'object');
            const mySubmission = validSubmissions.find(s => s.studentId === currentUser.studentId);
            const submissionCount = validSubmissions.length;
            
            const targetGradeStr = hw.targetGrade && hw.targetGrade !== 'All' ? hw.targetGrade : 'ทุกชั้น';
            const hwRooms = hw.targetRooms || (hw.targetRoom ? [hw.targetRoom] : ['All']);
            const targetRoomsStr = (!hwRooms.includes('All')) ? `ห้อง ${hwRooms.join(', ')}` : 'ทุกห้อง';
            
            const targetBadgeText = (hw.targetGrade === 'All' && hwRooms.includes('All')) 
              ? '🌐 มอบหมายให้ทุกห้อง' 
              : `🎯 มอบหมายให้: ${targetGradeStr} (${targetRoomsStr})`;

            const attachmentsImages = Array.isArray(hw.images) ? hw.images : (hw.imageUrl ? [hw.imageUrl] : []);
            const attachmentsVideos = Array.isArray(hw.youtubeVideos) ? hw.youtubeVideos : (hw.youtubeUrl ? [hw.youtubeUrl] : []);
            const attachmentsPdfs = Array.isArray(hw.pdfFiles) ? hw.pdfFiles : (hw.pdfFile ? [hw.pdfFile] : []);

            return `
              <div class="glass-card p-6 md:p-7 rounded-3xl shadow-sm space-y-4 bg-white border border-slate-200/90">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">${hw.courseName}</span>
                      
                      <span class="bg-purple-50 text-purple-700 border border-purple-100 text-xs px-3 py-1 rounded-xl font-bold font-heading">
                        ${targetBadgeText}
                      </span>
                    </div>
                    
                    <h4 class="text-xl font-bold text-slate-900 font-heading mt-2.5 leading-snug">${decodeMojibakeThai(hw.title)}</h4>
                  </div>
                  <div class="text-right">
                    <div class="text-xs text-slate-500">กำหนดส่ง: <strong class="text-rose-600 font-mono font-bold">${hw.dueDate}</strong></div>
                    <div class="text-xs text-slate-500 mt-0.5">คะแนนเต็ม: <strong class="text-indigo-600 font-bold">${hw.maxPoints}</strong> คะแนน</div>
                  </div>
                </div>

                <p class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">${decodeMojibakeThai(hw.detail)}</p>

                <!-- Attached Images Gallery -->
                ${attachmentsImages.length > 0 ? `
                  <div class="pt-2 border-t border-slate-100 space-y-2">
                    <div class="text-xs font-bold text-slate-700 flex items-center justify-between font-heading">
                      <span class="flex items-center gap-1">📸 รูปภาพประกอบโจทย์ (${attachmentsImages.length} รูป):</span>
                      <span class="text-[11px] font-semibold text-indigo-600">🔍 คลิกรูปเพื่อดูขนาดย่อ/ขยายรูปเต็ม</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      ${attachmentsImages.map(imgUrl => `
                        <div class="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 relative group cursor-pointer" data-preview-img="${imgUrl}">
                          <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                          <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                            🔍 ขยายดูรูป
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Embedded YouTube Players -->
                ${attachmentsVideos.length > 0 ? `
                  <div class="pt-2 border-t border-slate-100 space-y-2">
                    <div class="text-xs font-bold text-rose-700 flex items-center gap-1 font-heading">
                      <span>🎥 วิดีโอสอนเพิ่มเติมจาก YouTube (${attachmentsVideos.length} วิดีโอ):</span>
                    </div>
                    <div class="grid grid-cols-1 ${attachmentsVideos.length > 1 ? 'md:grid-cols-2' : ''} gap-3">
                      ${attachmentsVideos.map(ytUrl => {
                        const ytId = extractYouTubeId(ytUrl);
                        if (!ytId) return '';
                        return `
                          <div class="aspect-video w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black">
                            <iframe 
                              src="https://www.youtube.com/embed/${ytId}" 
                              title="YouTube video player" 
                              frameborder="0" 
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                              allowfullscreen 
                              class="w-full h-full"
                            ></iframe>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Embedded PDF Document Attachments -->
                ${attachmentsPdfs.length > 0 ? `
                  <div class="pt-2 border-t border-slate-100 space-y-2">
                    <div class="text-xs font-bold text-rose-800 flex items-center gap-1 font-heading">
                      <span>📄 เอกสาร PDF ประกอบการเรียน (${attachmentsPdfs.length} ไฟล์):</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      ${attachmentsPdfs.map((pdf, pIdx) => {
                        const pdfUrl = typeof pdf === 'string' ? pdf : pdf.url;
                        const pdfName = typeof pdf === 'object' && pdf.name ? pdf.name : `เอกสารประกอบการเรียน_${pIdx + 1}.pdf`;
                        return `
                          <div class="p-3 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between gap-3 group hover:bg-rose-100/80 transition-all shadow-xs">
                            <div class="flex items-center gap-2.5 overflow-hidden">
                              <div class="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                PDF
                              </div>
                              <div class="overflow-hidden">
                                <div class="text-xs font-bold text-slate-900 font-heading truncate">${pdfName}</div>
                                <div class="text-[10px] text-slate-500 font-mono">เอกสารประกอบการเรียน</div>
                              </div>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                              <button type="button" data-view-pdf="${pdfUrl}" data-pdf-title="${pdfName}" class="btn-primary text-xs px-3 py-1.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 font-heading shadow-xs">
                                👁️ อ่าน PDF
                              </button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Actions / Status Area -->
                <div class="pt-3 flex flex-wrap justify-between items-center gap-4 border-t border-slate-100">
                  <div class="text-xs text-slate-500">
                    ส่งงานแล้ว: <strong class="text-slate-900 font-bold">${submissionCount}</strong> รายการ
                  </div>

                  <div class="flex items-center gap-3">
                    ${this.rbac.canSubmitHomework() && currentUser.role === 'Student' ? `
                      ${mySubmission ? `
                        <span class="px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                          mySubmission.status === 'Graded' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }">
                          ${mySubmission.status === 'Graded' ? `✅ ตรวจแล้ว (${mySubmission.score}/${hw.maxPoints} คะแนน)` : '⏳ ส่งงานแล้ว (รอตรวจ)'}
                        </span>
                        <button data-submit-hw="${hw.id}" class="btn-secondary text-xs px-3.5 py-1.5 rounded-xl font-heading font-semibold">แก้ไขงานที่ส่ง</button>
                      ` : `
                        <button data-submit-hw="${hw.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-heading font-bold shadow-md">📤 ส่งการบ้าน</button>
                      `}
                    ` : ''}

                    ${this.rbac.canManageHomework() ? `
                      <button data-grade-hw="${hw.id}" class="btn-primary text-xs px-4 py-2 rounded-xl font-heading font-bold">
                        🔍 ตรวจงานนักเรียน (${submissionCount})
                      </button>
                      <button data-edit-hw="${hw.id}" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-bold">
                        ✏️ แก้ไขการบ้าน
                      </button>
                      <button data-del-hw="${hw.id}" data-hw-title="${decodeMojibakeThai(hw.title)}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">ลบการบ้าน</button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind Image Lightbox Modal Preview Handlers
    containerEl.querySelectorAll('[data-preview-img]').forEach(box => {
      box.addEventListener('click', (e) => {
        const imgUrl = e.currentTarget.dataset.previewImg;
        showImagePreviewModal({
          imageUrl: imgUrl,
          title: `🖼️ รูปภาพประกอบโจทย์การบ้าน`
        });
      });
    });

    containerEl.querySelectorAll('[data-view-pdf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pdfUrl = e.currentTarget.dataset.viewPdf;
        const title = e.currentTarget.dataset.pdfTitle;
        showPDFPreviewModal({ pdfUrl, title });
      });
    });

    // Course Bindings
    containerEl.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit-course]') || e.target.closest('[data-del-course]')) return;
        this.selectedCourseId = e.currentTarget.dataset.courseId;
        this.render(containerEl);
      });
    });

    containerEl.querySelectorAll('[data-edit-course]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const courseId = e.currentTarget.dataset.editCourse;
        const targetCourse = courses.find(c => c.id === courseId);
        this.showCourseModal(targetCourse, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-course]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const courseId = e.currentTarget.dataset.delCourse;
        const courseName = e.currentTarget.dataset.courseName;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบรายวิชา',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายวิชา "${courseName}"?`,
          confirmText: 'ลบรายวิชา',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('courses', courseId);
          this.render(containerEl);
        }
      });
    });

    // Homework Action Handlers
    containerEl.querySelector('#btn-add-course')?.addEventListener('click', () => this.showCourseModal(null, () => this.render(containerEl)));
    containerEl.querySelector('#btn-add-hw')?.addEventListener('click', () => this.showHomeworkModal(null, () => this.render(containerEl)));

    containerEl.querySelectorAll('[data-edit-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.editHw;
        const targetHw = homeworkList.find(h => h.id === hwId);
        this.showHomeworkModal(targetHw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-submit-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.submitHw;
        const targetHw = homeworkList.find(h => h.id === hwId);
        this.showSubmissionModal(targetHw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-grade-hw]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hwId = e.currentTarget.dataset.gradeHw;
        const targetHw = homeworkList.find(h => h.id === hwId);
        this.showGradingModal(targetHw, () => this.render(containerEl));
      });
    });

    containerEl.querySelectorAll('[data-del-hw]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const hwId = e.currentTarget.dataset.delHw;
        const title = e.currentTarget.dataset.hwTitle;

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบการบ้าน',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบการบ้านเรื่อง "${title}"?`,
          confirmText: 'ลบการบ้าน',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          firebaseService.deleteItem('homework', hwId);
          this.render(containerEl);
        }
      });
    });
    } catch (err) {
      console.error('HomeworkModule render exception caught:', err);
      containerEl.innerHTML = `
        <div class="glass-card p-8 sm:p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-4 animate-fade-in">
          <div class="text-4xl">⚡</div>
          <div class="text-lg font-bold font-heading text-slate-800">กำลังรีเฟรชข้อมูลรายวิชาและการบ้าน...</div>
          <p class="text-xs text-slate-500 font-heading">ระบบกำลังซิงก์ข้อมูลจากเซิร์ฟเวอร์หลัก กรุณารอแปปเดียวครับ</p>
        </div>
      `;
    }
  }

  showCourseModal(targetCourse, refreshCb) {
    const isEdit = !!targetCourse;
    const users = firebaseService.getCollection('users');
    const teachers = users.filter(u => u.role === 'Teacher' || u.role === 'Admin');
    const studentUsers = users.filter(u => u.role === 'Student');

    const availableGrades = ['All', ...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ปวช.1', 'ปวช.2');

    const getRoomsForGrade = (targetGrade) => {
      let filtered = studentUsers;
      if (targetGrade !== 'All') {
        filtered = studentUsers.filter(s => s.grade === targetGrade);
      }
      const rooms = [...new Set(filtered.map(s => s.room).filter(r => r && r !== '-'))].sort();
      if (rooms.length === 0) rooms.push('1', '2', '3');
      return rooms;
    };

    const modalHTML = `
      <div id="course-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลรายวิชา' : '➕ เพิ่มรายวิชาใหม่'}
            </h3>
            <button id="close-course-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="crs-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รหัสวิชา</label>
              <input type="text" id="crs-code" value="${isEdit ? targetCourse.code : ''}" required class="input-field" placeholder="เช่น ค21101">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ชื่อรายวิชา</label>
              <input type="text" id="crs-name" value="${isEdit ? targetCourse.name : ''}" required class="input-field" placeholder="เช่น คณิตศาสตร์พื้นฐาน ม.1">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ครูผู้สอนประจำวิชา</label>
              <select id="crs-teacher" class="input-field">
                ${teachers.map(t => `
                  <option value="${t.name}" ${isEdit && targetCourse.teacher === t.name ? 'selected' : ''}>
                    ${t.name} (${t.role})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Target Grade & Dynamic Multi-Room Selection -->
            <div class="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-indigo-900">🏫 กำหนดระดับชั้นและห้องเรียนที่สอน (Multi-Room Selection)</label>
              
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">1. เลือกระดับชั้นก่อน</label>
                <select id="crs-target-grade" class="input-field py-1 text-xs">
                  ${availableGrades.map(g => `
                    <option value="${g}" ${isEdit && targetCourse.targetGrade === g ? 'selected' : ''}>
                      ${g === 'All' ? '🌐 ทุกระดับชั้น (All Grades)' : g}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-indigo-900 mb-1">2. เลือกห้องเรียน (ดึงเฉพาะห้องที่มีในระบบของระดับชั้นที่เลือก สามารถเลือกได้หลายห้อง)</label>
                <div id="crs-rooms-checklist" class="grid grid-cols-3 gap-2 pt-1"></div>
              </div>
              <p class="text-[11px] text-indigo-700 italic">* สามารถติ๊กเลือกหลายห้องพร้อมกันได้</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หน่วยกิต</label>
              <input type="number" step="0.5" id="crs-credits" value="${isEdit ? targetCourse.credits : 1.5}" required class="input-field">
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-course-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">
                ${isEdit ? 'บันทึกการแก้ไข' : 'สร้างรายวิชา'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('course-modal');

    const gradeSelect = modalEl.querySelector('#crs-target-grade');
    const checklistContainer = modalEl.querySelector('#crs-rooms-checklist');

    const updateCourseRoomChecklist = () => {
      const selectedGrade = gradeSelect.value;
      const rooms = getRoomsForGrade(selectedGrade);
      const currentSelectedRooms = isEdit && targetCourse.targetRooms ? targetCourse.targetRooms : ['All'];

      checklistContainer.innerHTML = `
        <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
          <input type="checkbox" name="crs_room_check" value="All" ${currentSelectedRooms.includes('All') ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
          <span>🌐 ทุกห้อง</span>
        </label>
        ${rooms.map(r => `
          <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
            <input type="checkbox" name="crs_room_check" value="${r}" ${currentSelectedRooms.includes(r) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
            <span>🏫 ห้อง ${r}</span>
          </label>
        `).join('')}
      `;
    };

    updateCourseRoomChecklist();
    gradeSelect.addEventListener('change', updateCourseRoomChecklist);

    modalEl.querySelectorAll('#close-course-modal, #close-course-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#crs-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const checkboxes = modalEl.querySelectorAll('input[name="crs_room_check"]:checked');
      let selectedRooms = Array.from(checkboxes).map(cb => cb.value);
      if (selectedRooms.length === 0) selectedRooms = ['All'];

      const payload = {
        code: document.getElementById('crs-code').value.trim(),
        name: document.getElementById('crs-name').value.trim(),
        teacher: document.getElementById('crs-teacher').value,
        targetGrade: document.getElementById('crs-target-grade').value,
        targetRooms: selectedRooms,
        credits: parseFloat(document.getElementById('crs-credits').value),
        color: 'from-blue-600 to-indigo-600'
      };

      if (isEdit) {
        firebaseService.updateItem('courses', targetCourse.id, payload);
      } else {
        firebaseService.addItem('courses', payload);
      }

      modalEl.remove();

      await showAlertModal({
        title: '💾 บันทึกรายวิชาสำเร็จ',
        message: `${isEdit ? 'แก้ไข' : 'สร้าง'} รายวิชา "${payload.name}" เรียบร้อยแล้ว`,
        type: 'success'
      });

      refreshCb();
    });
  }

  showHomeworkModal(targetHw = null, refreshCb) {
    if (typeof targetHw === 'function') {
      refreshCb = targetHw;
      targetHw = null;
    }
    const isEdit = !!targetHw;

    const allCourses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const currentUser = this.rbac.getCurrentUser();

    let availableCourses = allCourses;
    if (currentUser.role === 'Teacher') {
      availableCourses = allCourses.filter(c => decodeMojibakeThai(c.teacher) === decodeMojibakeThai(currentUser.name));
    }

    const studentUsers = users.filter(u => u.role === 'Student');

    const availableGrades = ['All', ...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ปวช.1', 'ปวช.2');

    const getRoomsForGrade = (targetGrade) => {
      let filtered = studentUsers;
      if (targetGrade !== 'All') {
        filtered = studentUsers.filter(s => s.grade === targetGrade);
      }
      const rooms = [...new Set(filtered.map(s => s.room).filter(r => r && r !== '-'))].sort();
      if (rooms.length === 0) rooms.push('1', '2', '3');
      return rooms;
    };

    let attachedImages = isEdit && targetHw 
      ? (Array.isArray(targetHw.images) ? [...targetHw.images] : (targetHw.imageUrl ? [targetHw.imageUrl] : []))
      : [];

    let attachedVideos = isEdit && targetHw 
      ? (Array.isArray(targetHw.youtubeVideos) ? [...targetHw.youtubeVideos] : (targetHw.youtubeUrl ? [targetHw.youtubeUrl] : []))
      : [];

    let attachedPdfs = isEdit && targetHw 
      ? (Array.isArray(targetHw.pdfFiles) ? [...targetHw.pdfFiles] : (targetHw.pdfFile ? [targetHw.pdfFile] : []))
      : [];

    const modalHTML = `
      <div id="hw-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-xl p-6 md:p-8 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">
              ${isEdit ? '✏️ แก้ไขข้อมูลการบ้าน' : '📝 สั่งการบ้านใหม่'}
            </h3>
            <button id="close-hw-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <form id="hw-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">รายวิชา</label>
              <select id="hw-course" class="input-field">
                ${availableCourses.map(c => `
                  <option value="${c.id}" ${isEdit && targetHw.courseId === c.id ? 'selected' : (this.selectedCourseId === c.id ? 'selected' : '')}>
                    ${c.code} - ${c.name} (${c.teacher})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Target Grade & Dynamic Multi-Room Checklist -->
            <div class="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-indigo-900">🎯 กำหนดกลุ่มนักเรียนที่ได้รับมอบหมาย (Target Class & Multi-Room)</label>
              
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">ระดับชั้น</label>
                <select id="hw-target-grade" class="input-field py-1 text-xs">
                  ${availableGrades.map(g => `
                    <option value="${g}" ${isEdit && targetHw.targetGrade === g ? 'selected' : ''}>
                      ${g === 'All' ? '🌐 ทุกระดับชั้น (All Grades)' : g}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-indigo-900 mb-1">เลือกห้องเรียน (ดึงเฉพาะห้องที่มีในระบบของระดับชั้นที่เลือก)</label>
                <div id="hw-rooms-checklist" class="grid grid-cols-3 gap-2 pt-1"></div>
              </div>
              <p class="text-[11px] text-indigo-700 italic">* สามารถติ๊กเลือกหลายห้องพร้อมกันได้ นักเรียนห้องอื่นที่ไม่ได้ถูกเลือกจะไม่เห็นการบ้านนี้</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">หัวข้อการบ้าน</label>
              <input type="text" id="hw-title" required class="input-field" value="${isEdit ? decodeMojibakeThai(targetHw.title) : ''}" placeholder="เช่น แบบฝึกหัดบทที่ 2 เรื่อง พีชคณิต">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">คำอธิบายและโจทย์</label>
              <textarea id="hw-detail" rows="4" required class="input-field" placeholder="ระบุรายละเอียดโจทย์ขั้นตอนการทำ...">${isEdit ? decodeMojibakeThai(targetHw.detail) : ''}</textarea>
            </div>

            <!-- Multiple PDF Documents Attachment Section -->
            <div class="p-4 bg-rose-50/40 border border-rose-200/80 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-rose-800 font-heading">📄 แนบไฟล์เอกสาร PDF ประกอบการเรียน (แนบได้หลายไฟล์)</span>
                <span class="text-[11px] font-normal text-slate-500" id="pdf-count-badge">0 ไฟล์</span>
              </label>

              <!-- PDF List Preview -->
              <div id="hw-attached-pdf-list" class="space-y-2"></div>

              <!-- Animated PDF Upload Status Indicator -->
              <div id="hw-pdf-upload-status" class="hidden text-[11px] font-bold p-2.5 rounded-xl border transition-all text-center font-heading"></div>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <label class="btn-secondary text-xs px-3 py-2 rounded-xl font-heading font-bold cursor-pointer flex items-center justify-center gap-1 shrink-0 border-rose-200 hover:bg-rose-50 text-rose-700">
                  <span>📄 เลือกไฟล์ PDF จากเครื่อง</span>
                  <input type="file" id="hw-pdf-file-input" accept="application/pdf,.pdf" class="hidden" multiple>
                </label>
                <div class="flex items-center gap-1.5 flex-1">
                  <input type="url" id="hw-pdf-url-input" class="input-field py-1.5 text-xs border-rose-200" placeholder="วาง URL เอกสาร PDF (เช่น https://.../file.pdf)">
                  <button type="button" id="btn-add-pdf-url" class="btn-primary text-xs px-3 py-2 rounded-xl font-bold whitespace-nowrap bg-rose-600 hover:bg-rose-700 font-heading">➕ เพิ่ม PDF</button>
                </div>
              </div>
            </div>

            <!-- Multiple Images Attachment Section -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span class="flex items-center gap-1.5">📸 แนบรูปภาพประกอบโจทย์ (แนบได้หลายรูป)</span>
                <span class="text-[11px] font-normal text-slate-500" id="img-count-badge">0 รูป</span>
              </label>

              <!-- Image List Preview -->
              <div id="hw-attached-imgs-grid" class="grid grid-cols-3 gap-2"></div>

              <!-- Animated Upload Status Indicator -->
              <div id="hw-img-upload-status" class="hidden text-[11px] font-bold p-2.5 rounded-xl border transition-all text-center"></div>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <label class="btn-secondary text-xs px-3 py-2 rounded-xl font-heading font-bold cursor-pointer flex items-center justify-center gap-1 shrink-0">
                  <span>📸 เลือกรูปภาพจากเครื่อง</span>
                  <input type="file" id="hw-img-file-input" accept="image/*" class="hidden" multiple>
                </label>
                <div class="flex items-center gap-1.5 flex-1">
                  <input type="url" id="hw-img-url-input" class="input-field py-1.5 text-xs" placeholder="วาง URL รูปภาพ...">
                  <button type="button" id="btn-add-img-url" class="btn-secondary text-xs px-3 py-2 rounded-xl font-bold whitespace-nowrap">➕ เพิ่ม</button>
                </div>
              </div>
            </div>

            <!-- Multiple YouTube Videos Attachment Section -->
            <div class="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl space-y-3">
              <label class="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-rose-700">🎥 แนบวิดีโอสอนเพิ่มเติมจาก YouTube (แนบได้หลายวิดีโอ)</span>
                <span class="text-[11px] font-normal text-slate-500" id="yt-count-badge">0 วิดีโอ</span>
              </label>

              <!-- YouTube Videos List Preview -->
              <div id="hw-attached-yt-list" class="space-y-2"></div>

              <div class="flex items-center gap-1.5 pt-1">
                <input type="url" id="hw-yt-url-input" class="input-field py-1.5 text-xs border-rose-200" placeholder="วางลิงก์ YouTube (เช่น https://www.youtube.com/watch?v=...)">
                <button type="button" id="btn-add-yt-url" class="btn-primary text-xs px-3 py-2 rounded-xl font-bold whitespace-nowrap bg-rose-600 hover:bg-rose-700">➕ เพิ่มวิดีโอ</button>
              </div>

              <!-- Instant YouTube Live Video Preview Box -->
              <div id="hw-yt-instant-preview" class="hidden p-3 bg-slate-900 rounded-2xl border border-rose-200 text-center space-y-2">
                <div class="text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1.5 font-heading">
                  <span>🎥 ตัวอย่างวิดีโอ (Instant Live Video Preview):</span>
                </div>
                <div class="aspect-video w-full rounded-xl overflow-hidden shadow-md bg-black">
                  <iframe id="hw-yt-instant-iframe" src="" title="YouTube Video Preview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">กำหนดส่ง</label>
                <input type="date" id="hw-date" required class="input-field" value="${isEdit ? targetHw.dueDate : new Date().toISOString().substring(0, 10)}">
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">คะแนนเต็ม</label>
                <input type="number" id="hw-pts" value="${isEdit ? targetHw.maxPoints : 20}" required class="input-field">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-hw-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" class="btn-primary px-6 py-2 rounded-xl text-sm font-medium font-heading">
                ${isEdit ? 'บันทึกการแก้ไข' : 'สั่งการบ้าน'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('hw-modal');
    const gradeSelect = modalEl.querySelector('#hw-target-grade');
    const checklistContainer = modalEl.querySelector('#hw-rooms-checklist');

    const renderAttachedImgs = () => {
      const grid = modalEl.querySelector('#hw-attached-imgs-grid');
      const badge = modalEl.querySelector('#img-count-badge');
      if (badge) badge.textContent = `${attachedImages.length} รูป`;

      if (grid) {
        grid.innerHTML = attachedImages.length === 0 ? `
          <div class="col-span-3 text-center py-3 text-slate-400 text-xs italic">ยังไม่มีรูปภาพที่แนบ</div>
        ` : attachedImages.map((img, idx) => `
          <div class="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black/5">
            <img src="${img}" class="w-full h-full object-cover">
            <button type="button" data-remove-img="${idx}" class="absolute top-1 right-1 bg-rose-600 text-white rounded-lg p-1 text-[10px] shadow font-bold hover:bg-rose-700">
              ✕
            </button>
          </div>
        `).join('');

        grid.querySelectorAll('[data-remove-img]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.removeImg, 10);
            attachedImages.splice(idx, 1);
            renderAttachedImgs();
          });
        });
      }
    };

    const renderAttachedYt = () => {
      const list = modalEl.querySelector('#hw-attached-yt-list');
      const badge = modalEl.querySelector('#yt-count-badge');
      if (badge) badge.textContent = `${attachedVideos.length} วิดีโอ`;

      if (list) {
        list.innerHTML = attachedVideos.length === 0 ? `
          <div class="text-center py-2 text-slate-400 text-xs italic">ยังไม่มีวิดีโอ YouTube ที่แนบ</div>
        ` : attachedVideos.map((ytUrl, idx) => {
          const ytId = extractYouTubeId(ytUrl);
          return `
            <div class="p-2.5 bg-white rounded-2xl border border-rose-200 text-xs space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 overflow-hidden">
                  ${ytId ? `<img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-12 h-8 object-cover rounded-lg shrink-0">` : '🎥'}
                  <span class="font-mono text-slate-700 truncate text-[11px] font-bold">${ytUrl}</span>
                </div>
                <button type="button" data-remove-yt="${idx}" class="text-rose-600 hover:text-rose-800 text-xs font-bold shrink-0 px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg">
                  🗑️ ลบวิดีโอ
                </button>
              </div>
              ${ytId ? `
                <div class="aspect-video w-full rounded-xl overflow-hidden shadow-sm bg-black border border-slate-200">
                  <iframe src="https://www.youtube.com/embed/${ytId}" title="Attached YouTube Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        list.querySelectorAll('[data-remove-yt]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.removeYt, 10);
            attachedVideos.splice(idx, 1);
            renderAttachedYt();
          });
        });
      }
    };

    const renderAttachedPdfs = () => {
      const list = modalEl.querySelector('#hw-attached-pdf-list');
      const badge = modalEl.querySelector('#pdf-count-badge');
      if (badge) badge.textContent = `${attachedPdfs.length} ไฟล์`;

      if (list) {
        list.innerHTML = attachedPdfs.length === 0 ? `
          <div class="text-center py-2 text-slate-400 text-xs italic font-heading">ยังไม่มีไฟล์ PDF ที่แนบ</div>
        ` : attachedPdfs.map((pdf, idx) => {
          const pdfUrl = typeof pdf === 'string' ? pdf : pdf.url;
          const pdfName = typeof pdf === 'object' && pdf.name ? pdf.name : `เอกสาร_PDF_${idx + 1}.pdf`;
          return `
            <div class="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-rose-200 text-xs gap-2 shadow-xs">
              <div class="flex items-center gap-2 overflow-hidden">
                <div class="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  PDF
                </div>
                <div class="overflow-hidden">
                  <div class="font-bold text-slate-900 truncate text-xs font-heading">${pdfName}</div>
                  <div class="text-[10px] text-slate-500 font-mono truncate">${pdfUrl}</div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-view-pdf="${pdfUrl}" data-pdf-title="${pdfName}" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg">
                  👁️ ดูเอกสาร
                </button>
                <button type="button" data-remove-pdf="${idx}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          `;
        }).join('');

        list.querySelectorAll('[data-remove-pdf]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.removePdf, 10);
            attachedPdfs.splice(idx, 1);
            renderAttachedPdfs();
          });
        });

        list.querySelectorAll('[data-view-pdf]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const pdfUrl = e.currentTarget.dataset.viewPdf;
            const title = e.currentTarget.dataset.pdfTitle;
            showPDFPreviewModal({ pdfUrl, title });
          });
        });
      }
    };

    renderAttachedImgs();
    renderAttachedYt();
    renderAttachedPdfs();

    // PDF Upload Event Handlers with Status Indicator
    const pdfUploadStatus = modalEl.querySelector('#hw-pdf-upload-status');

    modalEl.querySelector('#hw-pdf-file-input')?.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        if (pdfUploadStatus) {
          pdfUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-amber-50 text-amber-800 border-amber-200 animate-pulse text-center block';
          pdfUploadStatus.innerHTML = `⏳ กำลังประมวลผลและอ่านไฟล์ PDF...`;
        }

        for (let file of e.target.files) {
          if (pdfUploadStatus) {
            pdfUploadStatus.innerHTML = `⏳ กำลังแนบไฟล์ <strong>${file.name}</strong>...`;
          }
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = (ev) => {
              attachedPdfs.push({
                name: file.name,
                url: ev.target.result
              });
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }

        renderAttachedPdfs();
        if (pdfUploadStatus) {
          pdfUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 text-center block';
          pdfUploadStatus.innerHTML = `✅ แนบไฟล์ PDF สำเร็จแล้ว! (รวม ${attachedPdfs.length} ไฟล์)`;
          setTimeout(() => pdfUploadStatus.classList.add('hidden'), 3500);
        }
      }
    });

    modalEl.querySelector('#btn-add-pdf-url')?.addEventListener('click', () => {
      const urlInput = modalEl.querySelector('#hw-pdf-url-input');
      const val = urlInput ? urlInput.value.trim() : '';
      if (val) {
        const filename = val.substring(val.lastIndexOf('/') + 1) || 'เอกสาร_PDF.pdf';
        attachedPdfs.push({
          name: decodeURIComponent(filename),
          url: val
        });
        urlInput.value = '';
        renderAttachedPdfs();
        if (pdfUploadStatus) {
          pdfUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 text-center block';
          pdfUploadStatus.innerHTML = `✅ เพิ่ม URL เอกสาร PDF สำเร็จ! (รวม ${attachedPdfs.length} ไฟล์)`;
          setTimeout(() => pdfUploadStatus.classList.add('hidden'), 3000);
        }
      }
    });

    // Image Upload Event Handlers with Animated Status Message
    const imgUploadStatus = modalEl.querySelector('#hw-img-upload-status');

    modalEl.querySelector('#hw-img-file-input')?.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        if (imgUploadStatus) {
          imgUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-amber-50 text-amber-800 border-amber-200 animate-pulse text-center block';
          imgUploadStatus.innerHTML = `⏳ กำลังประมวลผลและอัปโหลดรูปภาพขึ้น Cloudinary CDN...`;
        }

        for (let file of e.target.files) {
          if (imgUploadStatus) {
            imgUploadStatus.innerHTML = `⏳ กำลังอัปโหลดรูปภาพ <strong>${file.name}</strong> ขึ้น Cloudinary CDN...`;
          }
          try {
            const cdnUrl = await uploadImageToCloudinary(file, 1200, 0.8);
            attachedImages.push(cdnUrl);
          } catch (err) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              attachedImages.push(ev.target.result);
              renderAttachedImgs();
            };
            reader.readAsDataURL(file);
          }
        }

        renderAttachedImgs();
        if (imgUploadStatus) {
          imgUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 text-center block';
          imgUploadStatus.innerHTML = `✅ อัปโหลดรูปภาพขึ้น CDN สำเร็จแล้ว! (รวม ${attachedImages.length} รูป)`;
          setTimeout(() => imgUploadStatus.classList.add('hidden'), 3500);
        }
      }
    });

    modalEl.querySelector('#btn-add-img-url')?.addEventListener('click', () => {
      const urlInput = modalEl.querySelector('#hw-img-url-input');
      const val = urlInput ? urlInput.value.trim() : '';
      if (val) {
        attachedImages.push(val);
        urlInput.value = '';
        renderAttachedImgs();
        if (imgUploadStatus) {
          imgUploadStatus.className = 'text-[11px] font-bold p-2.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200 text-center block';
          imgUploadStatus.innerHTML = `✅ เพิ่ม URL รูปภาพสำเร็จ! (รวม ${attachedImages.length} รูป)`;
          setTimeout(() => imgUploadStatus.classList.add('hidden'), 3000);
        }
      }
    });

    // YouTube Instant Live Video Preview Handlers
    const ytInput = modalEl.querySelector('#hw-yt-url-input');
    const instantPreviewBox = modalEl.querySelector('#hw-yt-instant-preview');
    const instantIframe = modalEl.querySelector('#hw-yt-instant-iframe');

    const updateYtInstantPreview = () => {
      const val = ytInput ? ytInput.value.trim() : '';
      const ytId = extractYouTubeId(val);
      if (ytId && instantPreviewBox && instantIframe) {
        instantIframe.src = `https://www.youtube.com/embed/${ytId}`;
        instantPreviewBox.classList.remove('hidden');
      } else if (instantPreviewBox && instantIframe) {
        instantIframe.src = '';
        instantPreviewBox.classList.add('hidden');
      }
    };

    ytInput?.addEventListener('input', updateYtInstantPreview);
    ytInput?.addEventListener('keyup', updateYtInstantPreview);
    ytInput?.addEventListener('paste', () => setTimeout(updateYtInstantPreview, 50));
    ytInput?.addEventListener('change', updateYtInstantPreview);

    // YouTube Add Event Handler
    modalEl.querySelector('#btn-add-yt-url')?.addEventListener('click', async () => {
      const val = ytInput ? ytInput.value.trim() : '';
      if (val) {
        const ytId = extractYouTubeId(val);
        if (!ytId) {
          await showAlertModal({ title: '⚠️ ลิงก์ YouTube ไม่ถูกต้อง', message: 'กรุณาระบุลิงก์วิดีโอจาก YouTube ให้ถูกต้อง' });
          return;
        }
        attachedVideos.push(val);
        ytInput.value = '';
        updateYtInstantPreview();
        renderAttachedYt();
      }
    });

    const updateRoomChecklist = () => {
      const selectedGrade = gradeSelect.value;
      const rooms = getRoomsForGrade(selectedGrade);
      const currentSelectedRooms = isEdit && targetHw.targetRooms ? targetHw.targetRooms : ['All'];

      checklistContainer.innerHTML = `
        <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
          <input type="checkbox" name="hw_room_check" value="All" ${currentSelectedRooms.includes('All') ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
          <span>🌐 ทุกห้อง</span>
        </label>
        ${rooms.map(r => `
          <label class="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-indigo-100/60">
            <input type="checkbox" name="hw_room_check" value="${r}" ${currentSelectedRooms.includes(r) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
            <span>🏫 ห้อง ${r}</span>
          </label>
        `).join('')}
      `;
    };

    updateRoomChecklist();
    gradeSelect.addEventListener('change', updateRoomChecklist);

    modalEl.querySelectorAll('#close-hw-modal, #close-hw-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#hw-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const courseId = document.getElementById('hw-course').value;
      const targetCourse = allCourses.find(c => c.id === courseId);

      const checkboxes = modalEl.querySelectorAll('input[name="hw_room_check"]:checked');
      let selectedRooms = Array.from(checkboxes).map(cb => cb.value);
      if (selectedRooms.length === 0) selectedRooms = ['All'];

      if (isEdit) {
        const updates = {
          courseId: courseId,
          courseName: targetCourse ? targetCourse.name : (targetHw.courseName || ''),
          title: document.getElementById('hw-title').value.trim(),
          detail: document.getElementById('hw-detail').value.trim(),
          dueDate: document.getElementById('hw-date').value,
          maxPoints: parseInt(document.getElementById('hw-pts').value, 10),
          targetGrade: document.getElementById('hw-target-grade').value,
          targetRooms: selectedRooms,
          images: attachedImages,
          youtubeVideos: attachedVideos,
          pdfFiles: attachedPdfs
        };
        firebaseService.updateItem('homework', targetHw.id, updates);
      } else {
        const payload = {
          courseId: courseId,
          courseName: targetCourse ? targetCourse.name : '',
          title: document.getElementById('hw-title').value.trim(),
          detail: document.getElementById('hw-detail').value.trim(),
          dueDate: document.getElementById('hw-date').value,
          maxPoints: parseInt(document.getElementById('hw-pts').value, 10),
          targetGrade: document.getElementById('hw-target-grade').value,
          targetRooms: selectedRooms,
          images: attachedImages,
          youtubeVideos: attachedVideos,
          pdfFiles: attachedPdfs,
          submissions: []
        };
        firebaseService.addItem('homework', payload);
      }

      modalEl.remove();
      refreshCb();
    });
  }

  // Student Homework Submission Modal
  showSubmissionModal(hw, refreshCb) {
    const currentUser = this.rbac.getCurrentUser();
    const rawSubs = hw.submissions || [];
    const submissionsList = Array.isArray(rawSubs) ? rawSubs : Object.values(rawSubs);
    const validSubs = submissionsList.filter(s => s && typeof s === 'object');
    const existing = validSubs.find(s => s.studentId === currentUser.studentId);
    let uploadedImageUrl = existing ? (existing.imageFile || '') : '';

    const attachmentsImages = Array.isArray(hw.images) ? hw.images : (hw.imageUrl ? [hw.imageUrl] : []);
    const attachmentsVideos = Array.isArray(hw.youtubeVideos) ? hw.youtubeVideos : (hw.youtubeUrl ? [hw.youtubeUrl] : []);
    const attachmentsPdfs = Array.isArray(hw.pdfFiles) ? hw.pdfFiles : (hw.pdfFile ? [hw.pdfFile] : []);

    const modalHTML = `
      <div id="sub-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-xl p-6 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 class="text-xl font-bold text-slate-900 font-heading">📤 ส่งการบ้าน</h3>
            <button id="close-sub-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <!-- Homework Problem & Instructions Info Card -->
          <div class="mt-4 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100/90 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full font-heading">
                📚 ${decodeMojibakeThai(hw.courseName || 'ทั่วไป')}
              </span>
              <div class="flex items-center gap-3 text-[11px] text-slate-600 font-heading">
                <span>📅 กำหนดส่ง: <strong class="text-indigo-900 font-bold">${hw.dueDate || 'ไม่ระบุ'}</strong></span>
                <span>💯 คะแนนเต็ม: <strong class="text-emerald-700 font-bold">${hw.maxPoints || 20} คะแนน</strong></span>
              </div>
            </div>

            <div>
              <h4 class="font-extrabold text-slate-900 font-heading text-sm flex items-center gap-1.5">
                <span>📌 โจทย์/หัวข้อการบ้าน:</span> ${decodeMojibakeThai(hw.title)}
              </h4>
              <div class="text-xs text-slate-700 leading-relaxed mt-1.5 whitespace-pre-line bg-white/90 p-3 rounded-xl border border-indigo-100 shadow-sm">
                ${decodeMojibakeThai(hw.detail || 'ไม่มีรายละเอียดเพิ่มเติม')}
              </div>
            </div>

            <!-- Attached Images Gallery -->
            ${attachmentsImages.length > 0 ? `
              <div class="pt-2 border-t border-indigo-100/60 space-y-2">
                <div class="text-xs font-bold text-indigo-950 flex items-center justify-between">
                  <span>📸 รูปภาพประกอบโจทย์ (${attachmentsImages.length} รูป):</span>
                  <span class="text-[10px] text-indigo-600 font-normal">🔍 คลิกที่รูปเพื่อขยายรูปเต็ม</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  ${attachmentsImages.map(imgUrl => `
                    <div class="aspect-video rounded-xl overflow-hidden border border-indigo-200 shadow-xs relative group cursor-pointer" data-preview-img="${imgUrl}">
                      <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
                      <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                        🔍 ขยาย
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Embedded YouTube Players -->
            ${attachmentsVideos.length > 0 ? `
              <div class="pt-2 border-t border-indigo-100/60 space-y-2">
                <div class="text-xs font-bold text-rose-900 flex items-center gap-1">
                  <span>🎥 วิดีโอสอนเพิ่มเติมจาก YouTube (${attachmentsVideos.length} วิดีโอ):</span>
                </div>
                <div class="space-y-3">
                  ${attachmentsVideos.map(ytUrl => {
                    const ytId = extractYouTubeId(ytUrl);
                    if (!ytId) return '';
                    return `
                      <div class="aspect-video w-full rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-black">
                        <iframe 
                          src="https://www.youtube.com/embed/${ytId}" 
                          title="YouTube video player" 
                          frameborder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                          allowfullscreen 
                          class="w-full h-full"
                        ></iframe>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Embedded PDF Document Attachments -->
            ${attachmentsPdfs.length > 0 ? `
              <div class="pt-2 border-t border-indigo-100/60 space-y-2">
                <div class="text-xs font-bold text-rose-900 flex items-center gap-1 font-heading">
                  <span>📄 เอกสาร PDF ประกอบการเรียน (${attachmentsPdfs.length} ไฟล์):</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  ${attachmentsPdfs.map((pdf, pIdx) => {
                    const pdfUrl = typeof pdf === 'string' ? pdf : pdf.url;
                    const pdfName = typeof pdf === 'object' && pdf.name ? pdf.name : `เอกสารประกอบการเรียน_${pIdx + 1}.pdf`;
                    return `
                      <div class="p-2.5 bg-white border border-rose-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                        <div class="flex items-center gap-2 overflow-hidden">
                          <div class="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            PDF
                          </div>
                          <div class="overflow-hidden">
                            <div class="text-xs font-bold text-slate-900 font-heading truncate">${pdfName}</div>
                            <div class="text-[10px] text-slate-500 font-mono">เอกสารประกอบการเรียน</div>
                          </div>
                        </div>
                        <button type="button" data-view-pdf="${pdfUrl}" data-pdf-title="${pdfName}" class="btn-primary text-xs px-2.5 py-1 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 font-heading shrink-0">
                          👁️ อ่าน PDF
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <form id="sub-form" class="space-y-4 mt-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">ข้อความคำตอบ / รายละเอียดส่งงาน</label>
              <textarea id="sub-text" rows="3" required class="input-field" placeholder="พิมพ์คำตอบหรืออธิบายรายละเอียดงานที่ส่ง...">${existing ? existing.textResponse : ''}</textarea>
            </div>

            <!-- Cloudinary CDN Image Upload Dropzone -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">🖼️ แนบไฟล์ภาพชิ้นงาน (Cloudinary CDN gibfwtj2 & Data URL)</label>
              
              <input type="file" id="sub-img-input" accept="image/*" class="hidden">
              <div id="sub-img-dropzone" class="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 p-5 rounded-2xl text-center cursor-pointer transition-all">
                <div class="text-3xl mb-1">📸</div>
                <div id="sub-img-text" class="text-xs font-heading font-bold text-sky-800">
                  คลิกเพื่อถ่ายรูปหรือเลือกรูปภาพงานจากคอมพิวเตอร์ของคุณ
                </div>
                <div id="sub-img-status" class="text-[11px] text-slate-500 mt-1">
                  จัดเก็บไฟล์รูปบน Cloudinary CDN (gibfwtj2) ความละเอียดสูง คมชัดทุกอุปกรณ์ ☁️
                </div>
              </div>

              <!-- Compressed & CDN Image Live Preview Container -->
              <div id="sub-img-preview-box" class="${uploadedImageUrl ? '' : 'hidden'} mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center relative group">
                <div class="text-xs font-bold text-emerald-600 mb-2 flex items-center justify-center gap-1">
                  <span>✅</span> พร้อมส่งรูปภาพนี้ (อัปโหลดขึ้น CDN สำเร็จ)
                </div>
                <div class="max-h-48 rounded-xl overflow-hidden shadow-sm inline-block border border-slate-200">
                  <img id="sub-img-preview" src="${uploadedImageUrl}" class="max-h-48 w-auto object-contain">
                </div>
                <button type="button" id="btn-remove-sub-img" class="mt-2 text-rose-600 hover:text-rose-800 text-xs font-bold block mx-auto underline">
                  🗑️ เปลี่ยนรูปภาพใหม่
                </button>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" id="close-sub-btn" class="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">ยกเลิก</button>
              <button type="submit" id="btn-submit-hw-now" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading shadow-md">ส่งงานทันที</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('sub-modal');
    const fileInput = modalEl.querySelector('#sub-img-input');
    const dropzone = modalEl.querySelector('#sub-img-dropzone');
    const statusText = modalEl.querySelector('#sub-img-status');
    const previewBox = modalEl.querySelector('#sub-img-preview-box');
    const previewImg = modalEl.querySelector('#sub-img-preview');
    const removeBtn = modalEl.querySelector('#btn-remove-sub-img');

    // Bind image preview handlers for homework images
    modalEl.querySelectorAll('[data-preview-img]').forEach(box => {
      box.addEventListener('click', (e) => {
        const imgUrl = e.currentTarget.dataset.previewImg;
        showImagePreviewModal({
          imageUrl: imgUrl,
          title: `🖼️ รูปภาพประกอบโจทย์การบ้าน`
        });
      });
    });

    modalEl.querySelectorAll('[data-view-pdf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pdfUrl = e.currentTarget.dataset.viewPdf;
        const title = e.currentTarget.dataset.pdfTitle;
        showPDFPreviewModal({ pdfUrl, title });
      });
    });

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        statusText.innerHTML = `⏳ กำลังอัปโหลดภาพ <strong>${file.name}</strong> ขึ้น Cloudinary CDN (gibfwtj2)...`;
        
        try {
          uploadedImageUrl = await uploadImageToCloudinary(file, 1200, 0.8);
          previewImg.src = uploadedImageUrl;
          previewBox.classList.remove('hidden');
          statusText.innerHTML = `✅ อัปโหลดรูปภาพขึ้น Cloudinary CDN (gibfwtj2) สำเร็จ!`;
        } catch (err) {
          showAlertModal({ title: '⚠️ เกิดข้อผิดพลาด', message: 'ไม่สามารถประมวลผลไฟล์ภาพที่เลือกได้' });
          statusText.innerHTML = `❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ`;
        }
      }
    });

    removeBtn.addEventListener('click', () => {
      uploadedImageUrl = '';
      fileInput.value = '';
      previewImg.src = '';
      previewBox.classList.add('hidden');
      statusText.innerHTML = `จัดเก็บไฟล์รูปบน Cloudinary CDN (gibfwtj2) ความละเอียดสูง คมชัดทุกอุปกรณ์ ☁️`;
    });

    modalEl.querySelectorAll('#close-sub-modal, #close-sub-btn').forEach(b => b.addEventListener('click', () => modalEl.remove()));

    modalEl.querySelector('#sub-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const allHw = firebaseService.getCollection('homework');
      const activeHw = allHw.find(h => h.id === hw.id) || hw;

      const rawSubs = activeHw.submissions || {};
      let subsMap = {};
      
      if (Array.isArray(rawSubs)) {
        rawSubs.forEach(s => {
          if (s && s.studentId) subsMap[s.studentId] = s;
        });
      } else if (typeof rawSubs === 'object') {
        Object.assign(subsMap, rawSubs);
      }

      const existing = subsMap[currentUser.studentId];

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const localTimeString = `${year}-${month}-${day} ${hours}:${mins}`;

      const newSub = {
        studentId: currentUser.studentId || 'STD6701',
        studentName: currentUser.name,
        submittedAt: localTimeString,
        textResponse: document.getElementById('sub-text').value.trim(),
        imageFile: uploadedImageUrl,
        score: existing && existing.score !== undefined ? existing.score : null,
        feedback: existing ? (existing.feedback || '') : '',
        status: existing ? (existing.status || 'Pending') : 'Pending'
      };

      subsMap[currentUser.studentId] = newSub;

      firebaseService.updateItem('homework', hw.id, { submissions: subsMap });
      modalEl.remove();
      refreshCb();
    });
  }

  // Teacher Grading Modal
  showGradingModal(targetHw, refreshCb) {
    const allHw = firebaseService.getCollection('homework');
    const hw = allHw.find(h => h.id === targetHw.id) || targetHw;
    
    const rawSubs = hw.submissions || {};
    let submissions = Array.isArray(rawSubs) ? [...rawSubs] : Object.values(rawSubs);
    submissions = submissions.filter(s => s && typeof s === 'object');

    const gradedCount = submissions.filter(s => s.status === 'Graded').length;
    const pendingCount = submissions.length - gradedCount;

    const modalHTML = `
      <div id="grade-modal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-3xl p-6 md:p-8 rounded-3xl shadow-xl relative border border-slate-200 bg-white max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 class="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
                <span>🔍 ตรวจการบ้านนักเรียน</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">${decodeMojibakeThai(hw.title)} (คะแนนเต็ม ${hw.maxPoints} คะแนน)</p>
            </div>
            <button id="close-grade-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>

          <!-- Submission Summary & Search Controls Bar -->
          <div class="mt-4 p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-heading">
              <span class="font-bold text-indigo-900 flex items-center gap-1.5">
                <span>📊 จำนวนงานที่นักเรียนส่งมาทั้งหมด:</span>
                <strong class="text-indigo-600 text-sm font-extrabold">${submissions.length} คน</strong>
              </span>
              <div class="flex items-center gap-2">
                <span class="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">⏳ รอตรวจ ${pendingCount} คน</span>
                <span class="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">✅ ตรวจแล้ว ${gradedCount} คน</span>
              </div>
            </div>

            <!-- Search & Accordion Controls -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
              <div class="w-full sm:w-72">
                <input type="text" id="sub-search-input" class="input-field py-1.5 text-xs" placeholder="🔍 พิมพ์ชื่อ หรือ รหัสนักเรียนเพื่อค้นหา...">
              </div>
              <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button type="button" id="btn-expand-all-subs" class="btn-secondary text-[11px] px-3 py-1.5 rounded-xl font-bold font-heading bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                  📂 ขยายทั้งหมด
                </button>
                <button type="button" id="btn-collapse-all-subs" class="btn-secondary text-[11px] px-3 py-1.5 rounded-xl font-bold font-heading bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                  📁 พับทั้งหมด
                </button>
              </div>
            </div>
          </div>

          <!-- Student Roster List -->
          <div id="sub-roster-list" class="space-y-3 mt-4">
            ${submissions.length === 0 ? `
              <div class="text-center py-12 text-slate-400 text-sm font-heading">ยังไม่มีนักเรียนส่งงานในหัวข้อนี้</div>
            ` : submissions.map((sub, idx) => `
              <div class="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs transition-all hover:border-indigo-300 sub-card-item" data-sub-card="${sub.studentId}" data-student-name="${decodeMojibakeThai(sub.studentName)}" data-student-id="${sub.studentId}">
                
                <!-- Compact Clickable Student Header Row -->
                <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-transparent btn-toggle-sub" data-toggle-sub="${sub.studentId}">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <span class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs font-heading shrink-0">
                      ${idx + 1}
                    </span>
                    <div class="overflow-hidden">
                      <div class="font-bold text-slate-900 text-sm font-heading truncate flex items-center gap-2">
                        <span>${decodeMojibakeThai(sub.studentName)}</span>
                        <span class="text-[11px] text-slate-400 font-mono font-semibold">(${sub.studentId})</span>
                      </div>
                      <div class="text-[11px] text-slate-500 font-heading truncate">
                        📅 ส่งเมื่อ: ${sub.submittedAt}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold font-heading ${
                      sub.status === 'Graded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }">
                      ${sub.status === 'Graded' ? `✅ ตรวจแล้ว (${sub.score}/${hw.maxPoints})` : '⏳ รอตรวจ'}
                    </span>

                    <button type="button" class="btn-secondary text-xs px-3 py-1.5 rounded-xl font-bold font-heading flex items-center gap-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 border-slate-200">
                      <span class="sub-toggle-icon">▼</span>
                      <span class="sub-toggle-text hidden sm:inline">ดูงาน</span>
                    </button>
                  </div>
                </div>

                <!-- Expanded Detailed Panel (Hidden by Default) -->
                <div class="sub-detail-panel hidden p-4 sm:p-5 bg-slate-50/90 border-t border-slate-200/80 space-y-4">
                  <div class="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <div class="text-xs font-bold text-slate-700 font-heading">
                      📌 รายละเอียดคำตอบของ ${decodeMojibakeThai(sub.studentName)}
                    </div>
                    <button type="button" data-del-sub="${sub.studentId}" data-student-name="${decodeMojibakeThai(sub.studentName)}" class="text-rose-600 hover:text-rose-800 text-xs font-bold px-2.5 py-1 hover:bg-rose-50 rounded-lg transition-all font-heading" title="ลบงานชิ้นนี้">
                      🗑️ ลบงานชิ้นนี้
                    </button>
                  </div>

                  <div class="space-y-3 text-xs">
                    <div>
                      <span class="font-semibold text-slate-700 font-heading">ข้อความคำตอบนักเรียน:</span>
                      <p class="text-slate-800 bg-white p-3 rounded-xl border border-slate-200 mt-1 whitespace-pre-line font-sans">${decodeMojibakeThai(sub.textResponse || 'ไม่ได้พิมพ์ข้อความเพิ่มเติม')}</p>
                    </div>

                    ${sub.imageFile ? `
                      <div class="pt-2 border-t border-slate-200/60">
                        <div class="font-bold text-slate-700 mb-1.5 flex items-center justify-between font-heading">
                          <span class="flex items-center gap-1">📸 รูปภาพงานที่ส่ง (Cloudinary CDN):</span>
                          <span class="text-[11px] font-semibold text-indigo-600">🔍 คลิกรูปเพื่อดูขนาดย่อ/ขยายรูปเต็ม</span>
                        </div>
                        <div class="max-w-md rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900/5 relative group cursor-pointer" data-preview-img="${sub.imageFile}" data-student-name="${decodeMojibakeThai(sub.studentName)}">
                          <img src="${sub.imageFile}" class="w-full max-h-64 object-contain group-hover:scale-105 transition-transform">
                          <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[2px] font-heading">
                            <span class="text-base">🔍</span> คลิกเพื่อเปิดรูปภาพขนาดใหญ่
                          </div>
                        </div>
                      </div>
                    ` : ''}
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <div>
                      <label class="block text-[11px] font-semibold text-slate-600 mb-1 font-heading">ให้คะแนน (เต็ม ${hw.maxPoints})</label>
                      <input type="number" max="${hw.maxPoints}" data-std-id="${sub.studentId}" class="sub-score-input input-field py-1.5 text-xs bg-white" value="${sub.score !== null && sub.score !== undefined ? sub.score : ''}" placeholder="ระบุคะแนน">
                    </div>
                    <div>
                      <label class="block text-[11px] font-semibold text-slate-600 mb-1 font-heading">คำแนะนำ / ความเห็นครู</label>
                      <input type="text" data-std-id="${sub.studentId}" class="sub-feedback-input input-field py-1.5 text-xs bg-white" value="${sub.feedback || ''}" placeholder="เช่น ทำได้เยี่ยมมาก!">
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button id="close-grade-btn" class="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium font-heading">บันทึกการตรวจงานทั้งหมด</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalEl = document.getElementById('grade-modal');

    // Toggle Accordion Detail Handler
    modalEl.querySelectorAll('.btn-toggle-sub').forEach(header => {
      header.addEventListener('click', (e) => {
        const stdId = e.currentTarget.dataset.toggleSub;
        const card = modalEl.querySelector(`[data-sub-card="${stdId}"]`);
        if (!card) return;

        const detail = card.querySelector('.sub-detail-panel');
        const icon = card.querySelector('.sub-toggle-icon');
        const label = card.querySelector('.sub-toggle-text');

        if (detail.classList.contains('hidden')) {
          detail.classList.remove('hidden');
          if (icon) icon.textContent = '▲';
          if (label) label.textContent = 'ซ่อนงาน';
          card.classList.add('ring-2', 'ring-indigo-500/20');
        } else {
          detail.classList.add('hidden');
          if (icon) icon.textContent = '▼';
          if (label) label.textContent = 'ดูงาน';
          card.classList.remove('ring-2', 'ring-indigo-500/20');
        }
      });
    });

    // Expand All / Collapse All Handlers
    modalEl.querySelector('#btn-expand-all-subs')?.addEventListener('click', () => {
      modalEl.querySelectorAll('.sub-card-item').forEach(card => {
        const detail = card.querySelector('.sub-detail-panel');
        const icon = card.querySelector('.sub-toggle-icon');
        const label = card.querySelector('.sub-toggle-text');
        detail.classList.remove('hidden');
        if (icon) icon.textContent = '▲';
        if (label) label.textContent = 'ซ่อนงาน';
        card.classList.add('ring-2', 'ring-indigo-500/20');
      });
    });

    modalEl.querySelector('#btn-collapse-all-subs')?.addEventListener('click', () => {
      modalEl.querySelectorAll('.sub-card-item').forEach(card => {
        const detail = card.querySelector('.sub-detail-panel');
        const icon = card.querySelector('.sub-toggle-icon');
        const label = card.querySelector('.sub-toggle-text');
        detail.classList.add('hidden');
        if (icon) icon.textContent = '▼';
        if (label) label.textContent = 'ดูงาน';
        card.classList.remove('ring-2', 'ring-indigo-500/20');
      });
    });

    // Live Student Search Filter Handler
    modalEl.querySelector('#sub-search-input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      modalEl.querySelectorAll('.sub-card-item').forEach(card => {
        const name = (card.dataset.studentName || '').toLowerCase();
        const stdId = (card.dataset.studentId || '').toLowerCase();
        if (name.includes(q) || stdId.includes(q)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });

    // Bind Image Lightbox Modal Preview Handler
    modalEl.querySelectorAll('[data-preview-img]').forEach(box => {
      box.addEventListener('click', (e) => {
        const imgUrl = e.currentTarget.dataset.previewImg;
        const stdName = e.currentTarget.dataset.studentName;
        showImagePreviewModal({
          imageUrl: imgUrl,
          title: `🖼️ รูปภาพงานส่งของนักเรียน`,
          studentName: stdName
        });
      });
    });

    // Bind Delete Student Submission Handler
    modalEl.querySelectorAll('[data-del-sub]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const stdId = e.currentTarget.dataset.delSub;
        const stdName = e.currentTarget.dataset.studentName || 'นักเรียน';

        const confirmed = await showConfirmModal({
          title: '🗑️ ยืนยันการลบการส่งงาน',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบชิ้นงานการบ้านที่ส่งของ "${decodeMojibakeThai(stdName)}"? หลังจากลบแล้วนักเรียนจะสามารถเข้าส่งงานใหม่อีกครั้งได้`,
          confirmText: 'ลบการส่งงาน',
          cancelText: 'ยกเลิก'
        });

        if (confirmed) {
          const allHw = firebaseService.getCollection('homework');
          const activeHw = allHw.find(h => h.id === hw.id) || hw;
          
          const rawSubs = activeHw.submissions || {};
          let subsMap = {};
          if (Array.isArray(rawSubs)) {
            rawSubs.forEach(s => { if (s && s.studentId) subsMap[s.studentId] = s; });
          } else if (typeof rawSubs === 'object') {
            Object.assign(subsMap, rawSubs);
          }

          delete subsMap[stdId];

          activeHw.submissions = subsMap;
          hw.submissions = subsMap;

          await firebaseService.updateItem('homework', hw.id, { submissions: subsMap });
          modalEl.remove();

          await showAlertModal({
            title: '🗑️ ลบการส่งงานสำเร็จ',
            message: `ลบการส่งงานของ "${decodeMojibakeThai(stdName)}" เรียบร้อยแล้ว`,
            type: 'success'
          });

          this.showGradingModal(activeHw, refreshCb);
          refreshCb();
        }
      });
    });

    modalEl.querySelectorAll('#close-grade-modal, #close-grade-btn').forEach(b => {
      b.addEventListener('click', () => {
        const allHw = firebaseService.getCollection('homework');
        const activeHw = allHw.find(h => h.id === hw.id) || hw;
        
        const rawSubs = activeHw.submissions || {};
        let subsMap = {};
        if (Array.isArray(rawSubs)) {
          rawSubs.forEach(s => { if (s && s.studentId) subsMap[s.studentId] = s; });
        } else if (typeof rawSubs === 'object') {
          Object.assign(subsMap, rawSubs);
        }

        modalEl.querySelectorAll('.sub-score-input').forEach(input => {
          const stdId = input.dataset.stdId;
          const val = input.value !== '' ? parseInt(input.value, 10) : null;
          const fbInput = modalEl.querySelector(`.sub-feedback-input[data-std-id="${stdId}"]`);

          if (subsMap[stdId]) {
            subsMap[stdId].score = val;
            subsMap[stdId].feedback = fbInput ? fbInput.value.trim() : '';
            subsMap[stdId].status = val !== null ? 'Graded' : 'Pending';
          }
        });

        firebaseService.updateItem('homework', hw.id, { submissions: subsMap });
        modalEl.remove();
        refreshCb();
      });
    });
  }
}
