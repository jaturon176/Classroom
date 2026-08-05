/**
 * Gradebook & Reports Module
 * Consolidates homework & quiz scores, renders comparison charts, and exports PDF/Excel reports.
 */

import { firebaseService } from '../services/firebaseService.js';
import { exportToCSV, printPDFReport } from '../services/exportService.js';
import { decodeMojibakeThai } from '../services/mojibakeDecoder.js';

export class GradebookModule {
  constructor(rbac) {
    this.rbac = rbac;
    this.selectedGrade = 'ม.1';
    this.selectedRoom = '1';
  }

  render(containerEl) {
    const users = firebaseService.getCollection('users');
    const homeworkList = firebaseService.getCollection('homework') || [];
    const quizResults = firebaseService.getCollection('quiz_results') || [];

    const students = users.filter(u => u.role === 'Student' && u.grade === this.selectedGrade && u.room === this.selectedRoom);
    const currentUser = this.rbac.getCurrentUser();

    // Calculate consolidated scores per student
    const reportData = students.map(s => {
      let totalHwPoints = 0;
      let earnedHwPoints = 0;

      homeworkList.forEach(hw => {
        totalHwPoints += hw.maxPoints || 0;
        const sub = hw.submissions ? hw.submissions.find(subItem => subItem.studentId === s.studentId) : null;
        if (sub && sub.score !== null) {
          earnedHwPoints += sub.score;
        }
      });

      // Find highest quiz result
      const myQuizzes = quizResults.filter(q => q.studentId === s.studentId);
      const quizScore = myQuizzes.length > 0 ? Math.max(...myQuizzes.map(q => q.score)) : 0;
      const quizTotal = myQuizzes.length > 0 ? myQuizzes[0].total : 3;

      const grandTotalEarned = earnedHwPoints + quizScore;
      const grandTotalMax = totalHwPoints + quizTotal;
      const percentage = grandTotalMax > 0 ? Math.round((grandTotalEarned / grandTotalMax) * 100) : 0;

      let gradeLetter = 'F';
      if (percentage >= 80) gradeLetter = '4 (A)';
      else if (percentage >= 70) gradeLetter = '3 (B)';
      else if (percentage >= 60) gradeLetter = '2 (C)';
      else if (percentage >= 50) gradeLetter = '1 (D)';

      return {
        studentId: s.studentId,
        name: decodeMojibakeThai(s.name),
        grade: s.grade,
        room: s.room,
        earnedHwPoints,
        totalHwPoints,
        quizScore,
        quizTotal,
        grandTotalEarned,
        grandTotalMax,
        percentage,
        gradeLetter
      };
    });

    containerEl.innerHTML = `
      <div class="space-y-8 animate-fade-in">
        <!-- Header & Export Actions -->
        <div class="glass-card p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span class="p-2 bg-purple-500/10 text-purple-500 rounded-xl">📊</span>
              สมุดเก็บคะแนนและรายงาน (Gradebook & Reports)
            </h2>
            <p class="text-slate-500 text-xs mt-1">รวบรวมคะแนนการบ้าน + แบบทดสอบ, กราฟเปรียบเทียบ visual chart และพิมพ์ใบสรุปคะแนน PDF/Excel</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button id="btn-export-excel" class="btn-secondary text-xs px-4 py-2.5 rounded-xl font-bold border border-emerald-500/40 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20">
              📊 ส่งออก Excel / CSV
            </button>
            <button id="btn-export-pdf" class="btn-primary text-xs px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20">
              🖨️ พิมพ์ใบสรุปคะแนน PDF
            </button>
          </div>
        </div>

        <!-- Visual Analytics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Grade Distribution Box -->
          <div class="glass-card p-6 rounded-2xl shadow-xl space-y-4">
            <h3 class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <span>📈</span> การกระจายตัวของเกรด
            </h3>
            <div class="space-y-3 pt-2">
              ${['4 (A)', '3 (B)', '2 (C)', '1 (D)', 'F'].map(g => {
                const count = reportData.filter(r => r.gradeLetter === g).length;
                const pct = reportData.length > 0 ? Math.round((count / reportData.length) * 100) : 0;
                return `
                  <div>
                    <div class="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span>เกรด ${g}</span>
                      <span>${count} คน (${pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-1">
                      <div class="bg-indigo-500 h-full transition-all" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Score Breakdown Card -->
          <div class="glass-card p-6 rounded-2xl shadow-xl md:col-span-2 space-y-4">
            <h3 class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <span>📊</span> เปรียบเทียบคะแนนเฉลี่ยการบ้านเทียบกับแบบทดสอบ
            </h3>
            <div class="grid grid-cols-2 gap-4 py-4">
              <div class="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                <div class="text-xs text-indigo-500 font-bold uppercase">คะแนนการบ้านเฉลี่ย</div>
                <div class="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">
                  ${reportData.length > 0 ? Math.round(reportData.reduce((a, b) => a + b.earnedHwPoints, 0) / reportData.length) : 0} pts
                </div>
              </div>

              <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div class="text-xs text-emerald-500 font-bold uppercase">คะแนนแบบทดสอบเฉลี่ย</div>
                <div class="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">
                  ${reportData.length > 0 ? Math.round(reportData.reduce((a, b) => a + b.quizScore, 0) / reportData.length) : 0} pts
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gradebook Consolidated Matrix Table -->
        <div class="glass-card rounded-2xl overflow-hidden shadow-xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th class="p-4">รหัสนักเรียน</th>
                  <th class="p-4">ชื่อ-นามสกุล</th>
                  <th class="p-4">คะแนนการบ้าน</th>
                  <th class="p-4">คะแนนแบบทดสอบ</th>
                  <th class="p-4">คะแนนรวม</th>
                  <th class="p-4">คิดเป็น %</th>
                  <th class="p-4">ระดับเกรด</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-700/50 text-sm">
                ${reportData.length === 0 ? `
                  <tr><td colspan="7" class="text-center py-10 text-slate-400">ไม่พบข้อมูลคะแนนในกลุ่มนี้</td></tr>
                ` : reportData.map(r => `
                  <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="p-4 font-mono font-semibold text-indigo-500">${r.studentId}</td>
                    <td class="p-4 font-medium text-slate-900 dark:text-white">${r.name}</td>
                    <td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${r.earnedHwPoints} / ${r.totalHwPoints}</td>
                    <td class="p-4 text-slate-600 dark:text-slate-300 font-mono">${r.quizScore} / ${r.quizTotal}</td>
                    <td class="p-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">${r.grandTotalEarned} / ${r.grandTotalMax}</td>
                    <td class="p-4 font-bold font-mono text-slate-700 dark:text-slate-200">${r.percentage}%</td>
                    <td class="p-4">
                      <span class="px-3 py-1 rounded-full text-xs font-bold ${
                        r.gradeLetter.startsWith('4') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        r.gradeLetter.startsWith('3') ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
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

    // Action Handlers
    containerEl.querySelector('#btn-export-excel')?.addEventListener('click', () => {
      const exportRows = reportData.map(r => ({
        'รหัสนักเรียน': r.studentId,
        'ชื่อ-นามสกุล': r.name,
        'คะแนนการบ้าน': `${r.earnedHwPoints}/${r.totalHwPoints}`,
        'คะแนนแบบทดสอบ': `${r.quizScore}/${r.quizTotal}`,
        'คะแนนรวม': r.grandTotalEarned,
        'คะแนนเต็ม': r.grandTotalMax,
        'ร้อยละ (%)': `${r.percentage}%`,
        'เกรด': r.gradeLetter
      }));
      exportToCSV(`Gradebook_${this.selectedGrade}_Room${this.selectedRoom}.csv`, exportRows);
    });

    containerEl.querySelector('#btn-export-pdf')?.addEventListener('click', () => {
      const headers = ['รหัสนักเรียน', 'ชื่อ-นามสกุล', 'คะแนนการบ้าน', 'คะแนนแบบทดสอบ', 'คะแนนรวม', '%', 'เกรด'];
      const dataRows = reportData.map(r => [
        r.studentId,
        r.name,
        `${r.earnedHwPoints}/${r.totalHwPoints}`,
        `${r.quizScore}/${r.quizTotal}`,
        `${r.grandTotalEarned}/${r.grandTotalMax}`,
        `${r.percentage}%`,
        r.gradeLetter
      ]);

      printPDFReport(
        `ใบสรุปรายงานผลคะแนนนักเรียน ${this.selectedGrade} ห้อง ${this.selectedRoom}`,
        `ประจำปีการศึกษา 2026 - รวมคะแนนการบ้านและแบบทดสอบออนไลน์`,
        headers,
        dataRows
      );
    });
  }
}
