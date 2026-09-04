# KOYOMI — an anime almanac

A free, static anime browsing site. No backend, no API key, no build step —
just HTML/CSS/JS pulling live data from the [Jikan API](https://jikan.moe)
(an unofficial, free MyAnimeList API).

**Features**
- Rotating hero banner of anime airing this season
- "Airing this season" and "Highest rated, all time" grids
- Live search against MyAnimeList's catalog
- Click any card for synopsis, genres, and a link to MyAnimeList

## Run it locally

No install needed — it's plain HTML/CSS/JS. Just open `index.html` in a
browser, or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy for free on GitHub Pages

1. Create a new repo on GitHub (e.g. `koyomi`), and push this folder to it —
   see the exact commands below.
2. On GitHub, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
4. Wait ~1 minute, then your site is live at:
   `https://<your-username>.github.io/koyomi/`

## Push this to GitHub

```bash
cd anime-site
git add .
git commit -m "Initial commit: KOYOMI anime site"
git branch -M main
git remote add origin https://github.com/<your-username>/koyomi.git
git push -u origin main
```

(Create the empty repo on github.com first — no README/license/gitignore,
since this folder already has them.)

## Notes

- Jikan is rate-limited (~3 requests/second). The site already paces its
  calls, but if you see load errors, it usually clears on a refresh.
- All cover art and metadata belong to MyAnimeList / their respective
  copyright holders — this project only displays data via Jikan's public API.
