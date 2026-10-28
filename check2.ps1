$ErrorActionPreference = 'Continue'
try {
    $r = Invoke-WebRequest -Uri 'https://priyomka-web.onrender.com/' -Method GET -TimeoutSec 30 -UseBasicParsing
    Write-Output "STATUS=$($r.StatusCode)"
    Write-Output "ContentLength=$($r.ContentLength)"
}
catch {
    Write-Output "ERR: $($_.Exception.Message)"
}
