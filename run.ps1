$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

function Ensure-EnvFile {
    param(
        [string]$ExamplePath,
        [string]$TargetPath
    )

    if (-not (Test-Path $TargetPath)) {
        Copy-Item $ExamplePath $TargetPath
        Write-Host "Created $(Split-Path -Leaf $TargetPath) from $(Split-Path -Leaf $ExamplePath)"
    }
}

Ensure-EnvFile -ExamplePath (Join-Path $BackendDir ".env.example") -TargetPath (Join-Path $BackendDir ".env")
Ensure-EnvFile -ExamplePath (Join-Path $FrontendDir ".env.example") -TargetPath (Join-Path $FrontendDir ".env.local")

$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $BackendPython)) {
    Write-Host "Creating backend virtual environment..."
    py -3 -m venv (Join-Path $BackendDir ".venv")
}

Write-Host "Installing backend dependencies..."
$RequirementsPath = Join-Path $BackendDir "requirements.txt"
$FilteredRequirementsPath = Join-Path $BackendDir ".requirements.windows.txt"
Get-Content $RequirementsPath | Where-Object { $_ -and $_ -ne "tree-sitter-languages" } | Set-Content $FilteredRequirementsPath
& $BackendPython -m pip install -r $FilteredRequirementsPath

Write-Host "Creating database tables..."
& $BackendPython (Join-Path $BackendDir "create_tables.py")

Write-Host "Starting backend on http://127.0.0.1:8000"
$BackendProcess = Start-Process -FilePath $BackendPython -WorkingDirectory $BackendDir -ArgumentList @(
    "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"
) -PassThru

Write-Host "Starting frontend on http://localhost:3000"
$FrontendProcess = Start-Process -FilePath "npm.cmd" -WorkingDirectory $FrontendDir -ArgumentList @("run", "dev") -PassThru

Write-Host "Backend PID: $($BackendProcess.Id)"
Write-Host "Frontend PID: $($FrontendProcess.Id)"
Write-Host "Press Enter to stop both processes."
[void][System.Console]::ReadLine()

foreach ($ProcessId in @($BackendProcess.Id, $FrontendProcess.Id)) {
    try {
        Stop-Process -Id $ProcessId -Force
    } catch {
    }
}

if (Test-Path $FilteredRequirementsPath) {
    Remove-Item $FilteredRequirementsPath -Force
}