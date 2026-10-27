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

The paper is available at https://arxiv.org/abs/2610.33589 (submitted October 24, 2026).
The project Paper button and the personal homepage's Mix Forcing card
(`../index.html`, under `#mix-forcing`) link to this abstract page.
The `citation_pdf_url` metadata points to https://arxiv.org/pdf/2610.33589.
Keep the inline BibTeX in `index.html` and the downloadable
`assets/mix-forcing.bib` synchronized when updating citation details.
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
