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
    const value = String(text)
      .replace(/\s+/g, ' ')
      .trim();

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
      /s(\d+)\s*e(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[2];
    }

    match = value.match(
      /(\d+)\s*x\s*(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[2];
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
   * Extract season number.
   */
  getSeasonNumber(text = '', fallback = '') {
    const value = String(text)
      .replace(/\s+/g, ' ')
      .trim();

    let match = value.match(
      /s(\d+)\s*e\d+/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /(\d+)\s*x\s*\d+/i
    );

    if (match) {
      return match[1];
    }

    match = value.match(
      /season\s*(\d+)/i
    );

    if (match) {
      return match[1];
    }

    return String(fallback || '');
  }

  /**
   * Get ID from episode URL.
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
   * Check whether an element looks like an episode.
   */
  isEpisodeElement($, element) {
    const item = $(element);

    const text = item
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const href =
      item.is('a')
        ? item.attr('href')
        : item.find('a').first().attr('href');

    if (
      /episode\s*\d+/i.test(text) ||
      /\bep\.?\s*\d+/i.test(text) ||
      /\bs\d+\s*e\d+/i.test(text) ||
      /\d+\s*x\s*\d+/i.test(text)
    ) {
      return true;
    }

    if (
      href &&
      (
        /episode/i.test(href) ||
        /watch/i.test(href)
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract episodes from loaded Cheerio page.
   */
  extractEpisodes($, season = 1) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '.episode-item',
      '.episode',
      '.episodes li',
      '.episode-list li',
      '.episodelist li',
      '.eps li',
      '.eps-item',
      '.list-episode li',
      '.aa-cnt li',
      '.listing li',
      '[class*="episode"]',
      'a[href*="episode"]',
      'a[href*="/watch/"]'
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        try {
          const item = $(element);

          if (
            !this.isEpisodeElement(
              $,
              item
            )
          ) {
            return;
          }

          const anchor = item.is('a')
            ? item
            : item.find('a').first();

          const href =
            anchor.attr('href') || '';

          const url =
            this.absoluteUrl(href);

          const text = (
            item
              .find('.episode-title')
              .first()
              .text() ||

            item
              .find('.entry-title')
              .first()
              .text() ||

            item
              .find('.title')
              .first()
              .text() ||

            item
              .find('.name')
              .first()
              .text() ||

            item
              .find('.num-epi')
              .first()
              .text() ||

            item
              .find('.episode-number')
              .first()
              .text() ||

            anchor.text() ||

            item.text()
          )
            .replace(/\s+/g, ' ')
            .trim();

          const episodeNumber =
            this.getEpisodeNumber(text);

          if (!episodeNumber) {
            return;
          }

          const imageElement =
            item.find('img').first();

          const image =
            imageElement.attr('data-src') ||
            imageElement.attr('data-lazy-src') ||
            imageElement.attr('data-original') ||
            imageElement.attr('src') ||
            null;

          const episodeId =
            this.getEpisodeId(
              url || href
            );

          const key =
            url ||
            `${episodeNumber}-${text}`;

          if (seen.has(key)) {
            return;
          }

          seen.add(key);

          episodes.push({
            id: episodeId,
            season:
              this.getSeasonNumber(
                text,
                season
              ),
            episode: episodeNumber,
            title:
              text ||
              `Episode ${episodeNumber}`,
            url,
            image:
              image
                ? this.absoluteUrl(image)
                : null
          });

        } catch (error) {
          console.error(
            'Episode extraction error:',
            error.message
          );
        }
      });

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  /**
   * Fallback extraction from all links.
   */
  extractFallbackEpisodes(
    $,
    season = 1
  ) {
    const episodes = [];
    const seen = new Set();

    $('a').each((index, element) => {
      const anchor = $(element);

      const href =
        anchor.attr('href') || '';

      const text =
        anchor
          .text()
          .replace(/\s+/g, ' ')
          .trim();

      const episodeNumber =
        this.getEpisodeNumber(text);

      const looksLikeEpisode =
        episodeNumber &&
        (
          /episode/i.test(text) ||
          /\bep\.?/i.test(text) ||
          /\bs\d+\s*e\d+/i.test(text) ||
          /\d+\s*x\s*\d+/i.test(text) ||
          /episode|watch/i.test(href)
        );

      if (!looksLikeEpisode) {
        return;
      }

      const url =
        this.absoluteUrl(href);

      if (!url || seen.has(url)) {
        return;
      }

      seen.add(url);

      episodes.push({
        id: this.getEpisodeId(url),
        season:
          this.getSeasonNumber(
            text,
            season
          ),
        episode: episodeNumber,
        title:
          text ||
          `Episode ${episodeNumber}`,
        url,
        image: null
      });
    });

    return episodes;
  }

  /**
   * Fetch anime page and extract episodes.
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    let paths = [];

    if (
      this.base.providerId ===
      'animelok'
    ) {
      paths = [
        `/anime/${encodedId}`,
        `/anime/${encodedId}/`,
        `/series/${encodedId}`,
        `/series/${encodedId}/`
      ];
    } else {
      paths = [
        `/anime/${encodedId}`,
        `/anime/${encodedId}/`,
        `/series/${encodedId}`,
        `/series/${encodedId}/`,
        `/movies/${encodedId}`,
        `/movies/${encodedId}/`
      ];
    }

    let lastError = null;

    for (const path of paths) {
      try {
        console.log(
          'FETCHING EPISODES:',
          `${this.base.baseUrl}${path}`
        );

        const {
          $,
          html
        } = await this.page(path);

        if (
          !html ||
          html.length < 100
        ) {
          continue;
        }

        let episodes =
          this.extractEpisodes(
            $,
            season
          );

        /*
         * Try fallback extraction.
         */
        if (episodes.length === 0) {
          episodes =
            this.extractFallbackEpisodes(
              $,
              season
            );
        }

        /*
         * Sort episodes numerically.
         */
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
        `No episodes found for anime: ${id}`
      )
    );
  }

  /**
   * Controller compatibility method.
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
