const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  constructor(provider) {
    super(provider);
  }

  async search(query) {
    return {
      path: this.base.providerId === 'animelok'
        ? `/search/${encodeURIComponent(query)}`
        : `/search?query=${encodeURIComponent(query)}`
    };
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };
