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

    const normalizedProvider = String(
      provider || 'animesky'
    )
      .toLowerCase()
      .trim();

    this.base =
      this.providers[normalizedProvider] ||
      this.providers.animesky;

    this.client = axios.create({
      baseURL: this.base.baseUrl,

      timeout: 20000,

      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',

        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

        'Accept-Language':
          'en-US,en;q=0.9',

        'Accept-Encoding':
          'gzip, deflate, br',

        'Cache-Control':
          'no-cache',

        'Upgrade-Insecure-Requests':
          '1'
      },

      validateStatus: (status) =>
        status >= 200 &&
        status < 400
    });
  }

  /**
   * Fetch a page from the selected provider.
   */
  async page(path = '/') {
    const cleanPath = String(path).startsWith('/')
      ? path
      : `/${path}`;

    const response = await this.client.get(
      cleanPath,
      {
        headers: {
          Referer: `${this.base.baseUrl}/`
        }
      }
    );

    const html = String(
      response.data || ''
    );

    return {
      $: cheerio.load(html),
      html,
      url:
        response.config?.url ||
        cleanPath,
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

    if (
      /^https?:\/\//i.test(url)
    ) {
      return url;
    }

    try {
      return new URL(
        url,
        this.base.baseUrl
      ).href;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract anime items from a Cheerio selection.
   */
  list($, selector) {
    const results = [];
    const seen = new Set();

    $(selector).each(
      (index, element) => {
        const item = $(element);

        const anchor = item.is('a')
          ? item
          : item.find('a').first();

        const href =
          anchor.attr('href') || '';

        const title =
          item
            .find('.film-name')
            .first()
            .text()
            .trim() ||

          item
            .find('.anime-name')
            .first()
            .text()
            .trim() ||

          item
            .find('.name')
            .first()
            .text()
            .trim() ||

          item
            .find('.title')
            .first()
            .text()
            .trim() ||

          item
            .find('h1, h2, h3, h4')
            .first()
            .text()
            .trim() ||

          anchor.attr('title') ||

          anchor.text().trim();

        if (!title) {
          return;
        }

        const imageElement =
          item.find('img').first();

        const image =
          imageElement.attr('data-src') ||
          imageElement.attr('data-lazy-src') ||
          imageElement.attr('data-original') ||
          imageElement.attr('src') ||
          null;

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
            item
              .find('.type')
              .first()
              .text()
              .trim() ||

            item
              .find('.fdi-item')
              .first()
              .text()
              .trim() ||

            null,

          year:
            item
              .find('.year')
              .first()
              .text()
              .trim() ||

            null
        });
      }
    );

    return results;
  }
}

module.exports = {
  SiteExtractor
};
