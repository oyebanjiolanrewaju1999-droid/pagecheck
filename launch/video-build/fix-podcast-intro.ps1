$ErrorActionPreference = 'Continue'
$ff = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffmpeg.exe'
$probe = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffprobe.exe'
$build = 'C:\Users\oyeba\OneDrive\Desktop\R-E-A\pagecheck\launch\video-build'
$seg = Join-Path $build 'podseg'
$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'

$introHtml = @'
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b1220;
font-family:-apple-system,"Segoe UI",Arial,sans-serif;color:#f8fafc;
display:flex;flex-direction:column;justify-content:center;align-items:center;
padding:0 80px;text-align:center}
.k{font-size:24px;letter-spacing:.30em;color:#93c5fd;margin-bottom:38px}
h1{font-size:60px;line-height:1.14;letter-spacing:-.02em;margin:0 0 34px;font-weight:800;max-width:920px}
.m{font-size:30px;color:#94a3b8}
</style></head><body>
<div class="k">PAGECHECK</div>
<h1>I built a website audit tool in a weekend &mdash; here&rsquo;s what broke</h1>
<div class="m">Philip Oyebanji &middot; 6 min</div>
</body></html>
'@
$introHtml | Out-File -LiteralPath (Join-Path $build 'podcast-intro.html') -Encoding utf8

$profile = Join-Path $env:TEMP ('chrome-' + [guid]::NewGuid().ToString('N'))
$png = Join-Path $build 'podcast-intro.png'
& $chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$profile" `
  --window-size=1080,1920 --screenshot="$png" ("file:///" + ((Join-Path $build 'podcast-intro.html') -replace '\\','/')) 2>$null | Out-Null

& $ff -y -hide_banner -loglevel error -loop 1 -t 4 -i $png -f lavfi -t 4 -i anullsrc=r=48000:cl=stereo `
  -vf "scale=1080:1920,setsar=1,fps=30" -map 0:v -map 1:a -t 4 `
  -c:v h264_mf -b:v 5M -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -ac 2 (Join-Path $seg 'zz-intro.mp4') 2>&1 | Out-String | Write-Output

$list = Join-Path $build 'podcast-concat.txt'
$joined = Join-Path $build 'podcast-joined.mp4'
& $ff -y -hide_banner -loglevel error -f concat -safe 0 -i $list -c copy $joined 2>&1 | Out-String | Write-Output

$final = 'C:\Users\oyeba\OneDrive\Desktop\PageCheck-Podcast.mp4'
& $ff -y -hide_banner -loglevel error -i $joined -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart $final 2>&1 | Out-String | Write-Output

& $probe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 $final
