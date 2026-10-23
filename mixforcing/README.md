# Mix Forcing project page

Published URL: https://zelingao98.github.io/mixforcing/

This directory is a static website. The repository's existing GitHub Pages
configuration publishes `main` from the repository root. No build step is needed.

## Publish

From the repository root, push the prepared local commit:

```sh
git push origin main
```

## Paper link

The Paper button is disabled until the arXiv paper is available. After publication,
replace that button in `index.html` with a link to the arXiv abstract page, remove
the pending state, and add the arXiv PDF URL to `citation_pdf_url`. Update the BibTeX
both in `index.html` and in `assets/mix-forcing.bib` with the arXiv identifier.
Also replace the pending Paper button in the personal homepage's Mix Forcing card
(`../index.html`, under `#mix-forcing`) with the same arXiv abstract link.
The local manuscript PDF is excluded from Git.

## Video files

The checked-in website assets are below GitHub's per-file size limit and can be
pushed with regular Git. Do not convert them to Git LFS: GitHub Pages does not
serve LFS objects as website assets.

The one-hour video remains externally hosted as a GitHub Release asset, referenced
by `longRollout.src` in `assets.js`. Keep this URL unless replacing it with another
working video URL that supports seeking. Do not add the original one-hour MP4 to
the repository. Check the size of new videos before committing; files over
100 MiB must be hosted externally.

Local preview from the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/mixforcing/.
