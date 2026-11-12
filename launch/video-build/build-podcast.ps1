$ErrorActionPreference = 'Continue'
$ff = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffmpeg.exe'
$probe = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffprobe.exe'
$src = 'C:\Users\oyeba\OneDrive\Desktop\podcast'
$build = 'C:\Users\oyeba\OneDrive\Desktop\R-E-A\pagecheck\launch\video-build'
$seg = Join-Path $build 'podseg'
$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
New-Item -ItemType Directory -Path $seg -Force | Out-Null

function Dur($f) { [double](& $probe -v error -show_entries format=duration -of csv=p=0 $f) }

# ---------- order + de-duplicate ----------
$files = Get-ChildItem $src -File | Where-Object { $_.Extension -match '\.(mp4|mov)$' } | Sort-Object LastWriteTime
$kept = @()
$seenBase = @{}
foreach ($f in $files) {
  # Snapchat appends _1 / _1_1 when the same clip is re-exported. Compare base names only.
  $base = $f.BaseName -replace '(_\d+)+$', ''
  if ($seenBase.ContainsKey($base)) { Write-Output ("duplicate skipped: " + $f.Name); continue }
  $seenBase[$base] = $true
  $kept += $f
}
Write-Output ("clips kept: " + $kept.Count)

# ---------- trim silence and normalise each clip ----------
$index = 0
foreach ($f in $kept) {
  $index++
  $dur = Dur $f.FullName
  $log = & $ff -hide_banner -i $f.FullName -af "silencedetect=noise=-32dB:d=0.30" -f null - 2>&1
  $starts = @(); $ends = @()
  foreach ($line in $log) {
    if ($line -match 'silence_start: ([\d\.]+)') { $starts += [double]$matches[1] }
    if ($line -match 'silence_end: ([\d\.]+)') { $ends += [double]$matches[1] }
  }
  $from = 0.0
  if ($starts.Count -gt 0 -and $starts[0] -lt 0.05 -and $ends.Count -gt 0) { $from = [math]::Max(0, $ends[0] - 0.15) }
  $to = $dur
  if ($starts.Count -gt 0) {
    $lastStart = $starts[$starts.Count - 1]
    if ($lastStart -gt ($dur - 1.2)) { $to = $lastStart + 0.15 }
  }
  $len = [math]::Round($to - $from, 2)
  if ($len -lt 0.8) { $from = 0; $len = [math]::Round($dur, 2) }

  $dest = Join-Path $seg ("{0:d2}.mp4" -f $index)
  & $ff -y -hide_banner -loglevel error -ss $from -t $len -i $f.FullName `
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30" `
    -c:v h264_mf -b:v 5M -maxrate 6M -bufsize 10M -pix_fmt yuv420p -r 30 `
    -c:a aac -b:a 160k -ar 48000 -ac 2 $dest 2>&1 | Out-String | Write-Output
  Write-Output ("{0,2}. {1}s kept from {2,5:N1}s  {3}" -f $index, $len, $dur, $f.Name)
}

# ---------- intro / outro cards ----------
$introHtml = @'
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b1220;
font-family:-apple-system,"Segoe UI",Arial,sans-serif;color:#f8fafc;display:grid;place-content:center;text-align:center;padding:0 80px}
.k{font-size:26px;letter-spacing:.28em;color:#93c5fd;margin-bottom:34px}
h1{font-size:60px;line-height:1.08;letter-spacing:-.03em;margin:0 0 30px;font-weight:800}
.m{font-size:32px;color:#94a3b8}
</style></head><body><div>
<div class="k">PAGECHECK</div>
<h1>I built a website audit tool in a weekend &mdash; here&rsquo;s what broke</h1>
<div class="m">Philip Oyebanji &middot; 7 min</div>
</div></body></html>
'@
$introHtml | Out-File -LiteralPath (Join-Path $build 'podcast-intro.html') -Encoding utf8

$outroHtml = @'
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b1220;
font-family:-apple-system,"Segoe UI",Arial,sans-serif;color:#f8fafc;display:grid;place-content:center;text-align:center;padding:0 80px}
h2{font-size:52px;margin:0 0 28px;font-weight:800}
.u{display:inline-block;background:#2563eb;border-radius:20px;padding:24px 34px;font-size:44px;font-weight:750}
.s{margin-top:26px;color:#94a3b8;font-size:30px}
</style></head><body><div>
<h2>Free 30-point audit</h2>
<div class="u">pagecheck-946f.onrender.com</div>
<div class="s">No sign-up &middot; EN / FR / ES / HI</div>
</div></body></html>
'@
$outroHtml | Out-File -LiteralPath (Join-Path $build 'podcast-outro.html') -Encoding utf8

foreach ($pair in @(@('podcast-intro','intro',4), @('podcast-outro','outro',3))) {
  $name = $pair[0]; $outName = $pair[1]; $secs = $pair[2]
  $profile = Join-Path $env:TEMP ('chrome-' + [guid]::NewGuid().ToString('N'))
  $png = Join-Path $build ($name + '.png')
  & $chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$profile" `
    --window-size=1080,1920 --screenshot="$png" ("file:///" + ((Join-Path $build ($name + '.html')) -replace '\\','/')) 2>$null | Out-Null
  & $ff -y -hide_banner -loglevel error -loop 1 -t $secs -i $png -f lavfi -t $secs -i anullsrc=r=48000:cl=stereo `
    -vf "scale=1080:1920,setsar=1,fps=30" -map 0:v -map 1:a -t $secs `
    -c:v h264_mf -b:v 5M -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -ac 2 (Join-Path $seg ("zz-$outName.mp4")) 2>&1 | Out-String | Write-Output
}

# ---------- concatenate ----------
$list = Join-Path $build 'podcast-concat.txt'
$lines = @()
$lines += "file '" + ((Join-Path $seg 'zz-intro.mp4') -replace '\\','/') + "'"
for ($i = 1; $i -le $index; $i++) { $lines += "file '" + ((Join-Path $seg ("{0:d2}.mp4" -f $i)) -replace '\\','/') + "'" }
$lines += "file '" + ((Join-Path $seg 'zz-outro.mp4') -replace '\\','/') + "'"
Set-Content -LiteralPath $list -Value $lines -Encoding ascii

$joined = Join-Path $build 'podcast-joined.mp4'
& $ff -y -hide_banner -loglevel error -f concat -safe 0 -i $list -c copy $joined 2>&1 | Out-String | Write-Output

$final = 'C:\Users\oyeba\OneDrive\Desktop\PageCheck-Podcast.mp4'
& $ff -y -hide_banner -loglevel error -i $joined -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart $final 2>&1 | Out-String | Write-Output

& $probe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height,r_frame_rate -of default=noprint_wrappers=1 $final
