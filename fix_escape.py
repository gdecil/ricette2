import re

content = open(r'f:\sw\ricetteTest\static\app.js', 'r', encoding='utf-8').read()

old_line = "  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));"

new_lines = [
    "  const escapeHtml = (value = '') => String(value)",
    "    .replaceAll('&', '&amp;')",
    "    .replaceAll('<', '&lt;')",
    "    .replaceAll('>', '&gt;')",
    "    .replaceAll(\"'\", '&#39;')",
    "    .replace('\"', '&quot;');"
]

new_content = content.replace(old_line, '\n'.join(new_lines) + '\n')

open(r'f:\sw\ricetteTest\static\app.js', 'w', encoding='utf-8').write(new_content)
print("Done!")