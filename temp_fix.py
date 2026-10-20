# Script Python per correggere la funzione escapeHtml in app.js
# Migliora la sicurezza evitando XSS usando replaceAll invece di replace con mappatura

file_path = r'f:\sw\ricetteTest\static\app.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# La riga 9 (indice 8) contiene la funzione escapeHtml da correggere
new_escape_html = '''  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;')
    .replaceAll('"', '&quot;');'''

lines[8] = new_escape_html + '\n'

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"File corretto con successo: {file_path}")