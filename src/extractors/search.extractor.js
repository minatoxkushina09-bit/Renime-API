const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    const searchPath =
      this.base.providerId === 'animelok'
        ? `/search?keyword=${encodeURIComponent(query)}`
        : `/?s=${encodeURIComponent(query)}`;

    const { $ } = await this.page(searchPath);

    const selectors =
      this.base.providerId === 'animelok'
        ? 'article, .anime-item, .item, .search-item'
        : 'article, .post, .search-item, .item';

    return this.list($, selectors);
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
