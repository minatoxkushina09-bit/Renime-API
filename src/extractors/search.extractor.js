const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);

    if (this.base.providerId === 'animelok') {
      return this.searchAnimeLok(query, encodedQuery);
    }

    return this.searchAnimeSky(query, encodedQuery);
  }

  /**
   * AnimeLok search
   */
  async searchAnimeLok(query, encodedQuery) {
    const paths = [
      `/search?keyword=${encodedQuery}`,
      `/search?q=${encodedQuery}`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        const { $ } = await this.page(path);

        const results = this.extractAnimeLokResults($);

        if (results.length > 0) {
          return {
            success: true,
            query,
            provider: 'animelok',
            results,
            total: results.length
          };
        }
      } catch (error) {
        lastError = error;

        console.error(
          `AnimeLok search failed: ${path}`,
          error.message
        );
      }
    }

    return {
      success: true,
      query,
      provider: 'animelok',
      results: [],
      total: 0,
      error: lastError ? lastError.message : null
    };
  }

  /**
   * Extract AnimeLok results
   *
   * Uses the actual anime links instead of broad
   * .item or article selectors.
   */
  extractAnimeLokResults($) {
    const results = [];
    const seen = new Set();

    const animeSelectors = [
      '.search-results a[href]',
      '.anime-list a[href]',
      '.film_list-wrap a[href]',
      '.flw-item a[href]',
      '.anime-item a[href]',
      '.anime-card a[href]'
    ];

    for (const selector of animeSelectors) {
      $(selector).each((index, element) => {
        const anchor = $(element);

        const href = anchor.attr('href');

        if (!href) {
          return;
        }

        // Ignore search/navigation links
        if (
          href === '/' ||
          href.includes('/search') ||
          href.startsWith('#') ||
          href.startsWith('javascript:')
        ) {
          return;
        }

        const parent = anchor.closest(
          '.search-item, .anime-item, .anime-card, .flw-item, .film-poster, li, article'
        );

        const container =
          parent.length > 0 ? parent : anchor;

        const title =
          anchor.attr('title') ||
          container.find('.film-name').first().text().trim() ||
          container.find('.anime-name').first().text().trim() ||
          container.find('.name').first().text().trim() ||
          container.find('.title').first().text().trim() ||
          container.find('h1, h2, h3, h4').first().text().trim() ||
          anchor.text().trim();

        if (!title || title.length < 2) {
          return;
        }

        const absoluteUrl = this.absoluteUrl(href);

        if (seen.has(absoluteUrl)) {
          return;
        }

        seen.add(absoluteUrl);

        const imageElement =
          container.find('img').first();

        const image =
          imageElement.attr('data-src') ||
          imageElement.attr('data-lazy-src') ||
          imageElement.attr('src') ||
          null;

        results.push({
          id: href
            .replace(/^https?:\/\/[^/]+/i, '')
            .replace(/^\/+|\/+$/g, ''),

          title,

          url: absoluteUrl,

          image: this.absoluteUrl(image),

          type:
            container.find('.type').first().text().trim() ||
            null,

          year:
            container.find('.year').first().text().trim() ||
            null
        });
      });

      // Stop once we found valid results
      if (results.length > 0) {
        break;
      }
    }

    return results;
  }

  /**
   * AnimeSky search
   */
  async searchAnimeSky(query, encodedQuery) {
    const paths = [
      `/search?query=${encodedQuery}`,
      `/search?q=${encodedQuery}`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        const { $ } = await this.page(path);

        const selectors = [
          '.flw-item',
          '.film_list-wrap .flw-item',
          '.anime-item',
          '.anime-card',
          '.search-item'
        ];

        let results = [];

        for (const selector of selectors) {
          results = this.list($, selector);

          if (results.length > 0) {
            break;
          }
        }

        if (results.length > 0) {
          return {
            success: true,
            query,
            provider: 'animesky',
            results,
            total: results.length
          };
        }
      } catch (error) {
        lastError = error;

        console.error(
          `AnimeSky search failed: ${path}`,
          error.message
        );
      }
    }

    return {
      success: true,
      query,
      provider: 'animesky',
      results: [],
      total: 0,
      error: lastError ? lastError.message : null
    };
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
