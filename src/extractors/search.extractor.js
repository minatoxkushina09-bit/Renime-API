const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);

    let paths;

    if (this.base.providerId === 'animelok') {
      // Animelok uses ?keyword=
      paths = [
        `/search?keyword=${encodedQuery}`
      ];
    } else {
      // AnimeSky
      paths = [
        `/search?query=${encodedQuery}`,
        `/search?q=${encodedQuery}`
      ];
    }

    let lastError = null;

    for (const path of paths) {
      try {
        const { $ } = await this.page(path);

        const selectors = [
          '.flw-item',
          '.film_list-wrap .flw-item',
          '.film-poster',
          '.anime-item',
          '.anime-card',
          '.search-item',
          '.search-result',
          'article',
          '.item'
        ];

        let results = [];

        for (const selector of selectors) {
          results = this.list($, selector);

          if (results.length > 0) {
            break;
          }
        }

        return {
          success: true,
          query,
          provider: this.base.providerId,
          results,
          total: results.length
        };
      } catch (error) {
        lastError = error;

        if (
          error.response?.status === 404 ||
          error.response?.status === 403
        ) {
          continue;
        }

        throw error;
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
