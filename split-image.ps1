Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\A\Downloads\729c04be-7acf-4977-9222-574b5b1be49e.png'
$outputDirectory = Join-Path $PSScriptRoot 'delad-bild'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
    $baseWidth = [math]::Floor($source.Width / 4)

    for ($index = 0; $index -lt 4; $index++) {
        $x = $index * $baseWidth
        $width = if ($index -eq 3) { $source.Width - $x } else { $baseWidth }
        $part = [System.Drawing.Bitmap]::new([int]$width, [int]$source.Height)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($part)
            try {
                $graphics.DrawImage(
                    $source,
                    (New-Object System.Drawing.Rectangle(0, 0, $width, $source.Height)),
                    (New-Object System.Drawing.Rectangle($x, 0, $width, $source.Height)),
                    [System.Drawing.GraphicsUnit]::Pixel
                )
            }
            finally {
                $graphics.Dispose()
            }

            $outputPath = Join-Path $outputDirectory ('del-{0}.png' -f ($index + 1))
            $part.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $part.Dispose()
        }
    }
}
finally {
    $source.Dispose()
}
