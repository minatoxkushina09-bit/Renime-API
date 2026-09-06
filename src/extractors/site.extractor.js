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
      timeout: 30000,

      maxRedirects: 5,

      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

        'Accept-Language':
          'en-US,en;q=0.9',

        'Cache-Control':
          'no-cache',

        'Pragma':
          'no-cache',

        'Upgrade-Insecure-Requests':
          '1',

        'Sec-Fetch-Dest':
          'document',

        'Sec-Fetch-Mode':
          'navigate',

        'Sec-Fetch-Site':
          'none',

        'Sec-Fetch-User':
          '?1'
      },

      validateStatus: (status) =>
        status >= 200 &&
        status < 400
    });
  }

  /**
   * Delay helper.
   */
  delay(ms) {
    return new Promise(
      (resolve) => setTimeout(resolve, ms)
    );
  }

  /**
   * Fetch a page from the selected provider.
   */
  async page(path = '/') {
    const cleanPath =
      String(path).startsWith('/')
        ? path
        : `/${path}`;

    const requestHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

      'Accept-Language':
        'en-US,en;q=0.9',

      'Referer':
        `${this.base.baseUrl}/`,

      'Origin':
        this.base.baseUrl,

      'Cache-Control':
        'no-cache',

      'Pragma':
        'no-cache',

      'Upgrade-Insecure-Requests':
        '1',

      'Sec-Fetch-Dest':
        'document',

      'Sec-Fetch-Mode':
        'navigate',

      'Sec-Fetch-Site':
        'same-origin',

      'Sec-Fetch-User':
        '?1'
    };

    let lastError;

    // Retry the request a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(
          `FETCHING PAGE (${attempt + 1}/3):`,
          `${this.base.baseUrl}${cleanPath}`
        );

        const response =
          await this.client.get(
            cleanPath,
            {
              headers: requestHeaders
            }
          );

        const html =
          String(response.data || '');

        console.log(
          'PAGE STATUS:',
          response.status
        );

        console.log(
          'PAGE LENGTH:',
          html.length
        );

        if (!html || html.length < 50) {
          throw new Error(
            'Received empty HTML response'
          );
        }

        return {
          $: cheerio.load(html),

          html,

          url:
            response.request?.res?.responseUrl ||
            `${this.base.baseUrl}${cleanPath}`,

          response
        };
      } catch (error) {
        lastError = error;

        console.error(
          `PAGE REQUEST FAILED (${attempt + 1}/3):`,
          error.response?.status ||
            error.message
        );

        if (attempt < 2) {
          await this.delay(
            1000 * (attempt + 1)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Convert a relative URL to an absolute URL.
   */
  absoluteUrl(url) {
    if (!url) {
      return null;
    }

    const value =
      String(url).trim();

    if (!value) {
      return null;
    }

    if (
      /^https?:\/\//i.test(value)
    ) {
      return value;
    }

    try {
      return new URL(
        value,
        `${this.base.baseUrl}/`
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
        try {
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
        } catch (error) {
          console.error(
            'List extraction error:',
            error.message
          );
        }
      }
    );

    return results;
  }
}

module.exports = {
  SiteExtractor
};
