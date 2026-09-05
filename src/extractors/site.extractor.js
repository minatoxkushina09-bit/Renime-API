/**
 * Site Extractor
 * Shared base extractor for anime providers
 */

const axios = require('axios');
const cheerio = require('cheerio');

class SiteExtractor {
  constructor(provider = 'animesky') {
    this.providers = {
      animesky: {
        providerId: 'animesky',
        baseUrl: 'https://animesky.app'
      },

      animelok: {
        providerId: 'animelok',
        baseUrl: 'https://animelok.live'
      }
    };

    const normalizedProvider = String(provider || 'animesky')
      .toLowerCase()
      .trim();

    this.base =
      this.providers[normalizedProvider] ||
      this.providers.animesky;

    this.client = axios.create({
      baseURL: this.base.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

        'Accept-Language':
          'en-US,en;q=0.9'
      }
    });
  }

  /**
   * Fetch a page from the selected provider.
   */
  async page(path = '/') {
    const cleanPath = path.startsWith('/')
      ? path
      : `/${path}`;

    const response = await this.client.get(cleanPath);

    const html = response.data;

    // ==============================
    // DEBUG INFORMATION
    // ==============================
    console.log('==============================');
    console.log('PROVIDER:', this.base.providerId);
    console.log('URL:', cleanPath);
    console.log('FULL URL:', this.base.baseUrl + cleanPath);
    console.log('STATUS:', response.status);
    console.log('HTML LENGTH:', html.length);

    console.log('HTML PREVIEW START');
    console.log(html.substring(0, 5000));
    console.log('HTML PREVIEW END');

    console.log('==============================');

    return {
      $: cheerio.load(html),
      html,
      url: response.config?.url || cleanPath,
      response
    };
  }

  /**
   * Convert a relative URL to an absolute URL.
   */
  absoluteUrl(url) {
    if (!url) {
      return null;
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    try {
      return new URL(
        url,
        this.base.baseUrl
      ).href;
    } catch (error) {
      return url;
    }
  }

  /**
   * Extract anime items from a Cheerio selection.
   */
  list($, selector) {
    const results = [];
    const seen = new Set();

    $(selector).each((index, element) => {
      const item = $(element);

      const anchor = item.is('a')
        ? item
        : item.find('a').first();

      const href = anchor.attr('href');

      const title =
        item.find('.film-name').first().text().trim() ||
        item.find('.anime-name').first().text().trim() ||
        item.find('.name').first().text().trim() ||
        item.find('.title').first().text().trim() ||
        item.find('h1, h2, h3, h4').first().text().trim() ||
        anchor.attr('title') ||
        anchor.text().trim();

      const imageElement = item.find('img').first();

      const image =
        imageElement.attr('data-src') ||
        imageElement.attr('data-lazy-src') ||
        imageElement.attr('src') ||
        null;

      if (!title) {
        return;
      }

      const absoluteHref =
        this.absoluteUrl(href);

      const absoluteImage =
        this.absoluteUrl(image);

      const key =
        absoluteHref ||
        `${title}-${index}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      results.push({
        id: href
          ? href
              .replace(
                /^https?:\/\/[^/]+/i,
                ''
              )
              .replace(
                /^\/+|\/+$/g,
                ''
              )
          : String(index),

        title,

        url: absoluteHref,

        image: absoluteImage,

        type:
          item.find('.type').first().text().trim() ||
          item.find('.fdi-item').first().text().trim() ||
          null,

        year:
          item.find('.year').first().text().trim() ||
          item.find('.fdi-item').last().text().trim() ||
          null
      });
    });

    return results;
  }
}

module.exports = { SiteExtractor };
