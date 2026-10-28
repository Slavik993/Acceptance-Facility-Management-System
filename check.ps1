$ErrorActionPreference = 'Continue'
try {
    $r = Invoke-WebRequest -Uri 'https://priyomka-api.onrender.com/health' -Method GET -TimeoutSec 30 -UseBasicParsing
    Write-Output "STATUS=$($r.StatusCode)"
    Write-Output $r.Content
}
catch {
    Write-Output "ERR: $($_.Exception.Message)"
}
