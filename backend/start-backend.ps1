# 错题本整理系统 - Windows 后端启动脚本
# 从 .env 文件加载环境变量并启动 Spring Boot 后端

param(
    [string]$Action = "run"  # run / build / restart
)

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 读取 .env 文件并设置环境变量
Get-Content "$BackendDir\.env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and $line -notmatch '^#' -and $line -match '^(.+?)=(.+)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        # 去除可能的引号
        $value = $value -replace '^["'']|["'']$', ''
        Set-Item -Path "env:$key" -Value $value
        Write-Host "  $key = $($value.Substring(0, [Math]::Min(20, $value.Length)))..." -ForegroundColor Gray
    }
}

Write-Host "`n环境变量加载完成`n" -ForegroundColor Green

if ($Action -eq "build") {
    Write-Host ">>> 编译后端..." -ForegroundColor Cyan
    & "mvn" clean package -DskipTests -f "$BackendDir\pom.xml"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "编译失败，请检查依赖。" -ForegroundColor Red
        exit 1
    }
    Write-Host "编译成功！" -ForegroundColor Green
}

$JarFile = Get-ChildItem "$BackendDir\target\*.jar" | Select-Object -First 1
if (-not $JarFile) {
    Write-Host "未找到 JAR 文件，正在编译..." -ForegroundColor Yellow
    & "mvn" clean package -DskipTests -f "$BackendDir\pom.xml"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "编译失败，请检查依赖 (需要安装 JDK 17+ 和 Maven)。" -ForegroundColor Red
        exit 1
    }
    $JarFile = Get-ChildItem "$BackendDir\target\*.jar" | Select-Object -First 1
}

Write-Host ">>> 启动后端: $($JarFile.Name)" -ForegroundColor Cyan
Write-Host "    端口: 8080, 上下文路径: /api" -ForegroundColor Cyan
Write-Host "    按 Ctrl+C 停止`n" -ForegroundColor Gray

java -jar $JarFile.FullName --spring.profiles.active=dev
