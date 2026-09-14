const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// Find the start of bad code
const startMarker = '// ---- Pull to Refresh ----';
const startIdx = js.indexOf(startMarker);

// Find "Lottery." before the start marker
const lotteryIdx = js.lastIndexOf('Lottery.', startIdx);

// Find the end: after "})();" there's "init();" then "if (name === 'me'"
// Let's find "})();" after startIdx, then the "init();" after it
const iifeEnd = js.indexOf('})();', startIdx);
const initAfter = js.indexOf('init();', iifeEnd);

console.log('startIdx:', startIdx);
console.log('lotteryIdx:', lotteryIdx);
console.log('iifeEnd:', iifeEnd);
console.log('initAfter:', initAfter);

if (startIdx > -1 && lotteryIdx > -1 && initAfter > -1) {
  // The bad code is from startMarker to initAfter + 'init();'.length
  const badStart = startMarker.length;
  const badEnd = initAfter + 'init();'.length;
  
  // Remove the bad code (from startMarker to init(); inclusive)
  js = js.substring(0, startIdx) + js.substring(badEnd);
  
  // Fix "Lottery." to "Lottery.init();"
  // After removal, the "Lottery." should be right before the removed section
  // Find it again
  const newLotteryIdx = js.indexOf('Lottery.');
  if (newLotteryIdx > -1) {
    js = js.substring(0, newLotteryIdx) + 'Lottery.init();' + js.substring(newLotteryIdx + 'Lottery.'.length);
    console.log('Fixed Lottery.init()');
  }
  
  fs.writeFileSync(path, js, 'utf8');
  console.log('Bad code removed');
} else {
  console.log('Could not find markers');
}
