const labels = { today: '今日概览', food: '饮食记录', training: '训练安排', week: '本周回顾' };
function renderPage() {
  const requested = location.hash.slice(1);
  const page = Object.hasOwn(labels, requested) ? requested : 'today';
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('nav a').forEach(link => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('breadcrumb').textContent = labels[page];
  document.title = labels[page] + ' · Fitplan';
}
document.getElementById('date').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
window.addEventListener('hashchange', renderPage);
renderPage();
