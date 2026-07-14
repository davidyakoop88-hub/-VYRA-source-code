Add-Type -AssemblyName System.Drawing
$root=Split-Path -Parent $PSScriptRoot
$source='C:\Users\A\Downloads\e9a6e9ae-af6e-4d9e-9b45-0b663ec680d4.png'
$out=Join-Path $root 'assets\images\battle'
$src=[System.Drawing.Bitmap]::FromFile($source)

function Cutout($name,$rect,$threshold,$feather,$ellipse){
  $crop=$src.Clone($rect,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dst=[System.Drawing.Bitmap]::new($crop.Width,$crop.Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $shape=$null
  if($name -eq 'pink-princess-x2-main.png'){
    $shape=[System.Drawing.Bitmap]::new($crop.Width,$crop.Height)
    $sg=[System.Drawing.Graphics]::FromImage($shape);$sg.Clear([System.Drawing.Color]::Black)
    $white=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $xpoly=[System.Drawing.Point[]]@([System.Drawing.Point]::new(5,12),[System.Drawing.Point]::new(82,12),[System.Drawing.Point]::new(116,83),[System.Drawing.Point]::new(153,12),[System.Drawing.Point]::new(229,12),[System.Drawing.Point]::new(165,145),[System.Drawing.Point]::new(229,298),[System.Drawing.Point]::new(151,298),[System.Drawing.Point]::new(114,210),[System.Drawing.Point]::new(75,298),[System.Drawing.Point]::new(0,298),[System.Drawing.Point]::new(68,145))
    $twopoly=[System.Drawing.Point[]]@([System.Drawing.Point]::new(250,12),[System.Drawing.Point]::new(430,12),[System.Drawing.Point]::new(474,48),[System.Drawing.Point]::new(474,123),[System.Drawing.Point]::new(445,163),[System.Drawing.Point]::new(340,222),[System.Drawing.Point]::new(474,222),[System.Drawing.Point]::new(474,300),[System.Drawing.Point]::new(250,300),[System.Drawing.Point]::new(250,228),[System.Drawing.Point]::new(385,132),[System.Drawing.Point]::new(400,91),[System.Drawing.Point]::new(381,66),[System.Drawing.Point]::new(337,66),[System.Drawing.Point]::new(323,111),[System.Drawing.Point]::new(250,111))
    $sg.FillPolygon($white,$xpoly);$sg.FillPolygon($white,$twopoly);$white.Dispose();$sg.Dispose()
  }
  $cx=$crop.Width/2;$cy=$crop.Height/2
  for($y=0;$y -lt $crop.Height;$y++){for($x=0;$x -lt $crop.Width;$x++){
    $c=$crop.GetPixel($x,$y);$v=[math]::Max($c.R,[math]::Max($c.G,$c.B));$lum=.30*$c.R+.59*$c.G+.11*$c.B
    $a=if($v -le $threshold){0}elseif($v -lt ($threshold+$feather)){[int](255*($v-$threshold)/$feather)}else{255}
    if($ellipse){$dx=($x-$cx)/$cx;$dy=($y-$cy)/$cy;$edge=$dx*$dx+$dy*$dy;if($edge -gt 1){$a=0}elseif($edge -gt .82){$a=[int]($a*(1-$edge)/.18)}}
    if($lum -lt 24){$a=0};if($shape -and $shape.GetPixel($x,$y).R -lt 128){$a=0}
    $dst.SetPixel($x,$y,[System.Drawing.Color]::FromArgb([math]::Max(0,[math]::Min(255,$a)),$c.R,$c.G,$c.B))
  }}
  $dst.Save((Join-Path $out $name),[System.Drawing.Imaging.ImageFormat]::Png);if($shape){$shape.Dispose()};$dst.Dispose();$crop.Dispose()
}

# Main X2 only: excludes presentation panel, captions and platform.
Cutout 'pink-princess-x2-main.png' ([System.Drawing.Rectangle]::new(210,205,480,270)) 48 52 $false
# Platform only.
Cutout 'pink-princess-platform.png' ([System.Drawing.Rectangle]::new(210,445,475,165)) 42 50 $true
# Bright diamonds/hearts only; dark panel pixels become alpha.
Cutout 'pink-princess-diamonds.png' ([System.Drawing.Rectangle]::new(120,105,650,440)) 128 60 $true

# Separate procedural smoke alpha layer.
$smoke=[System.Drawing.Bitmap]::new(520,150,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g=[System.Drawing.Graphics]::FromImage($smoke);$g.SmoothingMode='AntiAlias'
$clouds=@(@(18,55,190,88,46),@(130,35,240,105,55),@(315,58,185,82,40),@(75,82,365,60,34))
foreach($q in $clouds){$b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($q[4],255,58,157));$g.FillEllipse($b,$q[0],$q[1],$q[2],$q[3]);$b.Dispose()}
$g.Dispose();$smoke.Save((Join-Path $out 'pink-princess-smoke.png'),[System.Drawing.Imaging.ImageFormat]::Png);$smoke.Dispose();$src.Dispose()
