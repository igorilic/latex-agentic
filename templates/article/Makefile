# Makefile for the latex-agentic article template (XeLaTeX).
# Targets: pdf (default), watch, clean, distclean, wordcount.
# All real work is delegated to latexmk, which reads ./.latexmkrc.

MAIN := main

.PHONY: pdf watch clean distclean wordcount help

## pdf: build $(MAIN).pdf with XeLaTeX (runs biber as needed)
pdf:
	latexmk -xelatex $(MAIN)

## watch: continuous preview — rebuild on save (Ctrl-C to stop)
watch:
	latexmk -xelatex -pvc $(MAIN)

## clean: remove auxiliary build files, keep the PDF
clean:
	latexmk -c $(MAIN)

## distclean: remove auxiliary build files AND the PDF
distclean:
	latexmk -C $(MAIN)

## wordcount: approximate body word count (texcount if available)
wordcount:
	@if command -v texcount >/dev/null 2>&1; then \
		texcount -inc -sum -1 $(MAIN).tex; \
	else \
		echo "texcount not found; rough fallback (detex|wc):"; \
		if command -v detex >/dev/null 2>&1; then \
			detex $(MAIN).tex | wc -w; \
		else \
			wc -w $(MAIN).tex; \
		fi; \
	fi

## help: list available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /'
