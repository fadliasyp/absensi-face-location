$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconDirectory = Join-Path $projectRoot "assets\icons"
$iconNames = @(
  "calendar-time",
  "export",
  "face",
  "face-scan",
  "face-scanner",
  "folder",
  "location",
  "scan",
  "task",
  "tasks"
)

foreach ($iconName in $iconNames) {
  $sourcePath = Join-Path $iconDirectory "$iconName-optimized.gif"
  $outputPath = Join-Path $iconDirectory "$iconName-static.png"
  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

  try {
    $frameDimension = New-Object System.Drawing.Imaging.FrameDimension(
      $sourceImage.FrameDimensionsList[0]
    )
    [void]$sourceImage.SelectActiveFrame($frameDimension, 0)

    $bitmap = New-Object System.Drawing.Bitmap(
      $sourceImage.Width,
      $sourceImage.Height,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImageUnscaled($sourceImage, 0, 0)
      } finally {
        $graphics.Dispose()
      }

      $bitmap.Save(
        $outputPath,
        [System.Drawing.Imaging.ImageFormat]::Png
      )
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

Write-Output "Generated $($iconNames.Count) transparent static icons."
