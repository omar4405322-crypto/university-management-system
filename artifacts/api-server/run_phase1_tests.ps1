$ErrorActionPreference = "Continue"
$results = @()
Write-Host "=== PHASE 1: API STABILIZATION TESTS ==="
Write-Host ""

$body = @{ email="admin@university.com"; password="Admin123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json" -SessionVariable s
$token = $login.data.accessToken
$h = @{ Authorization = "Bearer $token" }
Write-Host "Authenticated as $($login.data.user.email) ($($login.data.user.role))"
Write-Host ""

function Test-Endpoint($name, $method, $url, $reqBody=$null, $dataKey=$null) {
    Write-Host "  Testing: [$method] $url" -NoNewline
    try {
        $params = @{ Uri=$url; Method=$method; Headers=$h; WebSession=$s; UseBasicParsing=$true }
        if ($reqBody) {
            $params.Body = ($reqBody | ConvertTo-Json -Depth 5)
            $params.ContentType = "application/json"
        }
        $r = Invoke-RestMethod @params
        $status = "PASS"
        $count = $null
        if ($dataKey -and $r.$dataKey) { $count = $r.$dataKey.Count }
        elseif ($r.data -and $r.data -is [array]) { $count = $r.data.Count }
        elseif ($r.data -and $r.data.PSObject.Properties['count']) { $count = $r.data.count }
        elseif ($r.data -and $r.data.PSObject.Properties['total']) { $count = $r.data.total }
        elseif ($r.PSObject.Properties['count']) { $count = $r.count }

        $info = if ($count -ne $null) { " ($count items)" } else { "" }
        Write-Host " -> PASS$info" -ForegroundColor Green

        $sample = if ($r.data) { if ($r.data -is [array]) { $r.data[0] } else { $r.data } } else { $r }
        if ($sample -and -not ($sample -is [ValueType])) {
            $props = $sample.PSObject.Properties.Name | Select-Object -First 5
            if ($props.Count -gt 0) {
                Write-Host "    Sample keys: $($props -join ', ')"
            }
        }
        return [PSCustomObject]@{ name=$name; status="PASS"; url=$url; count=$count; error=$null }
    }
    catch {
        $err = $_
        $status = "FAIL"
        $errDetail = $err.Exception.Message
        if ($err.Exception.Response) {
            try {
                $rdr = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
                $errBody = $rdr.ReadToEnd()
                try {
                    $parsed = $errBody | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($parsed.message) { $errDetail = $parsed.message }
                    elseif ($parsed.error) { $errDetail = $parsed.error }
                    else { $errDetail = $errBody.Substring(0,[Math]::Min(150,$errBody.Length)) }
                } catch {}
            } catch {}
        }
        Write-Host " -> FAIL" -ForegroundColor Red
        Write-Host "    Error: $errDetail" -ForegroundColor Red
        return [PSCustomObject]@{ name=$name; status="FAIL"; url=$url; count=$null; error=$errDetail }
    }
}

Write-Host "--- 3. STUDENTS API ---"
$results += Test-Endpoint "Students: list all" "GET" "http://localhost:5000/api/students" $null "students"
Write-Host ""

Write-Host "--- 4. DOCTORS API ---"
$results += Test-Endpoint "Doctors: list all" "GET" "http://localhost:5000/api/doctors" $null "doctors"
$results += Test-Endpoint "Doctors: stats" "GET" "http://localhost:5000/api/doctors/stats"
Write-Host ""

Write-Host "--- 5. COURSES API ---"
$results += Test-Endpoint "Courses: list all" "GET" "http://localhost:5000/api/courses" $null "courses"
Write-Host ""

Write-Host "--- 6. DEPARTMENTS API ---"
$results += Test-Endpoint "Departments: list all (public)" "GET" "http://localhost:5000/api/departments" $null "departments"
Write-Host ""

Write-Host "--- 7. COLLEGES API ---"
$results += Test-Endpoint "Colleges: list all (public)" "GET" "http://localhost:5000/api/colleges" $null "colleges"
Write-Host ""

Write-Host "--- 8. ATTENDANCE API ---"
$results += Test-Endpoint "Attendance: records list" "GET" "http://localhost:5000/api/attendance/records" $null "records"
$results += Test-Endpoint "Attendance: active sessions" "GET" "http://localhost:5000/api/attendance/session/active"
Write-Host ""

Write-Host "--- 9. NOTIFICATIONS API ---"
$results += Test-Endpoint "Notifications: list" "GET" "http://localhost:5000/api/notifications" $null "notifications"
Write-Host ""

Write-Host "--- 10. DASHBOARD API ---"
$results += Test-Endpoint "Dashboard: main stats" "GET" "http://localhost:5000/api/dashboard"
Write-Host ""

Write-Host "========================================"
Write-Host "  PHASE 1 - RESULT SUMMARY"
Write-Host "========================================"
$pass = ($results | Where-Object { $_.status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.status -eq "FAIL" }).Count
Write-Host "PASS: $pass" -ForegroundColor Green
Write-Host "FAIL: $fail" -ForegroundColor $(if ($fail -gt 0) { 'Red' } else { 'Green' })
Write-Host ""
if ($fail -gt 0) {
    Write-Host "Failed endpoints:" -ForegroundColor Red
    $results | Where-Object { $_.status -eq "FAIL" } | ForEach-Object {
        Write-Host "  - $($_.name): $($_.error)" -ForegroundColor Red
    }
} else {
    Write-Host "ALL 10 APIS PASSED - PHASE 1 COMPLETE!" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "--- Individual Results ---"
$results | Format-Table name, status, count, error -AutoSize
