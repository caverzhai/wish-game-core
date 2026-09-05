import io

# Add test voice button to HTML
f = io.open('public/index.html', 'r', encoding='utf-8')
content = f.read()
f.close()

old = """      <button id="selfCheckBtn" class="btn-ghost self-check" data-i18n="selfCheck">Wallet environment check</button>"""
new = """      <button id="selfCheckBtn" class="btn-ghost self-check" data-i18n="selfCheck">Wallet environment check</button>
      <button id="testVoiceBtn" class="btn-ghost self-check" style="margin-top:8px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;">测试语音效果</button>"""

if old in content:
    content = content.replace(old, new, 1)
    print('index.html: added test voice button')
else:
    print('WARNING: pattern not found')

f = io.open('public/index.html', 'w', encoding='utf-8')
f.write(content)
f.close()

# Add click handler in init
f = io.open('public/app.js', 'r', encoding='utf-8')
content = f.read()
f.close()

old_init = """function init() {
  $('langSel').value = state.lang; applyI18n();"""
new_init = """function init() {
  $('langSel').value = state.lang; applyI18n();
  const tvBtn = $('testVoiceBtn');
  if (tvBtn) tvBtn.onclick = () => speakRich('Red wins', { pitch: 0.65, rate: 0.85, volume: 0.95 });"""

if old_init in content:
    content = content.replace(old_init, new_init, 1)
    print('app.js: added test voice button handler')
else:
    print('WARNING: init pattern not found')

f = io.open('public/app.js', 'w', encoding='utf-8')
f.write(content)
f.close()
