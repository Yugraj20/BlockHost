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
$tagName = "v0.2.0-beta"
$releaseName = "BlockHost v0.2.0-beta"
$releaseBody = @"
## BlockHost v0.2.0-beta

Welcome to **BlockHost v0.2.0-beta**! This release brings major enhancements, including a silent background update checker, responsive 3D web experience, and direct developer support.

### 🌟 Key Highlights in v0.2.0-beta
- **Mandatory Update System**: Silent background update checks on launch with forced update modal and direct installer downloads.
- **Buy Me a Coffee Integration**: Direct support button integrated into desktop app sidebar and official website.
- **Responsive 3D Experience**: Dynamic isometric camera scaling, touch-scrolling separation, and mobile navigation drawer.
- **7 Server Engines Supported**: Vanilla, Paper, Purpur, Fabric, Quilt, Forge, and NeoForge with automatic version & build discovery.
- **Adoptium JDK Manager**: Automatic detection and 1-click downloads for Java 8, 17, 21, and 25.
- **Integrated playit.gg Networking**: Zero port-forwarding required with in-process tunneling.
- **Accurate 5-Part RAM Allocation**: Proportional memory milestones with 1-click snap alignment.

### 📦 Assets Included
- ``BlockHost.Setup.0.2.0-beta.exe``: Windows x64 NSIS Installer.
"@

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "BlockHost-Release"
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

# Upload asset BlockHost Setup 0.2.0-beta.exe
$exeFile = Get-ChildItem (Join-Path $PSScriptRoot "..\dist") -Filter "*.exe" | Where-Object { $_.Name -like "*0.2.0-beta*" } | Select-Object -First 1
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
