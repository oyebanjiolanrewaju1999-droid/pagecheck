$ff = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffmpeg.exe'
$probe = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffprobe.exe'
$src = 'C:\Users\oyeba\OneDrive\Desktop\PageCheck-Podcast-60s.mp4'
$out = 'C:\Users\oyeba\OneDrive\Desktop\PageCheck-Podcast-60s-tight.mp4'

$dur = [double](& $probe -v error -show_entries format=duration -of csv=p=0 $src)
$log = & $ff -hide_banner -i $src -af "silencedetect=noise=-37dB:d=0.80" -f null - 2>&1

$silences = @()
$curStart = $null
foreach ($line in $log) {
  if ($line -match 'silence_start: ([\d\.]+)') { $curStart = [double]$matches[1] }
  elseif ($line -match 'silence_end: ([\d\.]+)') {
    if ($null -ne $curStart) { $silences += ,@($curStart, [double]$matches[1]); $curStart = $null }
  }
}
if ($null -ne $curStart) { $silences += ,@($curStart, $dur) }

$keep = @()
$cursor = 0.0
foreach ($s in $silences) {
  $start = $s[0]; $end = $s[1]
  $pad = 0.32
  if ($start - $cursor -gt 0.35) { $keep += ,@($cursor, [math]::Max($cursor, $start - $pad)) }
  $cursor = [math]::Min($dur, $end + $pad)
}
if ($dur - $cursor -gt 0.35) { $keep += ,@($cursor, $dur) }

Write-Output ("segments kept: " + $keep.Count)

$vParts = ''; $aParts = ''; $concatInputs = ''
for ($i = 0; $i -lt $keep.Count; $i++) {
  $a = [math]::Round($keep[$i][0], 3); $b = [math]::Round($keep[$i][1], 3)
  $vParts += "[0:v]trim=$a`:$b,setpts=PTS-STARTPTS[v$i];"
  $aParts += "[0:a]atrim=$a`:$b,asetpts=PTS-STARTPTS[a$i];"
  $concatInputs += "[v$i][a$i]"
}
$filter = $vParts + $aParts + $concatInputs + "concat=n=$($keep.Count):v=1:a=1[vout][aout]"

& $ff -y -hide_banner -loglevel error -i $src -filter_complex $filter -map "[vout]" -map "[aout]" `
  -c:v h264_mf -b:v 5M -maxrate 6M -bufsize 10M -pix_fmt yuv420p -r 30 `
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart $out 2>&1 | Out-String | Write-Output

& $probe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 $out
