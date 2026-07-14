Add-Type -AssemblyName System.Drawing
$source='C:\Users\A\AppData\Local\Temp\codex-clipboard-a7cdb926-a75f-482a-bc4a-b3e5cb857db3.png'
$destination=Join-Path $PSScriptRoot '..\assets\images\heart-character.png'
$image=[System.Drawing.Bitmap]::FromFile($source)
$crop=New-Object System.Drawing.Bitmap 390,390,([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics=[System.Drawing.Graphics]::FromImage($crop)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.DrawImage($image,(New-Object System.Drawing.Rectangle 0,0,390,390),(New-Object System.Drawing.Rectangle 75,15,390,390),[System.Drawing.GraphicsUnit]::Pixel)
$graphics.Dispose()
for($y=0;$y-lt $crop.Height;$y++){for($x=0;$x-lt $crop.Width;$x++){$p=$crop.GetPixel($x,$y);$brightness=[math]::Max($p.R,[math]::Max($p.G,$p.B));if($brightness-lt 18){$crop.SetPixel($x,$y,[System.Drawing.Color]::Transparent)}elseif($brightness-lt 55){$alpha=[int](255*($brightness-18)/37);$crop.SetPixel($x,$y,[System.Drawing.Color]::FromArgb($alpha,$p.R,$p.G,$p.B))}}}
$crop.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose();$image.Dispose()
