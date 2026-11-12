$ErrorActionPreference = 'Continue'
$ff = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffmpeg.exe'
$probe = 'C:\Users\oyeba\AppData\Local\CapCut\Apps\9.7.1.4203\ffprobe.exe'
$srcDir = 'C:\Users\oyeba\OneDrive\Desktop\tiktok'
$music = 'C:\Users\oyeba\OneDrive\Desktop\sweet-feel-good-trimmed.mp3'
$out = 'C:\Users\oyeba\OneDrive\Desktop\tiktok-slideshow.mp4'

# Sorted-by-name index -> look:
#  0,1  leopard      2,3 burgundy      4-8 white
#  9-14 green (13 is a duplicate of 12)      15,16 pink      17,18,19 bright red
# Order follows the caption: red -> pink -> white -> green, leopard as the opener.
$order = @(0,1,  17,18,19,2,3,  15,16,  4,5,6,7,8,  9,10,11,12,14)

$all = Get-ChildItem $srcDir -File | Where-Object { $_.Extension -match '\.(png|jpg|jpeg|webp)$' } | Sort-Object Name
$images = @()
foreach ($i in $order) { $images += $all[$i].FullName }

$count = $images.Count
$D = 2.2
$X = 0.4
$total = [math]::Round($count * $D - ($count - 1) * $X, 2)
Write-Output ("images: $count  length: ${total}s")

$args = @('-y','-hide_banner','-loglevel','error')
foreach ($img in $images) { $args += @('-loop','1','-t',"$D",'-i',$img) }
$args += @('-t',"$total",'-i',$music)

$filter = ''
for ($i = 0; $i -lt $count; $i++) {
  $filter += "[$i`:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[v$i];"
}
$prev = 'v0'
for ($i = 1; $i -lt $count; $i++) {
  $offset = [math]::Round($i * ($D - $X), 2)
  $next = "x$i"
  $filter += "[$prev][v$i]xfade=transition=fadeblack:duration=$X`:offset=$offset[$next];"
  $prev = $next
}
$audioIndex = $count
$filter += "[$audioIndex`:a]afade=t=out:st=" + [math]::Round($total - 1.2, 2) + ":d=1.2,volume=-2dB[aout]"

$args += @('-filter_complex', $filter, '-map', "[$prev]", '-map', '[aout]')
$args += @('-c:v','h264_mf','-b:v','6M','-maxrate','8M','-bufsize','12M','-pix_fmt','yuv420p','-r','30')
$args += @('-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart')
$args += $out

& $ff @args 2>&1 | Out-String | Write-Output

if (Test-Path $out) {
  & $probe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height -of default=noprint_wrappers=1 $out
} else { Write-Output "FAILED" }
