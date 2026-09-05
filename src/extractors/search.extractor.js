const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);

    let paths;

    if (this.base.providerId === 'animelok') {
      // Animelok does not use /search/naruto
      // Try query-based search routes.
      paths = [
        `/search?query=${encodedQuery}`,
        `/search?q=${encodedQuery}`
      ];
    } else {
      // AnimeSky
      paths = [
        `/search?query=${encodedQuery}`,
        `/search?q=${encodedQuery}`
      ];
    }

    let lastError;

    for (const path of paths) {
      try {
        const { $, html } = await this.page(path);

        const results = this.list(
          $,
          [
            '.anime-item',
            '.anime-card',
            '.film-poster',
            '.item',
            'article',
            '.search-item',
            '.flw-item',
            '.film_list-wrap .flw-item'
          ].join(',')
        );

        return {
          success: true,
          query,
          provider: this.base.providerId,
          results,
          total: results.length
        };
      } catch (error) {
        lastError = error;

        // If this URL returns 404, try the next search format.
        if (error.response?.status === 404) {
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Search request failed');
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
