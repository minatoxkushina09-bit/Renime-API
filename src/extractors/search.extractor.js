const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);

    let paths = [];
    let selectors = [];

    if (this.base.providerId === 'animelok') {
      paths = [
        `/search?keyword=${encodedQuery}`,
        `/search?q=${encodedQuery}`,
        `/?s=${encodedQuery}`
      ];

      selectors = [
        '.search-item',
        '.anime-item',
        '.anime-card',
        '.film_list-wrap .flw-item',
        '.flw-item',
        '.film-poster',
        '.item',
        'article'
      ];
    } else {
      paths = [
        `/search?query=${encodedQuery}`,
        `/search?q=${encodedQuery}`,
        `/?s=${encodedQuery}`
      ];

      selectors = [
        '.flw-item',
        '.film_list-wrap .flw-item',
        '.film-poster',
        '.anime-item',
        '.anime-card',
        '.search-item',
        '.search-result',
        '.item',
        'article'
      ];
    }

    let lastError = null;

    for (const path of paths) {
      try {
        const { $ } = await this.page(path);

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
            provider: this.base.providerId,
            results,
            total: results.length
          };
        }
      } catch (error) {
        lastError = error;

        console.error(
          `Search failed for ${this.base.providerId}: ${path}`,
          error.message
        );
      }
    }

    return {
      success: true,
      query,
      provider: this.base.providerId,
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
