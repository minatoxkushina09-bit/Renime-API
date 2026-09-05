const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');
const { httpClient } = require('../utils/http');
const { getRandomUserAgent } = require('../config/user-agents');

class SiteExtractor extends BaseExtractor {
  constructor(provider) {
    super();
    this.base = new WatchAnimeWorldBase(provider);
  }

  async fetch(path = '') {
    const url = this.base.buildUrl(path);

    const response = await httpClient.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),

        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

        'Accept-Language': 'en-US,en;q=0.9',

        'Referer': this.base.buildUrl('/'),

        'Cache-Control': 'no-cache',

        'Pragma': 'no-cache',

        'Upgrade-Insecure-Requests': '1'
      }
    });

    return response;
  }

  absolute(v) {
    return v ? this.base.buildUrl(v) : '';
  }

  slug(url) {
    try {
      let p = new URL(this.absolute(url))
        .pathname
        .split('/')
        .filter(Boolean);

      return p[p.length - 1] || '';
    } catch {
      return '';
    }
  }

  item($, el) {
    const a = $(el)
      .find(
        'a[href*="/anime/"],a[href*="/series/"],a[href*="/movie/"],a[href]'
      )
      .first();

    const href = a.attr('href') || '';

    const img = $(el).find('img').first();

    const title = (
      a.attr('title') ||
      img.attr('alt') ||
      $(el)
        .find('h1,h2,h3,h4,.title,.entry-title')
        .first()
        .text()
    )
      .replace(/^Image\s+/, '')
      .trim();

    if (!title || !href) return null;

    const text = $(el)
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    return {
      id: this.slug(href),
      title,
      image: this.absolute(
        img.attr('src') ||
        img.attr('data-src') ||
        ''
      ),
      url: this.absolute(href),

      type: /movie|movies/i.test(href)
        ? 'movie'
        : /anime|series/i.test(href)
          ? 'series'
          : 'unknown',

      meta: text.match(/(\d+|\?)\s*EPS/i)?.[1] || '',

      year: text.match(/\b(19|20)\d{2}\b/)?.[0] || ''
    };
  }

  list($, selectors) {
    const out = [];
    const seen = new Set();

    $(selectors).each((_, el) => {
      const x = this.item($, el);

      if (x && x.id && !seen.has(x.id)) {
        seen.add(x.id);
        out.push(x);
      }
    });

    return out;
  }

  async page(path = '') {
    const html = await this.fetch(path);

    return {
      html,
      $: this.loadCheerio(html)
    };
  }
}

module.exports = { SiteExtractor };
