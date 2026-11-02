# Rebuild index.html from the JSON hitzone data.
# Usage (repo root):  powershell -ExecutionPolicy Bypass -File tools\build.ps1
# ASCII-only on purpose, so it parses the same regardless of file encoding.

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root 'mhrise-data'
$tpl     = Join-Path $PSScriptRoot 'template.html'
$out     = Join-Path $root 'index.html'

if (-not (Test-Path $dataDir)) { throw "data dir not found: $dataDir" }
if (-not (Test-Path $tpl))     { throw "template not found: $tpl" }

$data = Get-ChildItem $dataDir -Filter *.json -File | ForEach-Object {
    try { Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch { Write-Warning "skip bad json: $($_.Name)"; $null }
} | Where-Object { $null -ne $_ }

if (-not $data -or $data.Count -eq 0) { throw "no monster data loaded" }
Write-Host ("Loaded monsters: " + $data.Count)

$json = ConvertTo-Json -InputObject @($data) -Depth 6 -Compress
$html = Get-Content $tpl -Raw -Encoding UTF8
if ($html -notmatch '__MHW_DATA__') { throw "placeholder __MHW_DATA__ not found in template" }
$html = $html.Replace('__MHW_DATA__', $json)

[System.IO.File]::WriteAllText($out, $html, (New-Object System.Text.UTF8Encoding($true)))
Write-Host ("Wrote: " + $out)
Write-Host ("Size : " + [math]::Round((Get-Item $out).Length / 1KB, 1) + " KB")
