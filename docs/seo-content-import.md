# SEO Content Import Workflow

This project uses a file-based SEO content pipeline.

## Canonical source of truth

- Article data: `data/seo/articles.generated.json`
- Article index: `data/seo/article-index.generated.json`
- Article images: `public/seo/images/*`
- Importer: `scripts/import-seo-content.ts`

The landing page resources section, `/blog`, and `/blog/[slug]` all consume this same generated dataset.

## Import command

```bash
npm run seo:import -- \
  --articles-zip /absolute/path/to/gemz-seo-articles.zip \
  --images-zip /absolute/path/to/gemz-seo-images.zip
```

Optional flags:

- `--output-dir /absolute/path/to/output`
- `--public-images-dir /absolute/path/to/public/images`

## Notes

- The importer reads DOCX from the articles ZIP, extracts text blocks, and resolves image placeholders like `INSERT IMAGE: file-name.png`.
- The importer copies all ZIP images to `public/seo/images` and maps article image references automatically.
- If an article references a missing image, the importer warns and falls back to the first available image in that article.
