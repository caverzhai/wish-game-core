import io
c = io.open('src/server.js', 'r', encoding='utf-8').read()
c = c.replace("BUILD = '2.3.24'", "BUILD = '2.3.25'")
io.open('src/server.js', 'w', encoding='utf-8').write(c)
print('version updated to 2.3.25')
