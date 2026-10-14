/* ================= Progress, XP and streak =================
   Module progress lives with the module (and travels with it when shared "with progress").
   XP and the streak belong to the app: they keep counting across every module. */
const XP = { right: 10, partial: 5, lesson: 20, exam: 60 };

function recordTask(p, task, res) {
  const s = p.tasks[task.id] || (p.tasks[task.id] = { n: 0, ok: 0 });
  s.n++; if (res.status === 'right') s.ok++; s.last = Date.now();
}
function finishLesson(p, lesson, share) {
  const s = p.lessons[lesson.id] || (p.lessons[lesson.id] = { best: 0, runs: 0, done: false });
  s.runs++; s.best = Math.max(s.best, roundTo(share, 3)); s.last = Date.now();
  const was = s.done; if (share >= (lesson.practice ? lesson.practice.pass : 0)) s.done = true;
  return !was && s.done;
}
function lessonState(p, l) { return p.lessons[l.id] || { best: 0, runs: 0, done: false }; }
function moduleStats(m, p) {
  const total = m.lessonList.length, done = m.lessonList.filter(l => lessonState(p, l).done).length;
  const exams = p.exams || [], best = {};
  for (const e of exams) if (!best[e.exam] || e.points / e.max > best[e.exam].points / best[e.exam].max) best[e.exam] = e;
  const pct = total ? done / total : exams.length ? 1 : 0;
  return { total, done, pct, best, last: exams[exams.length - 1] };
}
function addXP(p, n) {
  if (!(n > 0)) return;
  p.xp = (p.xp || 0) + n; APP.xp += n;
  const today = todayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  APP.days[today] = (APP.days[today] || 0) + n;
  const keys = Object.keys(APP.days).sort(); if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(k => delete APP.days[k]);
  if (APP.streak.last !== today) { APP.streak.n = APP.streak.last === todayKey(y) ? APP.streak.n + 1 : 1; APP.streak.last = today; }
  saveApp();
}
function streakNow() {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return APP.streak.last === todayKey() || APP.streak.last === todayKey(y) ? APP.streak.n : 0;
}
