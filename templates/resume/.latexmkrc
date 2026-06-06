# latexmk configuration — XeLaTeX only.
# $pdf_mode = 5 selects XeLaTeX as the PDF producer; PostScript/DVI disabled.
$pdf_mode = 5;
$postscript_mode = 0;
$dvi_mode = 0;

# XeLaTeX invocation flags:
#   -interaction=nonstopmode  never stop for input (good for CI / agents)
#   -halt-on-error            fail fast on the first error
#   -file-line-error          "file:line: message" — easy to parse
#   -synctex=1                forward/inverse search between source and PDF
$xelatex = 'xelatex -interaction=nonstopmode -halt-on-error -file-line-error -synctex=1 %O %S';

# Files latexmk -c / -C should treat as generated cruft.
$clean_ext = 'synctex.gz synctex.gz(busy) run.xml';
