const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);

    const paths = [
      `/search?query=${encodedQuery}`,
      `/search?q=${encodedQuery}`,
      `/?s=${encodedQuery}`,
      `/search/${encodedQuery}`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        const { $, html } = await this.page(path);

        if (!html) {
          continue;
        }

        const selectors = [
          '.flw-item',
          '.film_list-wrap .flw-item',
          '.film-poster',
          '.film-detail',
          '.anime-item',
          '.anime-card',
          '.search-item',
          '.search-result',
          '.item',
          'article'
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
            provider: this.base.providerId,
            results,
            total: results.length
          };
        }
      } catch (error) {
        lastError = error;

        if (
          error.response?.status === 404 ||
          error.response?.status === 403
        ) {
          continue;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return {
      success: true,
      query,
      provider: this.base.providerId,
      results: [],
      total: 0
    };
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
