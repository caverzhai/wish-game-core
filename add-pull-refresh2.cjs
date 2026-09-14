const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

const pullRefreshCode = `
// ---- Pull to Refresh ----
(function() {
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;
  const threshold = 80;

  const indicator = document.createElement('div');
  indicator.id = 'pullRefreshIndicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;height:0;overflow:hidden;background:linear-gradient(180deg,rgba(255,215,0,0.1),transparent);display:flex;align-items:flex-end;justify-content:center;z-index:9998;transition:height 0.2s;';
  indicator.innerHTML = '<div style="padding:10px;color:var(--gold);font-size:13px;">Pull to refresh</div>';
  document.body.appendChild(indicator);

  document.addEventListener('touchstart', (e) => {
    if (refreshing) return;
    if (window.scrollY <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling || refreshing) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0 && window.scrollY <= 0) {
      const height = Math.min(diff * 0.5, 100);
      indicator.style.height = height + 'px';
      if (diff > threshold) {
        indicator.querySelector('div').textContent = 'Release to refresh';
      } else {
        indicator.querySelector('div').textContent = 'Pull to refresh';
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling || refreshing) return;
    pulling = false;
    const diff = currentY - startY;
    if (diff > threshold && window.scrollY <= 0) {
      refreshing = true;
      indicator.style.height = '50px';
      indicator.querySelector('div').innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;">Refreshing...</span>';
      setTimeout(() => {
        try {
          if (typeof refresh === 'function') refresh();
          if (typeof Lottery !== 'undefined' && Lottery.refresh) Lottery.refresh();
          if (typeof Task !== 'undefined' && Task.renderTaskSection) Task.renderTaskSection();
        } catch(e) {}
        setTimeout(() => {
          indicator.style.height = '0';
          refreshing = false;
        }, 500);
      }, 800);
    } else {
      indicator.style.height = '0';
    }
  });

  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();

`;

// Find the position of init() and insert before it
const initPos = js.indexOf('init();');
if (initPos > -1) {
  js = js.substring(0, initPos) + pullRefreshCode + js.substring(initPos);
  fs.writeFileSync(path, js, 'utf8');
  console.log('Pull-to-refresh added at position', initPos);
} else {
  console.log('init() not found');
}
