const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// Find the position of "if (typeof Lottery !== 'undefined') Lottery."
const badLottery = "if (typeof Lottery !== 'undefined') Lottery.";
const idx = js.indexOf(badLottery);
if (idx > -1) {
  // Everything after this point is bad (pull refresh code without proper closing)
  // Keep everything before this point, then add correct code
  const correctEnding = `if (typeof Lottery !== 'undefined') Lottery.init();

// ---- Pull to Refresh ----
(function() {
  let startY = 0, currentY = 0, pulling = false, refreshing = false;
  const threshold = 80;
  const indicator = document.createElement('div');
  indicator.id = 'pullRefreshIndicator';
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;height:0;overflow:hidden;background:linear-gradient(180deg,rgba(255,215,0,0.1),transparent);display:flex;align-items:flex-end;justify-content:center;z-index:9998;transition:height 0.2s;';
  indicator.innerHTML = '<div style="padding:10px;color:var(--gold);font-size:13px;">Pull to refresh</div>';
  document.body.appendChild(indicator);
  document.addEventListener('touchstart', function(e) {
    if (refreshing) return;
    if (window.scrollY <= 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!pulling || refreshing) return;
    currentY = e.touches[0].clientY;
    var diff = currentY - startY;
    if (diff > 0 && window.scrollY <= 0) {
      var h = Math.min(diff * 0.5, 100);
      indicator.style.height = h + 'px';
      indicator.querySelector('div').textContent = diff > threshold ? 'Release to refresh' : 'Pull to refresh';
    }
  }, { passive: true });
  document.addEventListener('touchend', function() {
    if (!pulling || refreshing) return;
    pulling = false;
    var diff = currentY - startY;
    if (diff > threshold && window.scrollY <= 0) {
      refreshing = true;
      indicator.style.height = '50px';
      indicator.querySelector('div').innerHTML = '<span style="display:inline-block;animation:prspin 1s linear infinite;">Refreshing...</span>';
      setTimeout(function() {
        try { if (typeof refresh === 'function') refresh(); } catch(e) {}
        try { if (typeof Lottery !== 'undefined' && Lottery.refresh) Lottery.refresh(); } catch(e) {}
        try { if (typeof Task !== 'undefined' && Task.renderTaskSection) Task.renderTaskSection(); } catch(e) {}
        setTimeout(function() { indicator.style.height = '0'; refreshing = false; }, 500);
      }, 800);
    } else { indicator.style.height = '0'; }
  });
  var st = document.createElement('style');
  st.textContent = '@keyframes prspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(st);
})();

init();
if (typeof Lottery !== 'undefined') Lottery.init();
`;
  js = js.substring(0, idx) + correctEnding;
  fs.writeFileSync(path, js, 'utf8');
  console.log('app.js fixed successfully');
} else {
  console.log('Bad pattern not found');
}
