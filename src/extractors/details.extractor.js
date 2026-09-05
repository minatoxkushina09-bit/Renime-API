const { SiteExtractor } = require('./site.extractor');

class DetailsExtractor extends SiteExtractor {
  async getDetails(id) {
    const { $ } = await this.page(
      '/anime/' + encodeURIComponent(id)
    );

    const title =
      $('h1').first().text().trim() ||
      $('title')
        .text()
        .replace(/\s*[-|].*$/, '')
        .trim();

    const desc =
      $('p')
        .filter((_, e) =>
          $(e).text().trim().length > 80
        )
        .first()
        .text()
        .trim();

    // Fixed: removed this.absolute()
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('img').first().attr('src') ||
      '';

    const text = $('body')
      .text()
      .replace(/\s+/g, ' ');

    const languages = [];

    $('a, button, span').each((_, e) => {
      const t = $(e).text().trim();

      if (
        /^(Hindi|Telugu|Tamil|Malayalam|Bengali|English|Japanese)$/i.test(t) &&
        !languages.includes(t)
      ) {
        languages.push(t);
      }
    });

    return {
      provider: this.base.providerId,
      id,
      title,
      image,
      description: desc,
      languages,
      rawMeta: {
        aired: '',
        status: ''
      }
    };
  }
}

module.exports = {
  DetailsExtractor
};
