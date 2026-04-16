$ErrorActionPreference = "Stop"

$workspace = "C:\Users\Jonathan Buquia\Downloads\OFFICE\WEB\LR"
$inputDir = "C:\Users\Jonathan Buquia\OneDrive - Department of Education\SAMPLE CONSOLIDATED FOLDER"
$stateDir = Join-Path $workspace ".cache"
$stateFile = Join-Path $stateDir "onedrive-sync-state.json"
$logDir = Join-Path $workspace "logs"
$logFile = Join-Path $logDir "onedrive-sync.log"
$gitTrackedPaths = @("public/data", "src/lastUpdated.js")

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Log {
  param([string]$Message)
  Ensure-Directory -Path $logDir
  $line = "[{0}] {1}" -f ([DateTime]::UtcNow.ToString("o")), $Message
  Add-Content -LiteralPath $logFile -Value $line
  Write-Output $line
}

function Get-SourceSignature {
  param([string]$RootPath)

  $files = Get-ChildItem -LiteralPath $RootPath -Recurse -File |
    Where-Object { $_.Extension -match '^\.xls(x|m)?$' } |
    Sort-Object FullName

  $builder = New-Object System.Text.StringBuilder
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($RootPath.Length).TrimStart('\')
    [void]$builder.Append($relative)
    [void]$builder.Append("|")
    [void]$builder.Append($file.Length)
    [void]$builder.Append("|")
    [void]$builder.Append($file.LastWriteTimeUtc.Ticks)
    [void]$builder.Append("`n")
  }

  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($builder.ToString())
    $hash = $sha1.ComputeHash($bytes)
    $signature = [System.BitConverter]::ToString($hash).Replace("-", "").ToLowerInvariant()
    return @{
      Signature = $signature
      FileCount = $files.Count
    }
  }
  finally {
    $sha1.Dispose()
  }
}

function Invoke-Step {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $display = "$FilePath $($Arguments -join ' ')".Trim()
  Write-Log "Running: $display"

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $display"
  }
}

function Resolve-CommandPath {
  param(
    [string]$Name,
    [string[]]$Fallbacks = @()
  )

  $command = Get-Command -Name $Name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command -and $command.Source) {
    return $command.Source
  }

  foreach ($fallback in $Fallbacks) {
    if (Test-Path -LiteralPath $fallback) {
      return $fallback
    }
  }

  throw "Required command not found: $Name"
}

function Get-CommandOutput {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $output = & $FilePath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    $display = "$FilePath $($Arguments -join ' ')".Trim()
    throw "Command failed with exit code ${LASTEXITCODE}: $display"
  }

  if ($null -eq $output) {
    return @()
  }

  return @($output | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
}

function Test-IsTrackedPath {
  param([string]$Path)

  foreach ($trackedPath in $gitTrackedPaths) {
    if ($Path -eq $trackedPath -or $Path.StartsWith("$trackedPath/")) {
      return $true
    }
  }

  return $false
}

function Sync-GitDataChanges {
  param(
    [string]$GitPath,
    [string]$CurrentBranch,
    [string]$Timestamp
  )

  $preStaged = Get-CommandOutput -FilePath $GitPath -Arguments @("diff", "--cached", "--name-only")
  $blockingStaged = @($preStaged | Where-Object { -not (Test-IsTrackedPath -Path $_) })
  if ($blockingStaged.Count -gt 0) {
    Write-Log "Skipping auto-commit because non-data files are already staged: $($blockingStaged -join ', ')"
    return
  }

  Invoke-Step -FilePath $GitPath -Arguments @("add", "-A", "--", "public/data", "src/lastUpdated.js")

  $stagedData = Get-CommandOutput -FilePath $GitPath -Arguments @(
    "diff", "--cached", "--name-only", "--", "public/data", "src/lastUpdated.js"
  )

  if ($stagedData.Count -eq 0) {
    Write-Log "No data changes to commit after rebuild."
    return
  }

  $commitMessage = "Auto-update data from OneDrive $Timestamp"
  Invoke-Step -FilePath $GitPath -Arguments @("commit", "-m", $commitMessage, "--", "public/data", "src/lastUpdated.js")
  Invoke-Step -FilePath $GitPath -Arguments @("push", "origin", $CurrentBranch)
  Write-Log "Auto-pushed data changes to origin/$CurrentBranch."
}

try {
  if (-not (Test-Path -LiteralPath $inputDir)) {
    throw "Input folder not found: $inputDir"
  }

  Ensure-Directory -Path $stateDir
  Set-Location -LiteralPath $workspace
  $env:LR_INPUT_DIR = $inputDir
  $nodePath = Resolve-CommandPath -Name "node" -Fallbacks @(
    "C:\Program Files\nodejs\node.exe"
  )
  $npmPath = Resolve-CommandPath -Name "npm.cmd" -Fallbacks @(
    "C:\Program Files\nodejs\npm.cmd"
  )
  $gitPath = Resolve-CommandPath -Name "git" -Fallbacks @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe"
  )

  $current = Get-SourceSignature -RootPath $inputDir
  $env:LR_LAST_UPDATED = (Get-Date).ToString("yyyy-MM-dd hh:mm tt")
  $currentBranch = (Get-CommandOutput -FilePath $gitPath -Arguments @("branch", "--show-current") | Select-Object -First 1)
  $previous = $null

  if (Test-Path -LiteralPath $stateFile) {
    try {
      $previous = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    }
    catch {
      $previous = $null
    }
  }

  if ($previous -and $previous.signature -eq $current.Signature) {
    Write-Log "No changes detected in OneDrive source ($($current.FileCount) Excel files)."
    exit 0
  }

  Write-Log "Change detected in OneDrive source. Previous signature: $($previous.signature), new signature: $($current.Signature)."

  Invoke-Step -FilePath $nodePath -Arguments @("scripts/build-data.js")
  Invoke-Step -FilePath $npmPath -Arguments @("run", "build")
  if (-not $currentBranch) {
    throw "Cannot auto-push because the current Git branch could not be determined."
  }
  Sync-GitDataChanges -GitPath $gitPath -CurrentBranch $currentBranch -Timestamp $env:LR_LAST_UPDATED

  $state = [ordered]@{
    inputDir = $inputDir
    signature = $current.Signature
    fileCount = $current.FileCount
    lastUpdated = $env:LR_LAST_UPDATED
    lastRunAt = [DateTime]::UtcNow.ToString("o")
  }

  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

  Write-Log "OneDrive sync rebuild completed successfully."
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  throw
}
