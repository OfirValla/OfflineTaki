# Drives the app on the connected phone through home → lobby → game → reactions and saves
# screenshots into docs/screenshots (downscaled to half size). Needs one phone over adb with
# a player name already entered.
#
#   pwsh scripts/capture-screenshots.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out = Join-Path $root 'docs\screenshots'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$package = 'global.ultra.offlinetaki'

function Get-UiNodes {
  & $adb shell 'uiautomator dump /sdcard/ui.xml' | Out-Null
  $tmp = Join-Path $env:TEMP 'ui.xml'
  & $adb pull /sdcard/ui.xml $tmp | Out-Null
  return ([xml](Get-Content $tmp -Raw)).SelectNodes('//node')
}

function Tap-Text([string]$pattern) {
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $node = Get-UiNodes | Where-Object { $_.text -match $pattern -or $_.'content-desc' -match $pattern } | Select-Object -First 1
    if ($node) {
      if ($node.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
        $x = [int](([int]$Matches[1] + [int]$Matches[3]) / 2)
        $y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2)
        & $adb shell "input tap $x $y" | Out-Null
        Write-Output "tapped '$pattern' at $x,$y"
        return
      }
    }
    Start-Sleep -Milliseconds 700
  }
  throw "Could not find '$pattern' on screen"
}

function Save-Screenshot([string]$name) {
  Start-Sleep -Milliseconds 600
  $raw = Join-Path $env:TEMP "$name.png"
  & $adb shell "screencap -p /sdcard/shot.png" | Out-Null
  & $adb pull /sdcard/shot.png $raw | Out-Null
  $img = [System.Drawing.Image]::FromFile($raw)
  $w = [int]($img.Width / 2); $h = [int]($img.Height / 2)
  $small = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($small)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose(); $img.Dispose()
  $file = Join-Path $out "$name.png"
  $small.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $small.Dispose()
  Write-Output ("saved {0} ({1}x{2})" -f $name, $w, $h)
}

# Keep the screen on while plugged in and make sure it is awake.
& $adb shell "svc power stayon usb" | Out-Null
& $adb shell "input keyevent KEYCODE_WAKEUP" | Out-Null
& $adb shell "wm dismiss-keyguard" | Out-Null
Start-Sleep -Seconds 1

# Fresh start on the home screen.
& $adb shell "am force-stop $package" | Out-Null
& $adb shell "monkey -p $package -c android.intent.category.LAUNCHER 1" 2>&1 | Out-Null
Start-Sleep -Seconds 4
Save-Screenshot 'home'

Tap-Text '^Create Game$'
Start-Sleep -Seconds 2
Save-Screenshot 'lobby'

Tap-Text '^Start with'
Start-Sleep -Milliseconds 800
Tap-Text '^Start$'          # confirm the bots dialog
Start-Sleep -Seconds 6       # let the deal land and the bots make a few moves
Save-Screenshot 'game'

Tap-Text 'Send a reaction'
Start-Sleep -Seconds 1
Save-Screenshot 'reactions'
Tap-Text '^Send 😂$'
Start-Sleep -Milliseconds 900
Save-Screenshot 'reaction-bubble'

Write-Output 'done'
