$ErrorActionPreference = "Stop"

# Retrieve credential from Git Credential Manager
$rawCreds = "protocol=https`nhost=github.com" | git credential fill
$token = ""
foreach ($line in ($rawCreds -split "`n")) {
    if ($line -like "password=*") {
        $token = $line.Substring(9).Trim()
    }
}

if (-not $token) {
    Write-Error "Could not retrieve GitHub token from git credential manager."
    exit 1
}

$repo = "Yugraj20/BlockHost"
$tagName = "v0.2.2-beta"
$releaseName = "ChunkHarbor v0.2.2-beta"
$releaseBody = @"
## ChunkHarbor v0.2.2-beta

This beta introduces the ChunkHarbor name, fixes Java selection for year-based Minecraft releases, and improves beta update discovery.

### Highlights
- Minecraft 26.x selects Java 25 instead of Java 8.
- Existing BlockHost and VoxelPulse user data remains available after upgrading.
- The update checker now detects published prereleases.

### Asset
- ChunkHarbor Setup 0.2.2-beta.exe: Windows x64 installer.
"@

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "ChunkHarbor-Release"
}

# Check if release already exists
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$tagName" -Headers $headers -Method Get
    Write-Host "Found existing release for tag $tagName with ID $($release.id)"
} catch {
    Write-Host "No existing release found for tag $tagName. Creating a new release..."
}

if (-not $release) {
    $payload = @{
        tag_name         = $tagName
        target_commitish = "main"
        name             = $releaseName
        body             = $releaseBody
        draft            = $false
        prerelease       = $true
    } | ConvertTo-Json -Depth 5

    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Method Post -Body $payload -ContentType "application/json; charset=utf-8"
    Write-Host "Created release with ID $($release.id) at $($release.html_url)"
}

# Upload the ChunkHarbor 0.2.2-beta installer
$exeFile = Get-ChildItem (Join-Path $PSScriptRoot "..\dist") -Filter "*.exe" | Where-Object { $_.Name -like "*0.2.2-beta*" } | Select-Object -First 1
$exePath = $exeFile.FullName
if (Test-Path $exePath) {
    $exeName = [System.IO.Path]::GetFileName($exePath)
    Write-Host "Uploading $exeName ($( [math]::Round((Get-Item $exePath).Length / 1MB, 2) ) MB)..."

    # Check if asset already exists
    if ($release.assets) {
        $existingAsset = $release.assets | Where-Object { $_.name -eq $exeName }
        if ($existingAsset) {
            Write-Host "Deleting old asset $($existingAsset.id)..."
            Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/assets/$($existingAsset.id)" -Headers $headers -Method Delete
        }
    }

    $uploadUrlBase = $release.upload_url -replace '\{\?name,label\}', ''
    $encodedName = [System.Uri]::EscapeDataString($exeName)
    $uploadUrl = "${uploadUrlBase}?name=$encodedName"

    Write-Host "Streaming upload via curl to $uploadUrl..."
    $curlOut = & curl.exe --fail-with-body -s -S -X POST `
        -H "Authorization: Bearer $token" `
        -H "Accept: application/vnd.github+json" `
        -H "Content-Type: application/octet-stream" `
        --data-binary "@$exePath" `
        "$uploadUrl"

    if ($LASTEXITCODE -ne 0) {
        Write-Error "curl upload failed with code ${LASTEXITCODE} - $curlOut"
        exit 1
    }

    Write-Host "Successfully uploaded $exeName to GitHub Release!"
    Write-Host "Release URL: $($release.html_url)"
} else {
    Write-Error "Installer executable not found at $exePath"
}
