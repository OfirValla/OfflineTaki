# Renders the legacy launcher PNGs (Android 7) and a 512 px preview from the same design as
# scripts/generate-icon.js, using GDI+ which ships with Windows.
#
#   pwsh scripts/render-icon-pngs.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$res = Join-Path $root 'android\app\src\main\res'

# Same numbers as DESIGN in generate-icon.js (108-unit canvas).
$background = [System.Drawing.ColorTranslator]::FromHtml('#1E63AD')
$cardW = 26; $cardH = 36; $cardR = 3.5; $cardTop = 36; $pivotY = 86
$fan = @(
  @{ rotation = -24; color = '#E63946' },
  @{ rotation = -8; color = '#2A7DE1' },
  @{ rotation = 8;   color = '#2BB673' },
  @{ rotation = 24;  color = '#F5C518' }
)

function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Draw-Icon([System.Drawing.Graphics]$g, [float]$size, [bool]$round, [bool]$legacyCorners) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Legacy icons are drawn on the visible 72/108 part of the adaptive canvas, so scale that up.
  $visible = 72.0
  $scale = $size / $visible
  $g.TranslateTransform(-18 * $scale, -18 * $scale)
  $g.ScaleTransform($scale, $scale)

  # Clip to the icon shape.
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($round) { $clip.AddEllipse(18, 18, 72, 72) }
  elseif ($legacyCorners) { $clip = New-RoundedRect 18 18 72 72 12 }
  else { $clip.AddRectangle((New-Object System.Drawing.RectangleF 18, 18, 72, 72)) }
  $g.SetClip($clip)

  # Background with a soft radial lift in the middle.
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $background), 0, 0, 108, 108)
  $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $glowPath.AddEllipse(20, 20, 68, 68)
  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(70, 255, 255, 255)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
  $g.FillEllipse($glow, 20, 20, 68, 68)

  $x = 54 - $cardW / 2
  $cy = $cardTop + $cardH / 2
  foreach ($c in $fan) {
    $state = $g.Save()
    $g.TranslateTransform(54, $pivotY)
    $g.RotateTransform($c.rotation)
    $g.TranslateTransform(-54, -$pivotY)

    $shadow = New-RoundedRect ($x + 1.2) ($cardTop + 1.8) $cardW $cardH $cardR
    $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(85, 0, 0, 0))), $shadow)
    $face = New-RoundedRect $x $cardTop $cardW $cardH $cardR
    $g.FillPath([System.Drawing.Brushes]::White, $face)
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#E4EAF3')), 1.2), $face)

    $color = [System.Drawing.ColorTranslator]::FromHtml($c.color)
    $brush = New-Object System.Drawing.SolidBrush $color
    $g.FillEllipse($brush, 54 - 7.5, $cy - 7.5, 15, 15)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 255, 255, 255))), 54 - 2.5 - 2.2, $cy - 3 - 2.2, 4.4, 4.4)
    $g.FillPath($brush, (New-RoundedRect ($x + 2.5) ($cardTop + 2.5) 4 5.5 1.1))
    $g.FillPath($brush, (New-RoundedRect ($x + $cardW - 6.5) ($cardTop + $cardH - 8) 4 5.5 1.1))

    $g.Restore($state)
  }
  $g.ResetClip()
}

function Save-Icon([string]$file, [int]$size, [bool]$round, [bool]$legacyCorners) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Draw-Icon $g $size $round $legacyCorners
  $g.Dispose()
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $file) | Out-Null
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("{0}  {1}px" -f ($file.Substring($root.Length + 1)), $size)
}

$densities = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
foreach ($d in $densities.GetEnumerator()) {
  Save-Icon (Join-Path $res "mipmap-$($d.Key)\ic_launcher.png") $d.Value $false $true
  Save-Icon (Join-Path $res "mipmap-$($d.Key)\ic_launcher_round.png") $d.Value $true $false
}
Save-Icon (Join-Path $root 'dist\icon-512.png') 512 $false $true
