# Script de prueba para endpoints de autenticación
# Ejecutar con: .\test-auth.ps1

Write-Host "=== Prueba de Autenticación GemaAcademy API ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5000/api/auth"

# 1. Registro de usuario
Write-Host "1. Probando registro de usuario..." -ForegroundColor Yellow
try {
    $registerBody = @{
        email = "test@gemaacademy.com"
        password = "Test123!"
        nombres = "Juan"
        apellidos = "Pérez"
        rol_id = 1
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/register" -Method POST -Body $registerBody -ContentType "application/json"
    Write-Host "✓ Registro exitoso" -ForegroundColor Green
    Write-Host ($registerResponse | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "✗ Error en registro: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""

# 2. Login
Write-Host "2. Probando login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "test@gemaacademy.com"
        password = "Test123!"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "✓ Login exitoso" -ForegroundColor Green
    Write-Host ($loginResponse | ConvertTo-Json -Depth 3)
    
    $token = $loginResponse.data.token
    Write-Host ""
    Write-Host "Token obtenido: $token" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""

# 3. Obtener perfil (requiere autenticación)
if ($token) {
    Write-Host "3. Probando acceso a perfil (con token)..." -ForegroundColor Yellow
    try {
        $headers = @{
            Authorization = "Bearer $token"
        }
        
        $profileResponse = Invoke-RestMethod -Uri "$baseUrl/profile" -Method GET -Headers $headers
        Write-Host "✓ Perfil obtenido exitosamente" -ForegroundColor Green
        Write-Host ($profileResponse | ConvertTo-Json -Depth 3)
    } catch {
        Write-Host "✗ Error al obtener perfil: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
    }
}

Write-Host ""

# 4. Intentar acceder sin token (debe fallar)
Write-Host "4. Probando acceso sin token (debe fallar)..." -ForegroundColor Yellow
try {
    $profileResponse = Invoke-RestMethod -Uri "$baseUrl/profile" -Method GET
    Write-Host "✗ ERROR: Se permitió acceso sin token" -ForegroundColor Red
} catch {
    Write-Host "✓ Acceso denegado correctamente (401)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Pruebas completadas ===" -ForegroundColor Cyan
