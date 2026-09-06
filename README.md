<div align="center">

# ManhwaIndo Scraper

![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white)
![Deps](https://img.shields.io/badge/deps-0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Scrape manhwaindo.my pakai Node.js stdlib. Tanpa `npm install`.

</div>

## Syarat

Kamu butuh Node.js 18 ke atas. Cek versimu:

```bash
node -v
```

## Pakai

```bash
node scraper.js homepage              # beranda: populer + update terbaru
node scraper.js popular               # hanya Popular Today
node scraper.js latest                # hanya update terbaru
node scraper.js katalog --pages 3     # daftar komik, 20 judul per halaman
node scraper.js updates --pages 2     # halaman Project Update
node scraper.js search "solo"         # cari judul, simpan ke search-solo.json
node scraper.js genre action --pages 2
node scraper.js series lookism        # detail + daftar chapter
node scraper.js chapter <url>         # ambil semua URL gambar satu chapter
node scraper.js sitemap               # dump semua URL series + chapter
```

Tambah `--out namafile.json` kalau kamu mau nama file sendiri. Semua hasil masuk ke `output/`.

## Output

Satu item katalog:

```json
{
  "title": "Lookism",
  "slug": "lookism",
  "url": "https://www.manhwaindo.my/series/lookism/",
  "cover": "http://kacu.gmbr.pro/uploads/manga-images/l/lookism/thumbnail.jpg",
  "type": "Manhwa",
  "latest_chapter": "Chapter 623",
  "rating": "8.7"
}
```

Detail series (`node scraper.js series lookism`):

```json
{
  "title": "Lookism",
  "status": "Ongoing",
  "type": "Manhwa",
  "author": "Park Tae Joon",
  "rating": "8.7",
  "followers": "2538",
  "genres": ["Action", "Comedy", "Drama"],
  "synopsis": "Park Hyung Suk...",
  "chapters": [
    {
      "number": "623",
      "title": "Chapter 623",
      "url": "https://www.manhwaindo.my/lookism-chapter-623/",
      "date": "4 September 2026"
    }
  ]
}
```

Gambar chapter (`node scraper.js chapter <url>`):

```json
{
  "title": "Lookism Chapter 623",
  "series_url": "https://www.manhwaindo.my/series/lookism/",
  "page_count": 18,
  "images": [
    "http://kacu.gmbr.pro/uploads/manga-images/l/lookism/chapter-623/1.jpg",
    "http://kacu.gmbr.pro/uploads/manga-images/l/lookism/chapter-623/2.jpg"
  ]
}
```

## Batas

Katalog punya 381 halaman. Beri jeda antar request, scraper ini sudah pasang 800ms. Gas 381 halaman sekaligus bikin IP kamu kena rate limit.

`bookmark/` baca localStorage browser, server kirim HTML kosong. `az-list/` kirim shortcode mentah. Pakai `katalog` atau `search` untuk dua kasus itu.

## Lisensi

File ini rilis di bawah [MIT](LICENSE). Pakai, ubah, jual. Sertakan file lisensinya.

---

<div align="center">

<a href="http://warungerik.com/payment"><img src="https://img.shields.io/badge/☕_Traktir_Kopi-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Traktir Kopi"></a>

</div>
