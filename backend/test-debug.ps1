$response = Invoke-RestMethod -Uri "http://localhost:3001/api/debug/users" -Method Get
Write-Host "All users in database:"
$response | Format-Table -AutoSize

Write-Host "`nAdmin user details:"
$adminUser = $response | Where-Object { $_.email -eq "leverson83@gmail.com" }
if ($adminUser) {
    Write-Host "ID: $($adminUser.id)"
    Write-Host "Name: $($adminUser.name)"
    Write-Host "Email: $($adminUser.email)"
    Write-Host "Admin: $($adminUser.admin)"
    Write-Host "Admin type: $($adminUser.admin.GetType().Name)"
} else {
    Write-Host "Admin user not found!"
} 