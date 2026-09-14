const fs = require('fs');
const path = 'C:\\Users\\xiangya\\Doubao\\chats\\2026-08-29\\new-chat\\wish-game\\public\\app.js';
let js = fs.readFileSync(path, 'utf8');

// Find and remove the incorrectly inserted pull-to-refresh code
// The bad code starts at "// ---- Pull to Refresh ----" and ends at "init();"
const startMarker = '// ---- Pull to Refresh ----';
const endMarker = 'init();\n  if (name === \'me\'';

const startIdx = js.indexOf(startMarker);
const endIdx = js.indexOf(endMarker);

if (startIdx > -1 && endIdx > -1) {
  // Remove from startMarker to endMarker (exclusive), then fix the Lottery. line
  // First, fix the Lottery. line before startMarker
  const before = js.substring(0, startIdx);
  const after = js.substring(endIdx);
  
  // Fix "Lottery.\n" to "Lottery.init();\n"
  let fixedBefore = before.replace(/Lottery\.\s*$/, 'Lottery.init();\n');
  
  js = fixedBefore + after;
  console.log('Removed incorrectly inserted pull-to-refresh code');
  console.log('Fixed Lottery.init() line');
} else {
  console.log('Markers not found');
  console.log('startIdx:', startIdx, 'endIdx:', endIdx);
}

fs.writeFileSync(path, js, 'utf8');
