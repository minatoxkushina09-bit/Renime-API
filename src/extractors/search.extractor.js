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

        console.log('================================');
        console.log('ANIMELOK SEARCH');
        console.log('URL:', path);
        console.log(
          'FULL URL:',
          `${this.base.baseUrl}${path}`
        );
        console.log('HTML LENGTH:', html.length);
        console.log('QUERY:', query);

        const results =
          this.extractAnimeLokResults($);

        console.log(
          'EXTRACTED RESULTS:',
          results.length
        );

        console.log('RESULTS:', results);

        console.log('================================');

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

    console.log(
      '================================'
    );

    console.log(
      'ANIMELOK EXTRACTION START'
    );

    /*
     * AnimeLok currently uses links such as:
     *
     * /anime/727986f217
     * /anime/d621346892
     * /anime/8385dfc102cb
     *
     * Instead of depending on unstable CSS classes,
     * directly search for anime URLs.
     */

    const animeLinks = $('a[href*="/anime/"]');

    console.log(
      'TOTAL ANIME LINK ELEMENTS:',
      animeLinks.length
    );

    animeLinks.each((index, element) => {
      try {
        const anchor = $(element);

        const href = anchor.attr('href');

        if (!href) {
          return;
        }

        /*
         * Ignore invalid or unwanted links
         */
        if (
          href === '/' ||
          href.startsWith('#') ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:')
        ) {
          return;
        }

        /*
         * Make sure this is actually an anime page.
         *
         * Supports:
         *
         * /anime/abc123
         * https://animelok.live/anime/abc123
         */

        const absoluteUrl =
          this.absoluteUrl(href);

        if (!absoluteUrl) {
          return;
        }

        /*
         * Prevent duplicates
         */
        if (seen.has(absoluteUrl)) {
          return;
        }

        /*
         * Get the image.
         *
         * AnimeLok stores the anime title inside
         * the image alt attribute.
         */

        const imageElement =
          anchor.find('img').first();

        /*
         * Skip links that are not actual anime cards.
         *
         * Real anime result links contain an image.
         */

        if (!imageElement.length) {
          return;
        }

        /*
         * Extract title.
         *
         * Priority:
         *
         * 1. img alt
         * 2. anchor title
         * 3. aria-label
         * 4. text
         */

        const title =
          imageElement.attr('alt') ||
          anchor.attr('title') ||
          anchor.attr('aria-label') ||
          anchor
            .find(
              'h1, h2, h3, h4, h5, h6'
            )
            .first()
            .text()
            .trim() ||
          anchor.text().trim();

        /*
         * Skip if title is missing
         */

        if (
          !title ||
          title.length < 2
        ) {
          console.log(
            'SKIPPED LINK - NO TITLE:',
            href
          );

          return;
        }

        /*
         * Extract image.
         *
         * AnimeLok appears to use data-nimg
         * with normal src/image URLs.
         */

        const image =
          imageElement.attr('data-src') ||
          imageElement.attr('data-lazy-src') ||
          imageElement.attr('data-original') ||
          imageElement.attr('src') ||
          null;

        /*
         * Create clean ID
         *
         * Example:
         *
         * /anime/727986f217
         *
         * becomes:
         *
         * 727986f217
         */

        const id =
          href
            .replace(
              /^https?:\/\/[^/]+/i,
              ''
            )
            .replace(
              /^\/anime\//i,
              ''
            )
            .replace(
              /^\/+|\/+$/g,
              ''
            );

        /*
         * Final validation
         */

        if (!id) {
          return;
        }

        /*
         * Mark as seen only after
         * confirming it is a valid anime
         */

        seen.add(absoluteUrl);

        const result = {
          id,
          title: title.trim(),
          url: absoluteUrl,
          image: image
            ? this.absoluteUrl(image)
            : null,
          type: null,
          year: null
        };

        results.push(result);

        console.log(
          'ANIME FOUND:',
          result
        );

      } catch (error) {
        console.error(
          'ERROR EXTRACTING ANIME LINK:',
          error.message
        );
      }
    });

    console.log(
      'TOTAL EXTRACTED:',
      results.length
    );

    console.log(
      'ANIMELOK EXTRACTION END'
    );

    console.log(
      '================================'
    );

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
