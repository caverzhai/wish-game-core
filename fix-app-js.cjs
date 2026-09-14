const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// Find the bad insertion: "Lottery.\n// ---- Pull to Refresh ----"
const badPattern = 'Lottery.\n// ---- Pull to Refresh ----';
const idx = js.indexOf(badPattern);
if (idx > -1) {
  // Find the end of the pull refresh code
  const endPattern = '})();\n\ninit();\nif (typeof Lottery';
  const endIdx = js.indexOf(endPattern, idx);
  if (endIdx > -1) {
    // Replace the whole bad section with correct code
    const correctCode = 'Lottery.init();\n\n// ---- Pull to Refresh ----\n(function() {\n  let startY = 0, currentY = 0, pulling = false, refreshing = false;\n  const threshold = 80;\n  const indicator = document.createElement(\'div\');\n  indicator.id = \'pullRefreshIndicator\';\n  indicator.style.cssText = \'position:fixed;top:0;left:0;right:0;height:0;overflow:hidden;background:linear-gradient(180deg,rgba(255,215,0,0.1),transparent);display:flex;align-items:flex-end;justify-content:center;z-index:9998;transition:height 0.2s;\';\n  indicator.innerHTML = \'<div style="padding:10px;color:var(--gold);font-size:13px;">Pull to refresh</div>\';\n  document.body.appendChild(indicator);\n  document.addEventListener(\'touchstart\', function(e) {\n    if (refreshing) return;\n    if (window.scrollY <= 0) { startY = e.touches[0].clientY; pulling = true; }\n  }, { passive: true });\n  document.addEventListener(\'touchmove\', function(e) {\n    if (!pulling || refreshing) return;\n    currentY = e.touches[0].clientY;\n    var diff = currentY - startY;\n    if (diff > 0 && window.scrollY <= 0) {\n      var h = Math.min(diff * 0.5, 100);\n      indicator.style.height = h + \'px\';\n      indicator.querySelector(\'div\').textContent = diff > threshold ? \'Release to refresh\' : \'Pull to refresh\';\n    }\n  }, { passive: true });\n  document.addEventListener(\'touchend\', function() {\n    if (!pulling || refreshing) return;\n    pulling = false;\n    var diff = currentY - startY;\n    if (diff > threshold && window.scrollY <= 0) {\n      refreshing = true;\n      indicator.style.height = \'50px\';\n      indicator.querySelector(\'div\').innerHTML = \'<span style="display:inline-block;animation:prspin 1s linear infinite;">Refreshing...</span>\';\n      setTimeout(function() {\n        try { if (typeof refresh === \'function\') refresh(); } catch(e) {}\n        try { if (typeof Lottery !== \'undefined\' && Lottery.refresh) Lottery.refresh(); } catch(e) {}\n        try { if (typeof Task !== \'undefined\' && Task.renderTaskSection) Task.renderTaskSection(); } catch(e) {}\n        setTimeout(function() { indicator.style.height = \'0\'; refreshing = false; }, 500);\n      }, 800);\n    } else { indicator.style.height = \'0\'; }\n  });\n  var st = document.createElement(\'style\');\n  st.textContent = \'@keyframes prspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\';\n  document.head.appendChild(st);\n})();\n\ninit();\nif (typeof Lottery';
    js = js.substring(0, idx) + correctCode + js.substring(endIdx + endPattern.length);
    fs.writeFileSync(path, js, 'utf8');
    console.log('Fixed app.js syntax error');
  } else {
    console.log('End pattern not found');
  }
} else {
  console.log('Bad pattern not found');
}
