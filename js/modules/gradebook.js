/**
 * Gradebook & Reports Module
 * Consolidates homework & quiz scores, renders comparison charts,
 * provides filter controls (Search Individual, Filter by Grade, Filter by Room),
 * and exports PDF/Excel reports.
 */

import { firebaseService } from '../services/firebaseService.js';
import { exportToCSV, printPDFReport } from '../services/exportService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';

export class GradebookModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedGrade = 'All';
    this.selectedRoom = 'All';
    this.selectedCourse = 'All';
    this.searchQuery = '';
  }

  render(containerEl) {
    const users = firebaseService.getCollection('users');
    const courses = firebaseService.getCollection('courses') || [];
    const homeworkList = firebaseService.getCollection('homework') || [];
    const quizzes = firebaseService.getCollection('quizzes') || [];
    const currentUser = this.rbac.getCurrentUser();

    const allStudentUsers = users.filter(u => u.role === 'Student');

    // Available Grades
    const availableGrades = ['All', ...new Set(allStudentUsers.map(s => s.grade).filter(g => g && g !== '-'))];
    if (availableGrades.length === 1) availableGrades.push('ม.1', 'ม.2', 'ม.3', 'ปวช.1', 'ปวช.2');

    // Dynamic Available Rooms based on selected Grade
    let gradeFilteredUsers = allStudentUsers;
    if (this.selectedGrade !== 'All') {
      gradeFilteredUsers = allStudentUsers.filter(s => s.grade === this.selectedGrade);
    }
    const availableRooms = [...new Set(gradeFilteredUsers.map(s => s.room).filter(r => r && r !== '-'))].sort();

    // Apply Filters (1. Grade, 2. Room, 3. Individual Search Query)
    let filteredStudents = [...allStudentUsers];

    if (this.selectedGrade !== 'All') {
      filteredStudents = filteredStudents.filter(s => s.grade === this.selectedGrade);
    }

    if (this.selectedRoom !== 'All') {
      filteredStudents = filteredStudents.filter(s => s.room === this.selectedRoom);
    }

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(s => 
        (s.name && decodeMojibakeThai(s.name).toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q))
      );
    }

    // Sort students by Student Number (no / stdNo / number) or Student ID numerically
    filteredStudents.sort((a, b) => {
      const noA = parseInt(a.no || a.stdNo || a.studentNo || a.number, 10) || parseInt(a.studentId, 10) || 999999;
      const noB = parseInt(b.no || b.stdNo || b.studentNo || b.number, 10) || parseInt(b.studentId, 10) || 999999;
      if (noA !== noB) return noA - noB;
      return (a.studentId || '').localeCompare(b.studentId || '', undefined, { numeric: true });
    });

    // Filter Homework & Quizzes by selected Course
    let activeHomeworkList = homeworkList;
    let activeQuizzes = quizzes;

    if (this.selectedCourse !== 'All') {
      const targetCourseObj = courses.find(c => c.id === this.selectedCourse);
      const targetCourseName = targetCourseObj ? targetCourseObj.name : '';

      activeHomeworkList = homeworkList.filter(hw => hw.courseId === this.selectedCourse || (targetCourseName && hw.courseName === targetCourseName));
      activeQuizzes = quizzes.filter(q => q.courseId === this.selectedCourse || (targetCourseName && q.courseName === targetCourseName));
    }

    // Calculate consolidated scores per student
    const reportData = filteredStudents.map((s, idx) => {
      let totalHwPoints = 0;
      let earnedHwPoints = 0;

      activeHomeworkList.forEach(hw => {
        totalHwPoints += (hw.maxPoints || 20);
        const rawSubs = hw.submissions || {};
        const subsList = Array.isArray(rawSubs) ? rawSubs : Object.values(rawSubs);
        const sub = subsList.find(subItem => subItem && subItem.studentId === s.studentId);
        if (sub && sub.score !== null && sub.score !== undefined) {
          earnedHwPoints += sub.score;
        }
      });

      // Consolidate Quiz Scores from quizzes collection
      let totalQuizPoints = 0;
      let earnedQuizPoints = 0;

      activeQuizzes.forEach(q => {
        const qMax = q.questions ? q.questions.reduce((sum, item) => sum + (parseInt(item.points, 10) || 1), 0) : 1;
        totalQuizPoints += qMax;

        if (q.results && Array.isArray(q.results)) {
          const myResult = q.results.find(r => r.studentId === s.studentId || r.studentName === s.name);
          if (myResult) {
            earnedQuizPoints += (myResult.score || 0);
          }
        }
      });

      const grandTotalEarned = earnedHwPoints + earnedQuizPoints;
      const grandTotalMax = totalHwPoints + totalQuizPoints;
      const percentage = grandTotalMax > 0 ? Math.round((grandTotalEarned / grandTotalMax) * 100) : 0;

      let gradeLetter = 'F';
      if (percentage >= 80) gradeLetter = '4 (A)';
      else if (percentage >= 70) gradeLetter = '3 (B)';
      else if (percentage >= 60) gradeLetter = '2 (C)';
      else if (percentage >= 50) gradeLetter = '1 (D)';

      const stdNo = s.no || s.stdNo || s.studentNo || s.number || (idx + 1);

      return {
        no: stdNo,
        studentId: s.studentId || s.username || '-',
        name: decodeMojibakeThai(s.name),
        grade: s.grade || '-',
        room: s.room || '-',
        earnedHwPoints,
        totalHwPoints,
        earnedQuizPoints,
        totalQuizPoints,
        grandTotalEarned,
        grandTotalMax,
        percentage,
        gradeLetter
      };
    });

    containerEl.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Header & Export Actions -->
        <div class="glass-card p-6 md:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 text-xl">📊</span>
              สมุดเก็บคะแนนและรายงาน (Gradebook & Reports)
            </h2>
            <p class="text-slate-500 text-xs mt-1">รวบรวมคะแนนการบ้าน + แบบทดสอบ, คัดกรองรายวิชา รายชั้น รายห้อง และส่งออกไฟล์ PDF/Excel เรียงตามเลขที่</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button id="btn-export-excel" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-bold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
              📊 ส่งออก Excel / CSV
            </button>
            <button id="btn-export-pdf" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20">
              🖨️ พิมพ์ใบสรุปคะแนน PDF
            </button>
          </div>
        </div>

        <!-- Filter Controls Bar (คัดกรอง รายวิชา / รายชั้น / รายห้อง / รายบุคคล) -->
        <div class="glass-card p-6 rounded-3xl shadow-sm bg-white border border-slate-200 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <span class="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-lg">🔍</span>
              ตัวคัดกรองข้อมูลคะแนน (Score Filter Controls)
            </h3>
            <span class="text-xs text-slate-500 font-medium">พบทั้งหมด <strong class="text-indigo-600 font-bold">${reportData.length}</strong> รายชื่อ</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- 1. ค้นหารายบุคคล -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1 font-heading">
                <span>👤</span> ค้นหารายบุคคล (ชื่อ / รหัส)
              </label>
              <input type="text" id="filter-search" value="${this.searchQuery}" class="input-field py-2 text-xs" placeholder="พิมพ์ชื่อ หรือ รหัสนักเรียนเพื่อค้นหา...">
            </div>

            <!-- 2. คัดกรองรายวิชา (Course) -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1 font-heading">
                <span>📚</span> เลือกรายวิชา (Course)
              </label>
              <select id="filter-course" class="input-field py-2 text-xs">
                <option value="All" ${this.selectedCourse === 'All' ? 'selected' : ''}>🌐 ทุกรายวิชา (All Courses)</option>
                ${courses.map(c => `
                  <option value="${c.id}" ${this.selectedCourse === c.id ? 'selected' : ''}>📚 ${decodeMojibakeThai(c.name)} (${c.code || '-'})</option>
                `).join('')}
              </select>
            </div>

            <!-- 3. คัดกรองรายชั้น -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1 font-heading">
                <span>🏫</span> เลือกรายชั้น (Grade)
              </label>
              <select id="filter-grade" class="input-field py-2 text-xs">
                <option value="All" ${this.selectedGrade === 'All' ? 'selected' : ''}>🌐 ทุกระดับชั้น (All Grades)</option>
                ${availableGrades.filter(g => g !== 'All').map(g => `
                  <option value="${g}" ${this.selectedGrade === g ? 'selected' : ''}>${g}</option>
                `).join('')}
              </select>
            </div>

            <!-- 4. คัดกรองรายห้อง -->
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1 font-heading">
                <span>🚪</span> เลือกรายห้อง (Room)
              </label>
              <select id="filter-room" class="input-field py-2 text-xs">
                <option value="All" ${this.selectedRoom === 'All' ? 'selected' : ''}>🌐 ทุกห้องเรียน (All Rooms)</option>
                ${availableRooms.map(r => `
                  <option value="${r}" ${this.selectedRoom === r ? 'selected' : ''}>ห้อง ${r}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Gradebook Consolidated Matrix Table (Sorted by Student Number / เลขที่) -->
        <div class="glass-card rounded-3xl overflow-hidden shadow-sm bg-white border border-slate-200">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-700 text-xs font-heading font-bold uppercase tracking-wider border-b border-slate-200">
                  <th class="p-4 text-center whitespace-nowrap">เลขที่</th>
                  <th class="p-4 whitespace-nowrap">รหัสนักเรียน</th>
                  <th class="p-4 whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th class="p-4 text-center whitespace-nowrap">ระดับชั้น/ห้อง</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนการบ้าน</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนแบบทดสอบ</th>
                  <th class="p-4 text-center whitespace-nowrap">คะแนนรวม</th>
                  <th class="p-4 text-center whitespace-nowrap">คิดเป็น %</th>
                  <th class="p-4 text-center whitespace-nowrap">ระดับเกรด</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
                ${reportData.length === 0 ? `
                  <tr><td colspan="9" class="text-center py-10 text-slate-400">ไม่พบข้อมูลคะแนนตามเงื่อนไขการค้นหาที่เลือก</td></tr>
                ` : reportData.map(r => `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-4 text-center font-bold text-slate-600 font-mono whitespace-nowrap">${r.no}</td>
                    <td class="p-4 font-mono font-bold text-indigo-600 whitespace-nowrap">${r.studentId}</td>
                    <td class="p-4 font-bold text-slate-900 whitespace-nowrap">${r.name}</td>
                    <td class="p-4 text-center whitespace-nowrap">
                      <span class="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl font-semibold text-xs whitespace-nowrap inline-block">${r.grade}/${r.room}</span>
                    </td>
                    <td class="p-4 text-center text-slate-600 font-mono whitespace-nowrap">${r.earnedHwPoints} / ${r.totalHwPoints}</td>
                    <td class="p-4 text-center text-slate-600 font-mono whitespace-nowrap">${r.earnedQuizPoints} / ${r.totalQuizPoints}</td>
                    <td class="p-4 text-center font-bold text-indigo-600 font-mono whitespace-nowrap">${r.grandTotalEarned} / ${r.grandTotalMax}</td>
                    <td class="p-4 text-center font-bold font-mono text-slate-900 whitespace-nowrap">${r.percentage}%</td>
                    <td class="p-4 text-center whitespace-nowrap">
                      <span class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-block ${
                        r.gradeLetter.startsWith('4') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        r.gradeLetter.startsWith('3') ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                        r.gradeLetter.startsWith('2') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        r.gradeLetter.startsWith('1') ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }">
                        ${r.gradeLetter}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Filter Controls Handlers (Individual Search, Course Filter, Grade Filter, Room Filter)
    const searchInput = containerEl.querySelector('#filter-search');
    const courseSelect = containerEl.querySelector('#filter-course');
    const gradeSelect = containerEl.querySelector('#filter-grade');
    const roomSelect = containerEl.querySelector('#filter-room');

    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.render(containerEl);

      // Restore focus to input after re-render
      const newSearch = containerEl.querySelector('#filter-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
    });

    courseSelect?.addEventListener('change', (e) => {
      this.selectedCourse = e.target.value;
      this.render(containerEl);
    });

    gradeSelect?.addEventListener('change', (e) => {
      this.selectedGrade = e.target.value;
      this.selectedRoom = 'All'; // Reset room when grade changes
      this.render(containerEl);
    });

    roomSelect?.addEventListener('change', (e) => {
      this.selectedRoom = e.target.value;
      this.render(containerEl);
    });

    // Action Handlers for Export
    containerEl.querySelector('#btn-export-excel')?.addEventListener('click', () => {
      const exportRows = reportData.map(r => ({
        'เลขที่': r.no,
        'รหัสนักเรียน': r.studentId,
        'ชื่อ-นามสกุล': r.name,
        'ระดับชั้น': r.grade,
        'ห้อง': r.room,
        'คะแนนการบ้าน': `${r.earnedHwPoints}/${r.totalHwPoints}`,
        'คะแนนแบบทดสอบ': `${r.earnedQuizPoints}/${r.totalQuizPoints}`,
        'คะแนนรวม': r.grandTotalEarned,
        'คะแนนเต็ม': r.grandTotalMax,
        'ร้อยละ (%)': `${r.percentage}%`,
        'เกรด': r.gradeLetter
      }));
      const selectedCourseName = this.selectedCourse !== 'All' ? (courses.find(c => c.id === this.selectedCourse)?.name || '') : 'ทุกรายวิชา';
      exportToCSV(`Gradebook_${selectedCourseName}_Grade${this.selectedGrade}_Room${this.selectedRoom}.csv`, exportRows);
    });

    containerEl.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
      const selectedCourseObj = courses.find(c => c.id === this.selectedCourse);
      const selectedCourseTitle = selectedCourseObj ? decodeMojibakeThai(selectedCourseObj.name) : 'ทุกรายวิชา';

      const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชั้น/ห้อง', 'คะแนนการบ้าน', 'คะแนนแบบทดสอบ', 'คะแนนรวม', '%', 'เกรด'];
      const dataRows = reportData.map(r => [
        r.no,
        r.studentId,
        r.name,
        `${r.grade}/${r.room}`,
        `${r.earnedHwPoints}/${r.totalHwPoints}`,
        `${r.earnedQuizPoints}/${r.totalQuizPoints}`,
        `${r.grandTotalEarned}/${r.grandTotalMax}`,
        `${r.percentage}%`,
        r.gradeLetter
      ]);

      printPDFReport(
        `ใบสรุปรายงานผลคะแนนนักเรียน (${selectedCourseTitle} - ${this.selectedGrade === 'All' ? 'ทุกระดับชั้น' : this.selectedGrade} ${this.selectedRoom === 'All' ? 'ทุกห้อง' : 'ห้อง ' + this.selectedRoom})`,
        `ประจำปีการศึกษา 2026 - รวมคะแนนการบ้านและแบบทดสอบออนไลน์ (เรียงตามเลขที่รายชื่อ)`,
        headers,
        dataRows
      );
    });
  }
}
