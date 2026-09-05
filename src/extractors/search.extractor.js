const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  /**
   * Main search method
   */
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
        const { $, html } = await this.page(path);

        // ========================================
        // TEMPORARY DEBUG INFORMATION
        // ========================================

        const lowerHtml = html.toLowerCase();
        const searchIndex = lowerHtml.indexOf(
          query.toLowerCase()
        );

        console.log('================================');
        console.log('PROVIDER: animelok');
        console.log('URL:', path);
        console.log(
          'FULL URL:',
          `${this.base.baseUrl}${path}`
        );
        console.log('HTML LENGTH:', html.length);
        console.log('QUERY:', query);
        console.log('QUERY INDEX:', searchIndex);

        if (searchIndex !== -1) {
          console.log(
            'QUERY CONTEXT START'
          );

          console.log(
            html.substring(
              Math.max(0, searchIndex - 1000),
              searchIndex + 3000
            )
          );

          console.log(
            'QUERY CONTEXT END'
          );
        } else {
          console.log(
            'QUERY NOT FOUND IN HTML'
          );
        }

        console.log('================================');

        // ========================================
        // EXTRACT RESULTS
        // ========================================

        const results =
          this.extractAnimeLokResults($);

        console.log(
          'EXTRACTED RESULTS:',
          results.length
        );

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

        console.error(
          'STATUS:',
          error.response?.status || null
        );

        console.error(
          'ERROR URL:',
          error.config?.url || null
        );
      }
    }

    return {
      success: true,
      query,
      provider: 'animelok',
      results: [],
      total: 0,
      error: lastError
        ? lastError.message
        : null
    };
  }

  /**
   * Extract AnimeLok results
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
      console.log(
        'TRYING SELECTOR:',
        selector
      );

      $(selector).each((index, element) => {
        const anchor = $(element);

        const href = anchor.attr('href');

        if (!href) {
          return;
        }

        // Ignore navigation and invalid links
        if (
          href === '/' ||
          href.includes('/search') ||
          href.startsWith('#') ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:')
        ) {
          return;
        }

        const parent = anchor.closest(
          [
            '.search-item',
            '.anime-item',
            '.anime-card',
            '.flw-item',
            '.film-poster',
            '.film_list-wrap',
            'li',
            'article'
          ].join(', ')
        );

        const container =
          parent.length > 0
            ? parent
            : anchor;

        const title =
          anchor.attr('title') ||
          container
            .find('.film-name')
            .first()
            .text()
            .trim() ||
          container
            .find('.anime-name')
            .first()
            .text()
            .trim() ||
          container
            .find('.name')
            .first()
            .text()
            .trim() ||
          container
            .find('.title')
            .first()
            .text()
            .trim() ||
          container
            .find('h1, h2, h3, h4')
            .first()
            .text()
            .trim() ||
          anchor.text().trim();

        if (!title || title.length < 2) {
          return;
        }

        const absoluteUrl =
          this.absoluteUrl(href);

        if (!absoluteUrl) {
          return;
        }

        if (seen.has(absoluteUrl)) {
          return;
        }

        seen.add(absoluteUrl);

        const imageElement =
          container.find('img').first();

        const image =
          imageElement.attr('data-src') ||
          imageElement.attr('data-lazy-src') ||
          imageElement.attr('data-original') ||
          imageElement.attr('src') ||
          null;

        const type =
          container
            .find('.type')
            .first()
            .text()
            .trim() ||
          container
            .find('.fdi-item')
            .first()
            .text()
            .trim() ||
          null;

        const year =
          container
            .find('.year')
            .first()
            .text()
            .trim() ||
          null;

        results.push({
          id: href
            .replace(
              /^https?:\/\/[^/]+/i,
              ''
            )
            .replace(
              /^\/+|\/+$/g,
              ''
            ),

          title,

          url: absoluteUrl,

          image: this.absoluteUrl(image),

          type,

          year
        });
      });

      console.log(
        `RESULTS AFTER ${selector}:`,
        results.length
      );

      // Stop after finding results
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
        const { $ } =
          await this.page(path);

        const selectors = [
          '.flw-item',
          '.film_list-wrap .flw-item',
          '.anime-item',
          '.anime-card',
          '.search-item'
        ];

        let results = [];

        for (const selector of selectors) {
          results =
            this.list($, selector);

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

        console.error(
          'STATUS:',
          error.response?.status || null
        );
      }
    }

    return {
      success: true,
      query,
      provider: 'animesky',
      results: [],
      total: 0,
      error: lastError
        ? lastError.message
        : null
    };
  }

  /**
   * Full page search compatibility method
   */
  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = {
  SearchExtractor
};
