$f = 'C:\Users\Machcreator\Desktop\Dolgiy Studio\Acceptance-Facility-Management-System\apps\api\prisma\schema.prisma'
$c = [System.IO.File]::ReadAllText($f)
$c = $c.TrimStart([char]0xFEFF)
[System.IO.File]::WriteAllText($f, $c, (New-Object System.Text.UTF8Encoding $false))
Write-Host 'BOM removed'
