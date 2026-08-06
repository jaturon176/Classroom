/**
 * Attendance Module
 * Period attendance register with 4-state status toggles (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) and bulk toggles.
 * Dynamic Grade & Room Dropdowns pulled from system users.
 * 9 Class Periods Timetable starting from 08:40 - 09:30.
 * Multi-Period Selection: Check attendance for multiple consecutive periods simultaneously.
 * Official Government Font Detailed Attendance Reports & Analytics: Filter by Daily, Monthly, Semester & Checking Teacher.
 */

import { firebaseService } from '../services/firebaseService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';
import { showAlertModal } from '../services/dialogService.js';

export const PERIODS_LIST = [
  { id: 1, label: 'คาบ 1 (08:40 - 09:30)' },
  { id: 2, label: 'คาบ 2 (09:30 - 10:20)' },
  { id: 3, label: 'คาบ 3 (10:20 - 11:10)' },
  { id: 4, label: 'คาบ 4 (11:10 - 12:00)' },
  { id: 5, label: 'คาบ 5 (12:00 - 12:50)' },
  { id: 6, label: 'คาบ 6 (12:50 - 13:40)' },
  { id: 7, label: 'คาบ 7 (13:40 - 14:30)' },
  { id: 8, label: 'คาบ 8 (14:30 - 15:20)' },
  { id: 9, label: 'คาบ 9 (15:20 - 16:10)' }
];

export class AttendanceModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.activeView = 'register'; // 'register' | 'reports'
    this.selectedCourseId = 'All';
    this.selectedGrade = 'ม.1';
    this.selectedRoom = '1';
    this.selectedPeriods = ['คาบ 1 (08:40 - 09:30)'];
    this.attendanceDate = new Date().toISOString().substring(0, 10);

    // Report view states
    this.reportTimeframe = 'daily'; // 'daily' | 'monthly' | 'semester'
    this.reportDate = new Date().toISOString().substring(0, 10);
    this.reportMonth = new Date().toISOString().substring(0, 7);
    this.reportTeacherFilter = 'All';
  }

  render(containerEl) {
    if (this.activeView === 'reports') {
      this.renderReportView(containerEl);
    } else {
      this.renderRegisterView(containerEl);
    }
  }

  renderRegisterView(containerEl) {
    const courses = firebaseService.getCollection('courses');
    const users = firebaseService.getCollection('users');
    const attendanceList = firebaseService.getCollection('attendance');
    const currentUser = this.rbac.getCurrentUser();

    // Teacher Scope Control
    let visibleCourses = courses;
    if (currentUser.role === 'Teacher') {
      visibleCourses = courses.filter(c => decodeMojibakeThai(c.teacher) === decodeMojibakeThai(currentUser.name));
    }

    if (this.selectedCourseId === 'All' && visibleCourses.length > 0) {
      this.selectedCourseId = visibleCourses[0].id;
    }

    // Dynamic Grades & Rooms pulled from system users
    const studentUsers = users.filter(u => u.role === 'Student');
    const availableGrades = [...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))].sort();
    if (availableGrades.length === 0) availableGrades.push('ม.1', 'ม.2', 'ม.3');

    if (!availableGrades.includes(this.selectedGrade)) {
      this.selectedGrade = availableGrades[0];
    }

    let filteredForRoom = studentUsers.filter(s => s.grade === this.selectedGrade);
    const availableRooms = [...new Set(filteredForRoom.map(s => s.room).filter(r => r && r !== '-'))].sort();
    if (availableRooms.length === 0) availableRooms.push('1', '2', '3');

    if (!availableRooms.includes(this.selectedRoom)) {
      this.selectedRoom = availableRooms[0];
    }

    // Filter Students for selected grade and room
    const students = studentUsers.filter(u => 
      (this.selectedGrade === 'All' || u.grade === this.selectedGrade) && 
      (this.selectedRoom === 'All' || u.room === this.selectedRoom)
    ).sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

    // Load existing attendance record for first selected period
    const targetPeriod = this.selectedPeriods[0] || PERIODS_LIST[0].label;
    const existingEntry = attendanceList.find(a => 
      a.date === this.attendanceDate && 
      a.courseId === this.selectedCourseId && 
      a.period === targetPeriod
    );

    const recordsState = existingEntry ? { ...existingEntry.records } : {};

    // Fill defaults (Present) for missing students
    students.forEach(s => {
      if (!recordsState[s.studentId]) {
        recordsState[s.studentId] = 'Present';
      }
    });

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in font-sans">
        <!-- Header & View Mode Switcher -->
        <div class="glass-card p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
                <span class="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 text-xl">⏱️</span>
                เช็กชื่อรายคาบเรียน (Period Attendance Register)
              </h2>
            </div>
            <p class="text-slate-500 text-xs mt-1 font-heading">บันทึกเวลาเรียน 4 สถานะ (มา 🟢, สาย 🟡, ลา 🔵, ขาด 🔴) เลือกเช็กหลายคาบพร้อมกันได้</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- View Switch Pills -->
            <div class="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button id="btn-mode-register" class="px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${this.activeView === 'register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                📝 เช็กชื่อเข้าเรียน
              </button>
              <button id="btn-mode-reports" class="px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${this.activeView === 'reports' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                📊 สรุปและรายงานการเข้าเรียน
              </button>
            </div>

            <button id="btn-bulk-present" class="btn-secondary text-xs px-3.5 py-2 rounded-xl font-heading font-semibold">
              🟢 มาเรียนทั้งหมด
            </button>
            <button id="btn-save-attendance" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-semibold shadow-md shadow-indigo-500/20">
              💾 บันทึกการเช็กชื่อ (${this.selectedPeriods.length} คาบ)
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="glass-card p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white border border-slate-200">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">วันที่เช็กชื่อ</label>
            <input type="date" id="att-date" value="${this.attendanceDate}" class="input-field py-1.5 text-xs font-heading">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">รายวิชา</label>
            <select id="att-course" class="input-field py-1.5 text-xs font-heading">
              ${visibleCourses.map(c => `<option value="${c.id}" ${this.selectedCourseId === c.id ? 'selected' : ''}>${c.code} ${c.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">ระดับชั้น (ดึงจากระบบ)</label>
            <select id="att-grade" class="input-field py-1.5 text-xs font-heading">
              ${availableGrades.map(g => `<option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">ห้องเรียน (ดึงจากระบบ)</label>
            <select id="att-room" class="input-field py-1.5 text-xs font-heading">
              ${availableRooms.map(r => `<option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>ห้อง ${r}</option>`).join('')}
            </select>
          </div>

          <!-- Multi-Period Selection Bar (9 Periods Timetable) -->
          <div class="col-span-1 sm:col-span-2 lg:col-span-4 p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-indigo-900 flex items-center gap-1.5 font-heading">
                <span>⏱️ เลือกคาบเรียนที่สอน (สามารถติ๊กเลือกเช็กชื่อพร้อมกันได้มากกว่า 1 คาบ เช่น สอนวิชาเดียวกัน 2 คาบติด)</span>
              </label>
              <span class="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 font-heading">
                เลือกเช็ก ${this.selectedPeriods.length} คาบ
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-1.5 pt-1">
              ${PERIODS_LIST.map(p => {
                const isSelected = this.selectedPeriods.includes(p.label);
                return `
                  <label class="flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-semibold cursor-pointer transition-all ${
                    isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'
                  }">
                    <input type="checkbox" data-att-period-check="${p.label}" ${isSelected ? 'checked' : ''} class="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500">
                    <span class="truncate font-heading">${p.label}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Attendance Register Table (Official Government Font Sarabun) -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse font-sans">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4 text-center">เลขที่</th>
                  <th class="p-4">รหัสนักเรียน</th>
                  <th class="p-4">ชื่อ-นามสกุล</th>
                  <th class="p-4 text-center">ชั้น / ห้อง</th>
                  <th class="p-4 text-center">สถานะการเข้าเรียน</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm font-sans">
                ${students.length === 0 ? `
                  <tr><td colspan="5" class="text-center py-10 text-slate-400 font-heading">ไม่พบรายชื่อนักเรียนในระดับชั้น/ห้องนี้ในระบบ</td></tr>
                ` : students.map(s => {
                  const currentStatus = recordsState[s.studentId] || 'Present';
                  return `
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="p-4 text-center font-bold text-slate-800 font-heading">${s.no || '-'}</td>
                      <td class="p-4 font-mono text-indigo-600 font-bold">${s.studentId}</td>
                      <td class="p-4 font-medium text-slate-900 font-sans">${decodeMojibakeThai(s.name)}</td>
                      <td class="p-4 text-center">
                        <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-md font-bold font-heading">
                          ${s.grade} / ห้อง ${s.room}
                        </span>
                      </td>
                      <td class="p-4 text-center">
                        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1" data-student-status="${s.studentId}">
                          <button type="button" data-status="Present" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Present' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟢 มา</button>

                          <button type="button" data-status="Late" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Late' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🟡 สาย</button>

                          <button type="button" data-status="Leave" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Leave' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔵 ลา</button>

                          <button type="button" data-status="Absent" class="att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all ${
                            currentStatus === 'Absent' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }">🔴 ขาด</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Mode Switcher Handlers
    containerEl.querySelector('#btn-mode-register')?.addEventListener('click', () => {
      this.activeView = 'register';
      this.render(containerEl);
    });
    containerEl.querySelector('#btn-mode-reports')?.addEventListener('click', () => {
      this.activeView = 'reports';
      this.render(containerEl);
    });

    // Filter Change Event Handlers
    containerEl.querySelector('#att-date')?.addEventListener('change', (e) => {
      this.attendanceDate = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-course')?.addEventListener('change', (e) => {
      this.selectedCourseId = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-grade')?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#att-room')?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.render(containerEl);
    });

    // Multi-Period Checkbox Handlers
    containerEl.querySelectorAll('[data-att-period-check]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const periodLabel = e.target.dataset.attPeriodCheck;
        if (e.target.checked) {
          if (!this.selectedPeriods.includes(periodLabel)) {
            this.selectedPeriods.push(periodLabel);
          }
        } else {
          if (this.selectedPeriods.length > 1) {
            this.selectedPeriods = this.selectedPeriods.filter(p => p !== periodLabel);
          } else {
            e.target.checked = true; // Keep at least 1 period checked
          }
        }
        this.render(containerEl);
      });
    });

    // Toggle Button Event Handlers
    containerEl.querySelectorAll('[data-student-status]').forEach(group => {
      const studentId = group.dataset.studentStatus;
      group.querySelectorAll('.att-status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const status = e.currentTarget.dataset.status;
          recordsState[studentId] = status;

          // Re-render button highlights locally
          group.querySelectorAll('.att-status-btn').forEach(b => {
            b.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all text-slate-600 hover:text-slate-900';
          });

          if (status === 'Present') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-emerald-600 text-white shadow-sm';
          else if (status === 'Late') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-amber-500 text-white shadow-sm';
          else if (status === 'Leave') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-blue-500 text-white shadow-sm';
          else if (status === 'Absent') e.currentTarget.className = 'att-status-btn px-3 py-1.5 rounded-lg text-xs font-bold font-heading transition-all bg-rose-600 text-white shadow-sm';
        });
      });
    });

    // Bulk Present Handler
    containerEl.querySelector('#btn-bulk-present')?.addEventListener('click', () => {
      students.forEach(s => { recordsState[s.studentId] = 'Present'; });
      this.render(containerEl);
    });

    // Save Attendance Handler (Saves for ALL selected periods with checker teacher info)
    containerEl.querySelector('#btn-save-attendance')?.addEventListener('click', async () => {
      const allAttendance = firebaseService.getCollection('attendance');

      this.selectedPeriods.forEach(periodLabel => {
        const existingEntry = allAttendance.find(a => 
          a.date === this.attendanceDate && 
          a.courseId === this.selectedCourseId && 
          a.period === periodLabel
        );

        const payload = {
          date: this.attendanceDate,
          courseId: this.selectedCourseId,
          grade: this.selectedGrade,
          room: this.selectedRoom,
          period: periodLabel,
          checkerTeacher: currentUser.name,
          checkerRole: currentUser.role,
          records: recordsState
        };

        if (existingEntry) {
          firebaseService.updateItem('attendance', existingEntry.id, payload);
        } else {
          firebaseService.addItem('attendance', payload);
        }
      });

      await showAlertModal({
        title: '💾 บันทึกการเช็กชื่อสำเร็จ',
        message: `บันทึกการเช็กชื่อสำหรับ ${students.length} คน จำนวน ${this.selectedPeriods.length} คาบเรียน (${this.selectedPeriods.join(', ')}) เรียบร้อยแล้ว`,
        type: 'success'
      });
    });
  }

  // Render 2: Official Government Detailed Attendance Reports Mode
  renderReportView(containerEl) {
    const users = firebaseService.getCollection('users');
    const attendanceList = firebaseService.getCollection('attendance');
    const currentUser = this.rbac.getCurrentUser();

    // Extract dynamic Teachers list who checked attendance
    const teacherCheckers = [...new Set(attendanceList.map(a => decodeMojibakeThai(a.checkerTeacher)).filter(t => t && t !== 'undefined'))].sort();
    if (currentUser.role === 'Teacher' && !teacherCheckers.includes(decodeMojibakeThai(currentUser.name))) {
      teacherCheckers.unshift(decodeMojibakeThai(currentUser.name));
    }

    // Dynamic Grades & Rooms pulled from system users
    const studentUsers = users.filter(u => u.role === 'Student');
    const availableGrades = ['All', ...new Set(studentUsers.map(s => s.grade).filter(g => g && g !== '-'))].sort();
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3');

    let filteredForRoom = studentUsers;
    if (this.selectedGrade !== 'All') {
      filteredForRoom = studentUsers.filter(s => s.grade === this.selectedGrade);
    }
    const availableRooms = ['All', ...new Set(filteredForRoom.map(s => s.room).filter(r => r && r !== '-'))].sort();

    // Filter Attendance Entries based on Scope (Daily, Monthly, Semester), Teacher, Grade, Room
    const filteredAttendance = attendanceList.filter(a => {
      // Timeframe Filter
      if (this.reportTimeframe === 'daily') {
        if (a.date !== this.reportDate) return false;
      } else if (this.reportTimeframe === 'monthly') {
        if (!a.date || !a.date.startsWith(this.reportMonth)) return false;
      }

      // Teacher Checker Filter
      if (this.reportTeacherFilter !== 'All') {
        if (decodeMojibakeThai(a.checkerTeacher || '') !== this.reportTeacherFilter) return false;
      }

      // Grade Filter
      if (this.selectedGrade !== 'All') {
        if (a.grade && a.grade !== this.selectedGrade) return false;
      }

      // Room Filter
      if (this.selectedRoom !== 'All') {
        if (a.room && a.room !== this.selectedRoom) return false;
      }

      return true;
    });

    // Filter Students for Table View
    const targetStudents = studentUsers.filter(u => 
      (this.selectedGrade === 'All' || u.grade === this.selectedGrade) && 
      (this.selectedRoom === 'All' || u.room === this.selectedRoom)
    ).sort((a, b) => (parseInt(a.no, 10) || 999) - (parseInt(b.no, 10) || 999));

    // Calculate Detailed Student Attendance Summary Statistics
    let grandTotalPeriods = filteredAttendance.length;
    let totalP = 0, totalL = 0, totalV = 0, totalA = 0;

    const studentMatrix = targetStudents.map(s => {
      let pCount = 0, lCount = 0, vCount = 0, aCount = 0;
      let lastChecker = '-';

      filteredAttendance.forEach(att => {
        const status = (att.records && att.records[s.studentId]) || 'Present';
        if (status === 'Present') pCount++;
        else if (status === 'Late') lCount++;
        else if (status === 'Leave') vCount++;
        else if (status === 'Absent') aCount++;

        if (att.checkerTeacher) lastChecker = decodeMojibakeThai(att.checkerTeacher);
      });

      totalP += pCount;
      totalL += lCount;
      totalV += vCount;
      totalA += aCount;

      const totalStudentPeriods = pCount + lCount + vCount + aCount;
      const rate = totalStudentPeriods > 0 ? Math.round(((pCount + lCount + vCount) / totalStudentPeriods) * 100) : 100;
      const isPassed = rate >= 80;

      return {
        ...s,
        present: pCount,
        late: lCount,
        leave: vCount,
        absent: aCount,
        totalChecked: totalStudentPeriods,
        rate: rate,
        isPassed: isPassed,
        lastChecker: lastChecker
      };
    });

    const overallRate = (targetStudents.length * grandTotalPeriods) > 0 
      ? Math.round(((totalP + totalL + totalV) / (targetStudents.length * grandTotalPeriods)) * 100) 
      : 100;

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in font-sans">
        <!-- Header & View Mode Switcher -->
        <div class="glass-card p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 text-xl">📊</span>
              รายงานและสถิติการเข้าเรียน (Attendance Reports & Analytics)
            </h2>
            <p class="text-slate-500 text-xs mt-1 font-heading">แสดงรายงานละเอียดในรูปแบบฟอนต์สารบรรณราชการ ดูข้อมูลรายวัน รายเดือน รายภาคเรียน และรายครูผู้เช็ก</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- View Switch Pills -->
            <div class="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button id="btn-mode-register" class="px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${this.activeView === 'register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                📝 เช็กชื่อเข้าเรียน
              </button>
              <button id="btn-mode-reports" class="px-4 py-2 rounded-xl text-xs font-bold font-heading transition-all ${this.activeView === 'reports' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
                📊 สรุปและรายงานการเข้าเรียน
              </button>
            </div>

            <button id="btn-export-csv" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-heading font-semibold flex items-center gap-1">
              <span>📥</span> ส่งออก CSV
            </button>
            <button id="btn-print-report" class="btn-primary text-xs px-5 py-2.5 rounded-xl font-heading font-semibold shadow-md shadow-indigo-500/20 flex items-center gap-1">
              <span>🖨️</span> พิมพ์รายงานราชการ
            </button>
          </div>
        </div>

        <!-- Filter Controls (Timeframe Scope, Selected Date/Month, Teacher Checker Filter, Grade & Room) -->
        <div class="glass-card p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white border border-slate-200">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">1. รูปแบบรายงาน (Timeframe Scope)</label>
            <select id="report-timeframe" class="input-field py-1.5 text-xs font-heading">
              <option value="daily" ${this.reportTimeframe === 'daily' ? 'selected' : ''}>📅 รายงานรายวัน (Daily)</option>
              <option value="monthly" ${this.reportTimeframe === 'monthly' ? 'selected' : ''}>📆 รายงานรายเดือน (Monthly)</option>
              <option value="semester" ${this.reportTimeframe === 'semester' ? 'selected' : ''}>🏫 รายงานรวมภาคเรียน (Semester)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">2. วันที่ / เดือน ที่ต้องการดู</label>
            ${this.reportTimeframe === 'daily' ? `
              <input type="date" id="report-date-input" value="${this.reportDate}" class="input-field py-1.5 text-xs font-heading">
            ` : this.reportTimeframe === 'monthly' ? `
              <input type="month" id="report-month-input" value="${this.reportMonth}" class="input-field py-1.5 text-xs font-heading">
            ` : `
              <div class="input-field py-1.5 text-xs bg-slate-100 text-slate-600 font-heading">ภาคเรียนที่ 1 ปีการศึกษา 2026</div>
            `}
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">3. ครูผู้เช็กชื่อ (Checking Teacher)</label>
            <select id="report-teacher-filter" class="input-field py-1.5 text-xs font-heading">
              <option value="All">👥 ทุกครูผู้เช็กชื่อ (All Teachers)</option>
              ${teacherCheckers.map(t => `<option value="${t}" ${this.reportTeacherFilter === t ? 'selected' : ''}>👨‍🏫 ${t}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">4. ระดับชั้น (Grade)</label>
            <select id="report-grade" class="input-field py-1.5 text-xs font-heading">
              ${availableGrades.map(g => `<option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g === 'All' ? 'ทุกระดับชั้น' : g}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1 font-heading">5. ห้องเรียน (Room)</label>
            <select id="report-room" class="input-field py-1.5 text-xs font-heading">
              ${availableRooms.map(r => `<option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>${r === 'All' ? 'ทุกห้องเรียน' : 'ห้อง ' + r}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Summary Metrics Dashboard Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass-card p-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">🟢</div>
            <div>
              <div class="text-xs text-slate-500 font-heading">อัตราการมาเรียนเฉลี่ย</div>
              <div class="text-2xl font-extrabold text-slate-900 font-heading mt-0.5">${overallRate}%</div>
            </div>
          </div>

          <div class="glass-card p-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center text-2xl font-bold">🟡</div>
            <div>
              <div class="text-xs text-slate-500 font-heading">จำนวนรวมการมาสาย/ลา</div>
              <div class="text-2xl font-extrabold text-amber-600 font-heading mt-0.5">${totalL + totalV} ครั้ง</div>
            </div>
          </div>

          <div class="glass-card p-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-2xl font-bold">🔴</div>
            <div>
              <div class="text-xs text-slate-500 font-heading">จำนวนนักเรียนเสี่ยง มส. (<80%)</div>
              <div class="text-2xl font-extrabold text-rose-600 font-heading mt-0.5">${studentMatrix.filter(s => !s.isPassed).length} คน</div>
            </div>
          </div>

          <div class="glass-card p-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-bold">⏱️</div>
            <div>
              <div class="text-xs text-slate-500 font-heading">จำนวนรายการคาบเรียนที่บันทึก</div>
              <div class="text-2xl font-extrabold text-indigo-600 font-heading mt-0.5">${grandTotalPeriods} คาบ</div>
            </div>
          </div>
        </div>

        <!-- Official Detailed Attendance Matrix Table (Official Thai Font Sarabun) -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <h3 class="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <span>📋 ตารางสรุปประวัติการเข้าเรียนรายบุคคล (ตารางรูปแบบทางราชการ)</span>
            </h3>
            <span class="text-xs text-slate-500 font-heading">จำนวนทั้งหมด ${studentMatrix.length} คน</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse font-sans">
              <thead>
                <tr class="bg-slate-100 text-slate-800 text-xs font-heading font-extrabold uppercase tracking-wider border-b border-slate-300">
                  <th class="p-3.5 text-center whitespace-nowrap">เลขที่</th>
                  <th class="p-3.5 whitespace-nowrap">รหัสนักเรียน</th>
                  <th class="p-3.5 whitespace-nowrap">ชื่อ-นามสกุล นักเรียน</th>
                  <th class="p-3.5 text-center whitespace-nowrap">ชั้น / ห้อง</th>
                  <th class="p-3.5 text-center whitespace-nowrap">รวมคาบ</th>
                  <th class="p-3.5 text-center whitespace-nowrap text-emerald-700">มา 🟢</th>
                  <th class="p-3.5 text-center whitespace-nowrap text-amber-700">สาย 🟡</th>
                  <th class="p-3.5 text-center whitespace-nowrap text-blue-700">ลา 🔵</th>
                  <th class="p-3.5 text-center whitespace-nowrap text-rose-700">ขาด 🔴</th>
                  <th class="p-3.5 text-center whitespace-nowrap">% เข้าเรียน</th>
                  <th class="p-3.5 text-center whitespace-nowrap">ผลประเมิน</th>
                  <th class="p-3.5 text-center whitespace-nowrap">ครูผู้บันทึกล่าสุด</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 text-sm font-sans">
                ${studentMatrix.length === 0 ? `
                  <tr><td colspan="12" class="text-center py-12 text-slate-400 font-heading">ไม่พบข้อมูลประวัติการเช็กชื่อเข้าเรียนตามเงื่อนไขที่เลือก</td></tr>
                ` : studentMatrix.map(s => `
                  <tr class="hover:bg-indigo-50/40 transition-colors">
                    <td class="p-3.5 text-center font-bold text-slate-800 font-heading">${s.no || '-'}</td>
                    <td class="p-3.5 font-mono text-indigo-600 font-bold whitespace-nowrap">${s.studentId}</td>
                    <td class="p-3.5 font-bold text-slate-900 font-sans whitespace-nowrap">${decodeMojibakeThai(s.name)}</td>
                    <td class="p-3.5 text-center whitespace-nowrap">
                      <span class="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-1 rounded-md font-bold font-heading">
                        ${s.grade} / ห้อง ${s.room}
                      </span>
                    </td>
                    <td class="p-3.5 text-center font-mono font-bold text-slate-700 whitespace-nowrap">${s.totalChecked}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-emerald-600 whitespace-nowrap">${s.present}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-amber-600 whitespace-nowrap">${s.late}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-blue-600 whitespace-nowrap">${s.leave}</td>
                    <td class="p-3.5 text-center font-mono font-bold text-rose-600 whitespace-nowrap">${s.absent}</td>
                    <td class="p-3.5 text-center font-mono font-bold whitespace-nowrap">
                      <span class="${s.rate >= 80 ? 'text-emerald-700' : 'text-rose-600'}">${s.rate}%</span>
                    </td>
                    <td class="p-3.5 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-full text-xs font-bold font-heading inline-block ${
                        s.isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                      }">
                        ${s.isPassed ? '✅ ปกติ/ผ่าน' : '⚠️ เสี่ยง มส.'}
                      </span>
                    </td>
                    <td class="p-3.5 text-center font-heading text-xs text-slate-600 whitespace-nowrap">
                      ${s.lastChecker !== '-' ? '👨‍🏫 ' + s.lastChecker : '-'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Mode Switcher Handlers
    containerEl.querySelector('#btn-mode-register')?.addEventListener('click', () => {
      this.activeView = 'register';
      this.render(containerEl);
    });
    containerEl.querySelector('#btn-mode-reports')?.addEventListener('click', () => {
      this.activeView = 'reports';
      this.render(containerEl);
    });

    // Filter Control Event Handlers
    containerEl.querySelector('#report-timeframe')?.addEventListener('change', (e) => {
      this.reportTimeframe = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#report-date-input')?.addEventListener('change', (e) => {
      this.reportDate = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#report-month-input')?.addEventListener('change', (e) => {
      this.reportMonth = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#report-teacher-filter')?.addEventListener('change', (e) => {
      this.reportTeacherFilter = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#report-grade')?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.render(containerEl);
    });
    containerEl.querySelector('#report-room')?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.render(containerEl);
    });

    // CSV Export Handler
    containerEl.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น/ห้อง', 'รวมคาบ', 'มา', 'สาย', 'ลา', 'ขาด', 'อัตราเข้าเรียน(%)', 'ผลประเมิน', 'ครูผู้บันทึก'];
      const rows = studentMatrix.map(s => [
        s.no || '-',
        s.studentId,
        decodeMojibakeThai(s.name),
        `${s.grade}/${s.room}`,
        s.totalChecked,
        s.present,
        s.late,
        s.leave,
        s.absent,
        `${s.rate}%`,
        s.isPassed ? 'ปกติ' : 'เสี่ยง มส.',
        s.lastChecker
      ]);

      const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Attendance_Report_${this.selectedGrade}_${this.selectedRoom}_${this.reportTimeframe}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Official Print Handler
    containerEl.querySelector('#btn-print-report')?.addEventListener('click', () => {
      window.print();
    });
  }
}
