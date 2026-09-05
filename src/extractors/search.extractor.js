const { SiteExtractor } = require('./site.extractor');

class SearchExtractor extends SiteExtractor {
  async search(query) {
    return {
      path: this.base.provider === 'animelok'
        ? `/search/${encodeURIComponent(query)}`
        : `/search?query=${encodeURIComponent(query)}`
    };
  }

  async searchFullPage(query) {
    return this.search(query);
  }
}

module.exports = { SearchExtractor };           
