PAGEFIND = npx -y pagefind@1.5.2

.PHONY: dev build

dev:
	hugo --minify
	$(PAGEFIND) --site public --output-path static/pagefind
	hugo server --disableFastRender

build:
	hugo --minify
	$(PAGEFIND) --site public
