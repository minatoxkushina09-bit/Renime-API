const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const path = this.base.providerId === 'animelok'
      ? `/search/${encodeURIComponent(query)}`
      : `/search?query=${encodeURIComponent(query)}`;

    const { $, html } = await this.page(path);

    const results = this.list(
      $,
      [
        '.anime-item',
        '.anime-card',
        '.film-poster',
        '.item',
        'article',
        '.search-item'
      ].join(',')
    );

    return {
      query,
      provider: this.base.providerId,
      results,
      total: results.length
    };
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
