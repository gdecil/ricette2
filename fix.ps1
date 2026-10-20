# Fix escapeHtml function in app.js
$content = [System.IO.File]::ReadAllText("f:\sw\ricetteTest\static\app.js", [System.Text.UTF8Encoding]::new())
$newContent = $content.Replace(")\[char]))",".replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace('\"', '&quot;');")
[System.IO.File]::WriteAllText([System.Text.UTF8Encoding]::new().GetBytes($newContent), "f:\sw\ricetteTest\static\app.js")
Write-Host "Fixed!"