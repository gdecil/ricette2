# Corregge la funzione escapeHtml usando replaceAll per evitare XSS
$filePath = "f:\sw\ricetteTest\static\app.js"
$lines = Get-Content $filePath -Encoding UTF8

$newLine9 = @'
  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;')
    .replaceAll('"', '&quot;');
'@

$lines[8] = $newLine9
Set-Content -Path $filePath -Value ($lines | Out-String) -Encoding UTF8