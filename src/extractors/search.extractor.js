const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider = 'animesky') {
    super(provider);
  }

  /**
   * Main search method
   */
  async search(query) {
    if (!query || !String(query).trim()) {
      return {
        success: false,
        query: '',
        provider: this.base.providerId,
        results: [],
        total: 0,
        error: 'Search query is required'
      };
    }

    const cleanQuery = String(query).trim();

    if (this.base.providerId === 'animelok') {
      return this.searchAnimeLok(cleanQuery);
    }

    return this.searchAnimeSky(cleanQuery);
  }

  /**
   * AnimeLok search
   */
  async searchAnimeLok(query) {
    const encodedQuery = encodeURIComponent(query);

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

        console.error(
          'STATUS:',
          error.response?.status || null
        );
      }
    }

    return {
      success: false,
      query,
      provider: 'animelok',
      results: [],
      total: 0,
      error: lastError
        ? lastError.message
        : 'No results found'
    };
  }

  /**
   * Extract AnimeLok results
   */
  extractAnimeLokResults($) {
    const results = [];
    const seen = new Set();

    $('a[href*="/anime/"]').each(
      (_, element) => {
        try {
          const anchor = $(element);

          const href =
            anchor.attr('href') || '';

          if (
            !href ||
            href === '/' ||
            href.startsWith('#') ||
            href.startsWith('javascript:')
          ) {
            return;
          }

          const absoluteUrl =
            this.absoluteUrl(href);

          if (
            !absoluteUrl ||
            seen.has(absoluteUrl)
          ) {
            return;
          }

          const imageElement =
            anchor.find('img').first();

          const image =
            imageElement.attr('data-src') ||
            imageElement.attr('data-lazy-src') ||
            imageElement.attr('data-original') ||
            imageElement.attr('src') ||
            null;

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

          if (
            !title ||
            title.length < 2
          ) {
            return;
          }

          /*
           * Extract a clean anime ID.
           *
           * Example:
           * https://animelok.live/anime/727986?2717
           *
           * Result:
           * 727986
           */
          let id = '';

          try {
            const parsed =
              new URL(absoluteUrl);

            const parts =
              parsed.pathname
                .split('/')
                .filter(Boolean);

            const animeIndex =
              parts.findIndex(
                part =>
                  part.toLowerCase() ===
                  'anime'
              );

            if (
              animeIndex !== -1 &&
              parts[animeIndex + 1]
            ) {
              id =
                parts[animeIndex + 1];
            }
          } catch (error) {
            console.error(
              'AnimeLok ID extraction error:',
              error.message
            );

            return;
          }

          if (!id) {
            return;
          }

          seen.add(absoluteUrl);

          results.push({
            id,
            title: title.trim(),
            url: absoluteUrl,
            image: image
              ? this.absoluteUrl(image)
              : null,
            type: null,
            year: null
          });

        } catch (error) {
          console.error(
            'AnimeLok result extraction error:',
            error.message
          );
        }
      }
    );

    return results;
  }

  /**
   * AnimeSky search
   */
  async searchAnimeSky(query) {
    const encodedQuery =
      encodeURIComponent(query);

    const paths = [
      `/search?query=${encodedQuery}`,
      `/search?q=${encodedQuery}`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        const { $ } =
          await this.page(path);

        let results = [];

        const selectors = [
          '.flw-item',
          '.film_list-wrap .flw-item',
          '.anime-item',
          '.anime-card',
          '.search-item'
        ];

        for (const selector of selectors) {
          results =
            this.list($, selector);

          if (results.length > 0) {
            break;
          }
        }

        /*
         * Fallback: look directly
         * for anime links.
         */
        if (results.length === 0) {
          results =
            this.extractGenericAnimeLinks($);
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
      success: false,
      query,
      provider: 'animesky',
      results: [],
      total: 0,
      error: lastError
        ? lastError.message
        : 'No results found'
    };
  }

  /**
   * Generic fallback extractor
   */
  extractGenericAnimeLinks($) {
    const results = [];
    const seen = new Set();

    $('a').each((index, element) => {
      try {
        const anchor = $(element);

        const href =
          anchor.attr('href') || '';

        if (!href) {
          return;
        }

        const text =
          anchor
            .text()
            .replace(/\s+/g, ' ')
            .trim();

        const imageElement =
          anchor.find('img').first();

        const title =
          imageElement.attr('alt') ||
          anchor.attr('title') ||
          text;

        if (
          !title ||
          title.length < 2
        ) {
          return;
        }

        const image =
          imageElement.attr('data-src') ||
          imageElement.attr('data-lazy-src') ||
          imageElement.attr('src') ||
          null;

        const url =
          this.absoluteUrl(href);

        if (
          !url ||
          seen.has(url)
        ) {
          return;
        }

        /*
         * Only keep links that
         * look like anime pages.
         */
        if (
          !/anime|series|movie/i.test(
            href
          )
        ) {
          return;
        }

        seen.add(url);

        const id =
          href
            .replace(
              /^https?:\/\/[^/]+/i,
              ''
            )
            .replace(
              /^\/+|\/+$/g,
              ''
            );

        results.push({
          id: id || String(index),
          title: title.trim(),
          url,
          image: image
            ? this.absoluteUrl(image)
            : null,
          type: null,
          year: null
        });

      } catch (error) {
        console.error(
          'Generic extraction error:',
          error.message
        );
      }
    });

    return results;
  }

  /**
   * Compatibility method
   */
  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = {
  SearchExtractor
};
