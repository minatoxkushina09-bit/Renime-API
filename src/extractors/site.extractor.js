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
      validateStatus: () => true,

      headers: this.getHeaders()
    });
  }

  /**
   * Get request headers.
   */
  getHeaders() {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/131.0.0.0 Safari/537.36',

      'Accept':
        'text/html,application/xhtml+xml,application/xml;' +
        'q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

      'Accept-Language':
        'en-US,en;q=0.9',

      'Accept-Encoding':
        'gzip, deflate, br',

      'Referer':
        `${this.base.baseUrl}/`,

      'Cache-Control':
        'no-cache',

      'Pragma':
        'no-cache'
    };
  }

  /**
   * Delay helper.
   */
  delay(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
  }

  /**
   * Build a valid path.
   */
  normalizePath(path = '/') {
    if (!path) {
      return '/';
    }

    const value = String(path).trim();

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);

        return `${url.pathname}${url.search}`;
      } catch (error) {
        return '/';
      }
    }

    return value.startsWith('/')
      ? value
      : `/${value}`;
  }

  /**
   * Fetch a page from the selected provider.
   */
  async page(path = '/') {
    const cleanPath =
      this.normalizePath(path);

    let lastError = null;

    for (
      let attempt = 0;
      attempt < 3;
      attempt++
    ) {
      try {
        const headers =
          this.getHeaders();

        console.log(
          `FETCHING ${this.base.providerId} ` +
          `(${attempt + 1}/3):`
        );

        console.log(
          `${this.base.baseUrl}${cleanPath}`
        );

        const response =
          await this.client.get(
            cleanPath,
            {
              headers,

              maxRedirects: 5,

              validateStatus: () => true
            }
          );

        console.log(
          'PAGE STATUS:',
          response.status
        );

        /*
         * Explicitly handle blocked requests.
         */
        if (
          response.status === 403 ||
          response.status === 401 ||
          response.status === 429
        ) {
          const error =
            new Error(
              `Request blocked with status ${response.status}`
            );

          error.response =
            response;

          throw error;
        }

        if (
          response.status < 200 ||
          response.status >= 400
        ) {
          const error =
            new Error(
              `Request failed with status ${response.status}`
            );

          error.response =
            response;

          throw error;
        }

        const html =
          String(
            response.data || ''
          );

        console.log(
          'PAGE LENGTH:',
          html.length
        );

        if (
          !html ||
          html.length < 50
        ) {
          throw new Error(
            'Received empty HTML response'
          );
        }

        const finalUrl =
          response.request?.res?.responseUrl ||
          `${this.base.baseUrl}${cleanPath}`;

        return {
          $: cheerio.load(html),

          html,

          url: finalUrl,

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
            1500 * (attempt + 1)
          );
        }
      }
    }

    throw lastError ||
      new Error(
        `Failed to fetch ${cleanPath}`
      );
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
      value.startsWith('#') ||
      value.startsWith('javascript:') ||
      value.startsWith('mailto:')
    ) {
      return null;
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
   * Extract clean ID from URL.
   */
  getIdFromUrl(url, fallback = '') {
    if (!url) {
      return fallback;
    }

    try {
      const parsed =
        new URL(
          this.absoluteUrl(url)
        );

      const parts =
        parsed.pathname
          .split('/')
          .filter(Boolean);

      /*
       * For:
       * /anime/123
       * /series/naruto
       */
      if (parts.length >= 2) {
        return parts[parts.length - 1];
      }

      return (
        parts[0] ||
        fallback
      );
    } catch (error) {
      return String(url)
        .replace(
          /^https?:\/\/[^/]+/i,
          ''
        )
        .replace(
          /^\/+|\/+$/g,
          ''
        ) ||
        fallback;
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
          const item =
            $(element);

          const anchor =
            item.is('a')
              ? item
              : item.find('a').first();

          const href =
            anchor.attr('href') || '';

          const absoluteHref =
            this.absoluteUrl(href);

          if (!absoluteHref) {
            return;
          }

          const imageElement =
            item.find('img').first();

          const title =
            item
              .find('.film-name')
              .first()
              .text()
              .replace(/\s+/g, ' ')
              .trim() ||

            item
              .find('.anime-name')
              .first()
              .text()
              .replace(/\s+/g, ' ')
              .trim() ||

            item
              .find('.name')
              .first()
              .text()
              .replace(/\s+/g, ' ')
              .trim() ||

            item
              .find('.title')
              .first()
              .text()
              .replace(/\s+/g, ' ')
              .trim() ||

            item
              .find(
                'h1, h2, h3, h4, h5, h6'
              )
              .first()
              .text()
              .replace(/\s+/g, ' ')
              .trim() ||

            imageElement
              .attr('alt') ||

            anchor
              .attr('title') ||

            anchor
              .text()
              .replace(/\s+/g, ' ')
              .trim();

          if (
            !title ||
            title.length < 2
          ) {
            return;
          }

          const image =
            imageElement.attr('data-src') ||
            imageElement.attr('data-lazy-src') ||
            imageElement.attr('data-original') ||
            imageElement.attr('src') ||
            null;

          const absoluteImage =
            image
              ? this.absoluteUrl(image)
              : null;

          const key =
            absoluteHref;

          if (seen.has(key)) {
            return;
          }

          seen.add(key);

          results.push({
            id:
              this.getIdFromUrl(
                absoluteHref,
                String(index)
              ),

            title,

            url:
              absoluteHref,

            image:
              absoluteImage,

            type:
              item
                .find('.type')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim() ||

              item
                .find('.fdi-item')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim() ||

              null,

            year:
              item
                .find('.year')
                .first()
                .text()
                .replace(/\s+/g, ' ')
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
