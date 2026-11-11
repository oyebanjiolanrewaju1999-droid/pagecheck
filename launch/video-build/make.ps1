$ErrorActionPreference = 'Continue'
$ff = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffmpeg.exe'
$probe = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffprobe.exe'
$src = 'C:\Users\oyeba\OneDrive\Desktop\NEW VIDEO'
$build = 'C:\Users\oyeba\OneDrive\Desktop\R-E-A\pagecheck\launch\video-build'
$chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
$cap = Join-Path $build 'cap'
$seg = Join-Path $build 'seg'
New-Item -ItemType Directory -Path $cap -Force | Out-Null
New-Item -ItemType Directory -Path $seg -Force | Out-Null

# ---- assets ----
function Shot($html, $w, $h, $dest, $transparent) {
  $profile = Join-Path $env:TEMP ('chrome-' + [guid]::NewGuid().ToString('N'))
  $args = @('--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run',
            "--user-data-dir=$profile", "--window-size=$w,$h", "--screenshot=$dest")
  if ($transparent) { $args += '--default-background-color=00000000' }
  $args += $html
  & $chrome @args 2>$null | Out-Null
}

$caps = [ordered]@{
  '1a'='Your site is losing customers.'; '1b'='And you would never know.'
  '2a'='Four things decide if they click'; '2b'='Your title'; '2c'='The description under it'
  '2d'='The share image'; '2e'='How fast it loads'; '2f'='No error. Just fewer customers.'
  '3a'='So I built PageCheck'; '3b'='Paste your website address'; '3c'='30 checks in about 8 seconds'
  '3d'='A score out of 100'; '3e'='No sign-up. Nothing stored.'
  '4a'='Let me show you'; '4c'='82 / 100 - Grade B'; '4d'='Top 3 fixes, not 30'
  '4e'='No meta description'; '4f'='No share image'; '4g'='No HSTS header'
  '4h'='Plain English. Top three first.'
  '5a'='Not just what is wrong'; '5b'='What to change, in plain English'; '5c'='The top three first'
  '5d'='Hand it to your web person'; '5e'='No jargon. No sales call.'
  '6a'='Free. Eight seconds.'; '6b'='EN / FR / ES / HI'; '6c'='Link in bio'
  '6d'='Run your site through it'; '6e'='Tell me in the comments'
}
foreach ($k in $caps.Keys) {
  $url = 'file:///' + ((Join-Path $build 'caption.html') -replace '\\','/') + '?t=' + [uri]::EscapeDataString($caps[$k])
  Shot $url 1080 200 (Join-Path $cap ($k + '.png')) $true
}
Shot ('file:///' + ((Join-Path $build 'urlbar.html') -replace '\\','/')) 729 300 (Join-Path $build 'urlbar.png') $true
Shot ('file:///' + ((Join-Path $build 'endcard.html') -replace '\\','/')) 1080 1920 (Join-Path $build 'endcard.png') $false
Write-Output "assets ready"

$encoder = @(
  '-c:v','h264_mf','-b:v','5M','-maxrate','6M','-bufsize','12M',
  '-pix_fmt','yuv420p','-r','30',
  '-c:a','aac','-b:a','192k','-ar','48000','-ac','1',
  '-movflags','+faststart'
)

$CAP_Y = 1420

function Caption-Times {
  param([double]$Duration, [double[]]$Weights)
  $sum = ($Weights | Measure-Object -Sum).Sum
  $out = @(); $cursor = 0.0
  for ($i = 0; $i -lt $Weights.Count; $i++) {
    $len = $Duration * ($Weights[$i] / $sum)
    $end = if ($i -eq $Weights.Count - 1) { $Duration } else { [math]::Round($cursor + $len, 2) }
    $out += ,@([math]::Round($cursor, 2), $end)
    $cursor = $end
  }
  return $out
}

function Build-Face {
  param([string]$Name,[string]$File,[double]$Seek,[double]$Take,[string[]]$Keys,[double[]]$Weights)
  $dur = [math]::Round($Take / 1.02, 3)
  $times = Caption-Times -Duration $dur -Weights $Weights
  $args = @('-y','-hide_banner','-loglevel','error','-ss',"$Seek",'-t',"$Take",'-i',(Join-Path $src $File))
  foreach ($k in $Keys) { $args += @('-i',(Join-Path $cap ($k + '.png'))) }
  $filter = "[0:v]crop=1076:1920:2:0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,setpts=PTS-STARTPTS[v0]"
  $prev = 'v0'
  for ($i = 0; $i -lt $Keys.Count; $i++) {
    $next = 'v' + ($i + 1)
    $filter += ";[$prev][$($i + 1):v]overlay=0:$CAP_Y`:enable='between(t,$($times[$i][0]),$($times[$i][1]))'[$next]"
    $prev = $next
  }
  $filter += ";[0:a]atempo=1.02,highpass=f=85,loudnorm=I=-15:TP=-1.5:LRA=11[aout]"
  $args += @('-filter_complex',$filter,'-map',"[$prev]",'-map','[aout]','-t',"$dur") + $encoder
  $dest = Join-Path $seg ($Name + '.mp4'); $args += $dest
  & $ff @args 2>&1 | Out-String | Write-Output
  $d = & $probe -v error -show_entries format=duration -of csv=p=0 $dest
  Write-Output "[$Name] planned $dur actual $d"
}

function Build-Demo {
  $cutA = 3.857; $cutB = 10.126; $tail = 38.65
  $dur = [math]::Round(($cutA + ($tail - $cutB)), 3)
  $keys = @('4a','4c','4d','4e','4f','4g','4h')
  $times = Caption-Times -Duration $dur -Weights @(0.112,0.105,0.128,0.115,0.115,0.200,0.225)
  $args = @('-y','-hide_banner','-loglevel','error','-t',"$tail",'-i',(Join-Path $src 'Screen_Recording_20261109_131546_Chrome.mp4'))
  $args += @('-t',"$tail",'-i',(Join-Path $src 'Voice.m4a'))
  $args += @('-i',(Join-Path $build 'urlbar.png'))
  foreach ($k in $keys) { $args += @('-i',(Join-Path $cap ($k + '.png'))) }
  $filter = "[0:v]crop=1080:1920:0:0,split=2[sv1][sv2]"
  $filter += ";[sv1]trim=0:$cutA,setpts=PTS-STARTPTS[va]"
  $filter += ";[sv2]trim=$cutB`:$tail,setpts=PTS-STARTPTS[vb]"
  $filter += ";[va][vb]concat=n=2:v=1:a=0,scale=729:1296,pad=1080:1920:176:32:color=0x0b1220,setsar=1,fps=30,setpts=PTS-STARTPTS[v0]"
  $filter += ";[v0][2:v]overlay=176:700:enable='between(t,0,4.6)'[vp]"
  $prev = 'vp'
  for ($i = 0; $i -lt $keys.Count; $i++) {
    $next = 'v' + ($i + 1)
    $filter += ";[$prev][$($i + 3):v]overlay=0:$CAP_Y`:enable='between(t,$($times[$i][0]),$($times[$i][1]))'[$next]"
    $prev = $next
  }
  $filter += ";[1:a]asplit=2[sa1][sa2]"
  $filter += ";[sa1]atrim=0:$cutA,asetpts=PTS-STARTPTS[aa]"
  $filter += ";[sa2]atrim=$cutB`:$tail,asetpts=PTS-STARTPTS[ab]"
  $filter += ";[aa][ab]concat=n=2:v=0:a=1,highpass=f=85,loudnorm=I=-15:TP=-1.5:LRA=11[aout]"
  $args += @('-filter_complex',$filter,'-map',"[${prev}]",'-map','[aout]','-t',"$dur") + $encoder
  $dest = Join-Path $seg 'demo.mp4'; $args += $dest
  & $ff @args 2>&1 | Out-String | Write-Output
  $d = & $probe -v error -show_entries format=duration -of csv=p=0 $dest
  Write-Output "[demo] planned $dur actual $d"
}

function Build-End {
  $dur = 1.3; $dest = Join-Path $seg 'end.mp4'
  $args = @('-y','-hide_banner','-loglevel','error',
    '-loop','1','-t',"$dur",'-i',(Join-Path $build 'endcard.png'),
    '-f','lavfi','-t',"$dur",'-i','anullsrc=r=48000:cl=mono',
    '-vf','scale=1080:1920,setsar=1,fps=30','-map','0:v','-map','1:a','-t',"$dur") + $encoder
  $args += $dest
  & $ff @args 2>&1 | Out-String | Write-Output
}

Build-Face -Name 's1' -File 'Snapchat-337043182_1.mp4'  -Seek 2.30 -Take 8.89  -Keys @('1a','1b') -Weights @(0.585,0.415)
Build-Face -Name 's2' -File 'Snapchat-1115678433_1.mp4' -Seek 1.50 -Take 23.03 -Keys @('2a','2b','2c','2d','2e','2f') -Weights @(0.246,0.074,0.186,0.112,0.134,0.246)
Build-Face -Name 's3' -File 'Snapchat-1628721123_1.mp4' -Seek 2.40 -Take 19.57 -Keys @('3a','3b','3c','3d','3e') -Weights @(0.163,0.171,0.225,0.180,0.261)
Build-Demo
Build-Face -Name 's5' -File 'Snapchat-1725301133_1_1.mp4' -Seek 1.33 -Take 19.77 -Keys @('5a','5b','5c','5d','5e') -Weights @(0.177,0.269,0.131,0.215,0.207)
Build-Face -Name 's6' -File 'Snapchat-824965841.mp4'     -Seek 1.63 -Take 16.51 -Keys @('6a','6b','6c','6d','6e') -Weights @(0.211,0.173,0.125,0.250,0.241)
Build-End

$list = Join-Path $build 'concat.txt'
$lines = @('s1','s2','s3','demo','s5','s6','end') | ForEach-Object { "file '" + ((Join-Path $seg ($_ + '.mp4')) -replace '\\','/') + "'" }
Set-Content -LiteralPath $list -Value $lines -Encoding ascii

$joined = Join-Path $build 'joined.mp4'
& $ff -y -hide_banner -loglevel error -f concat -safe 0 -i $list -c copy $joined 2>&1 | Out-String | Write-Output

$final = 'C:\Users\oyeba\OneDrive\Desktop\PageCheck-face-2min.mp4'
& $ff -y -hide_banner -loglevel error -i $joined -c:v copy -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 -ac 1 -movflags +faststart $final 2>&1 | Out-String | Write-Output

& $probe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height,r_frame_rate -of default=noprint_wrappers=1 $final
