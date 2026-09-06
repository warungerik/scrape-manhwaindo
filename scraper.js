const fs = require('fs');
const path = require('path');

const BASE = 'https://www.manhwaindo.my';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const decode = (s = '') => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e]))
  .replace(/\s+/g, ' ').trim();

const strip = (s = '') => decode(s.replace(/<[^>]+>/g, ' '));

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.9' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function collectPages(makeUrl, maxPages, delay = 800) {
  const all = [];
  const seen = new Set();
  for (let p = 1; p <= maxPages; p++) {
    let html;
    try {
      html = await get(makeUrl(p));
    } catch (e) {
      if (p === 1) throw e;
      break;
    }
    const cards = parseCards(html);
    const fresh = cards.filter(c => !seen.has(c.url));
    if (!cards.length || !fresh.length) break;
    fresh.forEach(c => seen.add(c.url));
    all.push(...fresh);
    console.error(`hal ${p}: +${fresh.length} (total ${all.length})`);
    await sleep(delay);
  }
  return all;
}

function imgOf(block) {
  const m = block.match(/data-src="([^"]+)"/) || block.match(/<img[^>]+src="([^"]+)"/);
  const src = m ? m[1] : '';
  return src.includes('data:image/svg') ? '' : decode(src);
}

function parseCards(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="bsx">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/a>\s*<\/div>\s*<\/div>/g)) {
    const b = m[1];
    const href = (b.match(/<a[^>]+href="([^"]+series\/[^"]*)"/) || [])[1] || '';
    const type = decode((b.match(/<span class="typename[^"]*">([^<]+)<\/span>/) || [])[1] || '');
    const title = decode((b.match(/<div class="tt">\s*([^<]+?)\s*<\/div>/) || [])[1] || '');
    const chapter = decode((b.match(/<div class="epxs">([^<]+)<\/div>/) || [])[1] || '');
    const rating = decode((b.match(/<div class="numscore">([^<]+)<\/div>/) || [])[1] || '');
    if (title && href) {
      out.push({
        title,
        slug: href.split('/series/')[1]?.replace(/\/$/, ''),
        url: href,
        cover: imgOf(b),
        type,
        latest_chapter: chapter,
        rating
      });
    }
  }
  return out;
}

function parseLatest(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="utao">([\s\S]*?)<\/ul>\s*<\/div>\s*<\/div>\s*<\/div>/g)) {
    const b = m[1];
    const href = (b.match(/<a[^>]*class="series"[^>]*href="([^"]+)"/) || [])[1] || '';
    const title = decode((b.match(/<h4>([^<]+)<\/h4>/) || [])[1] || '');
    const type = decode((b.match(/<ul class="([^"]+)">/) || [])[1] || '');
    const chapters = [...b.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><span>([^<]+)<\/span><\/li>/g)]
      .map(c => ({ title: decode(c[2]), url: c[1], updated: decode(c[3]) }));
    if (title) {
      out.push({
        title,
        slug: href.split('/series/')[1]?.replace(/\/$/, ''),
        url: href,
        cover: imgOf(b),
        type,
        chapters
      });
    }
  }
  return out;
}

function parseSeries(html, url) {
  const one = (re) => decode((html.match(re) || [])[1] || '');
  const impt = (label) => {
    const m = html.match(new RegExp(label + '\\s*(?:<a[^>]*>([^<]+)</a>|<i>(?:<[^>]+>)?([^<]+))', 'i'));
    return decode((m && (m[1] || m[2])) || '');
  };
  return {
    title: one(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i),
    alternative: one(/<span class="alternative">([\s\S]*?)<\/span>/i),
    url,
    slug: url.split('/series/')[1]?.replace(/\/$/, ''),
    cover: (html.match(/class="thumb"[\s\S]*?<img[^>]+src="([^"]+)"/i) || [])[1] || '',
    status: impt('Status'),
    type: impt('Type'),
    author: impt('Author'),
    posted_on: strip((html.match(/Posted On[\s\S]*?<time[^>]*>([^<]+)<\/time>/i) || [])[0] || ''),
    updated_on: strip((html.match(/Updated On[\s\S]*?<time[^>]*>([^<]+)<\/time>/i) || [])[0] || ''),
    rating: one(/itemprop="ratingValue"[^>]*content="([^"]+)"/i) || one(/<div class="num"[^>]*>([^<]+)<\/div>/i),
    followers: one(/Followed by ([^<]+) people/i),
    genres: [...html.matchAll(/\/genres\/[^"]*"[^>]*rel="tag">([^<]+)<\/a>/g)].map(g => decode(g[1])),
    synopsis: strip((html.match(/<div class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || ''),
    chapters: [...html.matchAll(/<li[^>]*data-num="([^"]*)"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span class="chapternum">([^<]+)<\/span>[\s\S]*?<span class="chapterdate">([^<]+)<\/span>/g)]
      .map(c => ({ number: c[1], title: decode(c[3]), url: c[2], date: decode(c[4]) }))
  };
}

function parseChapter(html, url) {
  const src = html.match(/ts_reader\.run\((\{[\s\S]*?\})\);<\/script>/)?.[1] || '';
  const unesc = src.replace(/\\\//g, '/');
  const images = [...unesc.matchAll(/https?:\/\/[^"\\\s]+\.(?:jpe?g|png|webp)/gi)].map(m => m[0].replace(/\\/g, ''));
  const uniq = [...new Set(images)].filter(u => !u.includes('readerarea.svg'));
  return {
    title: decode((html.match(/<h1 class="entry-title"[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ''),
    url,
    series_url: (html.match(/class="[^"]*backseries[^"]*"[^>]*>[\s\S]*?<a href="([^"]+)"/) || html.match(/<a href="([^"]+\/series\/[^"]*)"><i class="fas fa-angle-double-left"/) || [])[1] || '',
    prev_chapter: decode((unesc.match(/"prevUrl":"([^"]*)"/) || [])[1] || ''),
    next_chapter: decode((unesc.match(/"nextUrl":"([^"]*)"/) || [])[1] || ''),
    page_count: uniq.length,
    images: uniq
  };
}

function save(name, data) {
  const dir = path.join(__dirname, 'output');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

(async () => {
  const [cmd, arg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const pagesFlag = process.argv.find(a => a.startsWith('--pages'));
  const pages = pagesFlag ? +pagesFlag.split('=')[1] || +process.argv[process.argv.indexOf(pagesFlag) + 1] || 1 : 1;
  const outFlag = process.argv.find(a => a.startsWith('--out'));
  const outName = outFlag ? outFlag.split('=')[1] || process.argv[process.argv.indexOf(outFlag) + 1] : null;

  const done = (name, data) => {
    const file = save(outName || name, data);
    console.log(JSON.stringify(data, null, 2).slice(0, 2000));
    if (JSON.stringify(data).length > 2000) console.log(`... (${file})`);
  };

  try {
    if (cmd === 'popular') {
      done('popular.json', { source: BASE, scraped_at: new Date().toISOString(), data: parseCards(await get(BASE + '/')) });
    } else if (cmd === 'latest') {
      done('latest.json', { source: BASE, scraped_at: new Date().toISOString(), data: parseLatest(await get(BASE + '/')) });
    } else if (cmd === 'homepage') {
      const html = await get(BASE + '/');
      done('homepage.json', { source: BASE, scraped_at: new Date().toISOString(), popular_today: parseCards(html), latest_updates: parseLatest(html) });
    } else if (cmd === 'katalog') {
      const all = [];
      for (let p = 1; p <= pages; p++) {
        const cards = parseCards(await get(`${BASE}/series/?page=${p}`));
        all.push(...cards);
        await sleep(800);
      }
      done('katalog.json', { source: `${BASE}/series/`, scraped_at: new Date().toISOString(), pages, count: all.length, data: all });
    } else if (cmd === 'series') {
      if (!arg) throw new Error('argumen dibutuhkan: node scraper.js series <slug|url>');
      const url = arg.startsWith('http') ? arg : `${BASE}/series/${arg.replace(/\/$/, '')}/`;
      done(`${url.split('/series/')[1].replace(/\/$/, '')}.json`, parseSeries(await get(url), url));
    } else if (cmd === 'chapter') {
      if (!arg) throw new Error('argumen dibutuhkan: node scraper.js chapter <url>');
      done('chapter.json', parseChapter(await get(arg), arg));
    } else if (cmd === 'search') {
      if (!arg) throw new Error('argumen dibutuhkan: node scraper.js search <kata-kunci>');
      const q = encodeURIComponent(arg);
      const cards = parseCards(await get(`${BASE}/?s=${q}`));
      done(`search-${arg.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, { query: arg, source: `${BASE}/?s=${q}`, scraped_at: new Date().toISOString(), count: cards.length, data: cards });
    } else if (cmd === 'genre') {
      if (!arg) throw new Error('argumen dibutuhkan: node scraper.js genre <slug>');
      const slug = arg.toLowerCase().replace(/\/$/, '');
      const data = await collectPages(p => `${BASE}/genres/${slug}/${p > 1 ? `page/${p}/` : ''}`, pages);
      done(`genre-${slug}.json`, { genre: slug, source: `${BASE}/genres/${slug}/`, scraped_at: new Date().toISOString(), pages, count: data.length, data });
    } else if (cmd === 'updates') {
      const data = await collectPages(p => `${BASE}/project-updates/${p > 1 ? `page/${p}/` : ''}`, pages);
      done('project-updates.json', { source: `${BASE}/project-updates/`, scraped_at: new Date().toISOString(), count: data.length, data });
    } else if (cmd === 'sitemap') {
      const index = await get(`${BASE}/wp-sitemap.xml`);
      const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      const urls = [];
      for (const m of maps) {
        const xml = await get(m);
        urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1]));
        await sleep(500);
      }
      const series = urls.filter(u => /\/series\//.test(u));
      const chapters = urls.filter(u => !/\/series\//.test(u) && /^https?:\/\/[^/]+\/[^/]+\/?$/.test(u));
      done('sitemap.json', { source: `${BASE}/wp-sitemap.xml`, scraped_at: new Date().toISOString(), total_urls: urls.length, series_count: series.length, series, chapters });
    } else {
      console.log('Perintah: popular | latest | homepage | katalog | updates | search | genre | series | chapter | sitemap');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
