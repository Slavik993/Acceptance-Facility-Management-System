$f = 'C:\Users\Machcreator\Desktop\Dolgiy Studio\Acceptance-Facility-Management-System\apps\api\prisma\schema.prisma'
$c = [System.IO.File]::ReadAllText($f)
$c = $c -replace ' @db\.Uuid', ''
$c = $c -replace '  @db\.Uuid', ' '
$c = $c -replace ' @db\.Date', ''
$c = $c -replace ' @db\.Text', ''
[System.IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)
Write-Host 'Fixed schema.prisma'
