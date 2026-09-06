/**
 * Episodes Extractor
 * Compatible with SiteExtractor providers
 */

const { SiteExtractor } = require('./site.extractor');

class EpisodesExtractor extends SiteExtractor {
  constructor(provider = 'animesky') {
    super(provider);
  }

  /**
   * Extract episode number from text.
   */
  getEpisodeNumber(text = '') {
    const value = String(text).trim();

    let match = value.match(
      /episode\s*(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /\bep\.?\s*(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /s\d+\s*e(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /\d+\s*x\s*(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /^\s*(\d+(?:\.\d+)?)\s*$/
    );

    if (match) {
      return match[1];
    }

    return '';
  }

  /**
   * Extract episode ID from URL.
   */
  getEpisodeId(url = '') {
    if (!url) {
      return '';
    }

    try {
      const parsed = new URL(
        this.absoluteUrl(url)
      );

      const parts = parsed.pathname
        .split('/')
        .filter(Boolean);

      return parts[parts.length - 1] || '';
    } catch (error) {
      const parts = String(url)
        .split('/')
        .filter(Boolean);

      return parts[parts.length - 1] || '';
    }
  }

  /**
   * Check if an element probably represents an episode.
   */
  isEpisodeElement($, element) {
    const text = $(element)
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const href =
      $(element).attr('href') ||
      $(element).find('a').first().attr('href') ||
      '';

    if (
      /episode/i.test(text) ||
      /\bep\.?\s*\d+/i.test(text) ||
      /\bs\d+\s*e\d+/i.test(text) ||
      /\d+\s*x\s*\d+/i.test(text)
    ) {
      return true;
    }

    if (/episode|watch/i.test(href)) {
      return true;
    }

    return false;
  }

  /**
   * Extract all possible episodes from anime page.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '.episode',
      '.episodes li',
      '.episode-list li',
      '.episode-item',
      '.eps li',
      '.eps-item',
      '.list-episode li',
      '.server-item',
      '[class*="episode"]',
      'a[href*="episode"]',
      'a[href*="/watch/"]'
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        const item = $(element);

        if (!this.isEpisodeElement($, item)) {
          return;
        }

        const anchor = item.is('a')
          ? item
          : item.find('a').first();

        const href = anchor.attr('href') || '';

        const absoluteUrl =
          this.absoluteUrl(href);

        const text = (
          item.find('.episode-title')
            .first()
            .text() ||

          item.find('.entry-title')
            .first()
            .text() ||

          item.find('.title')
            .first()
            .text() ||

          item.find('.name')
            .first()
            .text() ||

          anchor.text() ||

          item.text()
        )
          .replace(/\s+/g, ' ')
          .trim();

        const episodeNumber =
          this.getEpisodeNumber(text);

        const image =
          item.find('img')
            .first()
            .attr('data-src') ||

          item.find('img')
            .first()
            .attr('data-lazy-src') ||

          item.find('img')
            .first()
            .attr('src') ||

          null;

        const episodeId =
          this.getEpisodeId(
            absoluteUrl || href
          );

        const key =
          absoluteUrl ||
          `${episodeNumber}-${text}`;

        if (
          !seen.has(key) &&
          (
            episodeNumber ||
            /episode|ep\.?/i.test(text)
          )
        ) {
          seen.add(key);

          episodes.push({
            id: episodeId,
            episode: episodeNumber || '',
            title:
              text ||
              `Episode ${episodeNumber}`,
            url: absoluteUrl,
            image: image
              ? this.absoluteUrl(image)
              : null
          });
        }
      });

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  /**
   * Get episodes directly from anime page.
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    let paths = [];

    if (this.base.providerId === 'animelok') {
      paths = [
        `/anime/${encodedId}`,
        `/anime/${encodedId}/`
      ];
    } else {
      paths = [
        `/anime/${encodedId}`,
        `/anime/${encodedId}/`,
        `/series/${encodedId}`,
        `/series/${encodedId}/`
      ];
    }

    let lastError = null;

    for (const path of paths) {
      try {
        console.log(
          'TRYING EPISODES PAGE:',
          `${this.base.baseUrl}${path}`
        );

        const { $, html } =
          await this.page(path);

        if (!html || html.length < 100) {
          continue;
        }

        console.log(
          'EPISODES PAGE LENGTH:',
          html.length
        );

        let episodes =
          this.extractEpisodes($);

        /*
         * Fallback:
         * Search all links.
         */
        if (episodes.length === 0) {
          const fallbackEpisodes = [];
          const seen = new Set();

          $('a').each(
            (_, element) => {
              const anchor = $(element);

              const href =
                anchor.attr('href') ||
                '';

              const text =
                anchor
                  .text()
                  .replace(/\s+/g, ' ')
                  .trim();

              const isEpisode =
                /episode/i.test(text) ||
                /\bep\.?\s*\d+/i.test(text) ||
                /\bs\d+\s*e\d+/i.test(text) ||
                /\d+\s*x\s*\d+/i.test(text) ||
                /episode|watch/i.test(href);

              if (!isEpisode) {
                return;
              }

              const episodeNumber =
                this.getEpisodeNumber(text);

              if (!episodeNumber) {
                return;
              }

              const url =
                this.absoluteUrl(href);

              if (!url || seen.has(url)) {
                return;
              }

              seen.add(url);

              fallbackEpisodes.push({
                id:
                  this.getEpisodeId(url),
                episode:
                  episodeNumber,
                title:
                  text ||
                  `Episode ${episodeNumber}`,
                url,
                image: null
              });
            }
          );

          episodes = fallbackEpisodes;
        }

        episodes.sort(
          (a, b) =>
            parseFloat(a.episode) -
            parseFloat(b.episode)
        );

        if (episodes.length > 0) {
          return {
            postId: null,
            season,
            episodes
          };
        }

      } catch (error) {
        lastError = error;

        console.error(
          `Failed to fetch ${path}:`,
          error.message
        );
      }
    }

    throw (
      lastError ||
      new Error(
        `Could not extract episodes for anime: ${id}`
      )
    );
  }

  /**
   * Compatibility method used by controller.
   */
  async extractFromAjax(
    id,
    season
  ) {
    return this.extractFromAnimePage(
      id,
      season
    );
  }
}

module.exports = {
  EpisodesExtractor
};
