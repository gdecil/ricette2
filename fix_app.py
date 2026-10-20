content = open(r'f:\sw\ricetteTest\static\app.js', 'r', encoding='utf-8').read()
new_content = content.replace(")\[char])", ".replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace('"', '&quot;');")
open(r'f:\sw\ricetteTest\static\app.js', 'w', encoding='utf-8').write(new_content)
print("Fixed!")