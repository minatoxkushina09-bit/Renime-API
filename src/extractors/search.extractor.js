const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  /**
   * Main search method
   */
  async search(query) {
    const cleanQuery = String(query || '').trim();
    const encodedQuery = encodeURIComponent(cleanQuery);

    if (!cleanQuery) {
      return {
        success: false,
        query: cleanQuery,
        provider: this.base.providerId,
        results: [],
        total: 0,
        error: 'Search query is required'
      };
    }

    if (this.base.providerId === 'animelok') {
      return this.searchAnimeLok(cleanQuery, encodedQuery);
    }

    return this.searchAnimeSky(cleanQuery, encodedQuery);
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
        console.log('ANIMELOK SEARCH DEBUG');
        console.log('================================');
        console.log('PROVIDER: animelok');
        console.log('URL:', path);
        console.log(
          'FULL URL:',
          `${this.base.baseUrl}${path}`
        );
        console.log('HTML LENGTH:', html.length);

        const lowerHtml = html.toLowerCase();
        const queryIndex = lowerHtml.indexOf(
          query.toLowerCase()
        );

        console.log('QUERY:', query);
        console.log('QUERY INDEX:', queryIndex);

        if (queryIndex !== -1) {
          console.log('QUERY CONTEXT START');

          console.log(
            html.substring(
              Math.max(0, queryIndex - 500),
              queryIndex + 1500
            )
          );

          console.log('QUERY CONTEXT END');
        }

        const results =
          this.extractAnimeLokResults($);

        console.log(
          'EXTRACTED RESULTS:',
          results.length
        );

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
   *
   * This temporarily scans all links so we can
   * discover AnimeLok's real URL structure.
   */
  extractAnimeLokResults($) {
    console.log('================================');
    console.log('ANIMELOK LINK DEBUG START');
    console.log('================================');

    const links = [];

    $('a[href]').each((index, element) => {
      const anchor = $(element);

      const href = anchor.attr('href');

      if (!href) {
        return;
      }

      if (
        href === '/' ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.includes('/search')
      ) {
        return;
      }

      const text =
        anchor.text().replace(/\s+/g, ' ').trim();

      const image = anchor.find('img').first();

      const imageAlt =
        image.attr('alt') ||
        null;

      const title =
        anchor.attr('title') ||
        imageAlt ||
        text ||
        null;

      const parentHtml =
        anchor
          .parent()
          .html()
          ?.substring(0, 500)
          .replace(/\s+/g, ' ') ||
        null;

      links.push({
        index,
        href,
        absoluteUrl: this.absoluteUrl(href),
        title,
        text: text.substring(0, 150),
        parentHtml
      });
    });

    console.log(
      'TOTAL VALID LINKS:',
      links.length
    );

    /**
     * Look for common anime URL patterns.
     */
    const possibleAnimeLinks =
      links.filter((link) => {
        const href =
          String(link.href).toLowerCase();

        return (
          href.includes('/anime') ||
          href.includes('/watch') ||
          href.includes('/detail') ||
          href.includes('/episode') ||
          href.includes('/title') ||
          href.includes('/tv/') ||
          href.includes('/movie/') ||
          href.includes('/series/') ||
          href.includes('/show/')
        );
      });

    console.log(
      'POSSIBLE ANIME LINKS COUNT:',
      possibleAnimeLinks.length
    );

    console.log(
      'POSSIBLE ANIME LINKS START'
    );

    console.log(
      JSON.stringify(
        possibleAnimeLinks.slice(0, 50),
        null,
        2
      )
    );

    console.log(
      'POSSIBLE ANIME LINKS END'
    );

    /**
     * If AnimeLok uses a completely different URL
     * structure, these first links will reveal it.
     */
    console.log(
      'FIRST 50 LINKS START'
    );

    console.log(
      JSON.stringify(
        links.slice(0, 50),
        null,
        2
      )
    );

    console.log(
      'FIRST 50 LINKS END'
    );

    /**
     * Also inspect elements containing the search
     * query result style structures.
     */
    const possibleContainers = [];

    $(
      'article, li, [class*="anime"], [class*="film"], [class*="card"], [class*="item"]'
    ).each((index, element) => {
      if (possibleContainers.length >= 30) {
        return false;
      }

      const item = $(element);

      const anchor = item.find('a[href]').first();

      if (!anchor.length) {
        return;
      }

      const href =
        anchor.attr('href');

      const text =
        item.text()
          .replace(/\s+/g, ' ')
          .trim();

      if (!text || text.length < 2) {
        return;
      }

      possibleContainers.push({
        index,
        tag: element.tagName,
        class: item.attr('class') || null,
        href,
        text: text.substring(0, 200),
        html: $.html(item)
          .substring(0, 600)
          .replace(/\s+/g, ' ')
      });
    });

    console.log(
      'POSSIBLE CONTAINERS START'
    );

    console.log(
      JSON.stringify(
        possibleContainers,
        null,
        2
      )
    );

    console.log(
      'POSSIBLE CONTAINERS END'
    );

    console.log('================================');
    console.log('ANIMELOK LINK DEBUG END');
    console.log('================================');

    /*
     * Temporary return.
     *
     * We will replace this with the exact extraction
     * logic once the logs reveal AnimeLok's real
     * result URLs/classes.
     */
    return [];
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
   * Compatibility method
   */
  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = {
  SearchExtractor
};
