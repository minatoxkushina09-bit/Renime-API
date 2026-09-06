/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers
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

    const patterns = [
      /episode\s*(\d+(?:\.\d+)?)/i,
      /\bep\.?\s*(\d+(?:\.\d+)?)/i,
      /s\d+\s*e(\d+(?:\.\d+)?)/i,
      /\b(\d+)\s*x\s*(\d+(?:\.\d+)?)/i,
      /^\d+(?:\.\d+)?$/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        if (match.length > 2) {
          return match[2];
        }

        return match[1] || match[0];
      }
    }

    return '';
  }

  /**
   * Get ID from URL.
   */
  getEpisodeId(url = '') {
    try {
      const absoluteUrl = this.absoluteUrl(url);

      if (!absoluteUrl) {
        return '';
      }

      const parsed = new URL(absoluteUrl);

      const parts = parsed.pathname
        .split('/')
        .filter(Boolean);

      return parts[parts.length - 1] || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Check invalid URLs.
   */
  isInvalidUrl(url = '') {
    const value = String(url)
      .toLowerCase()
      .trim();

    return (
      !value ||
      value === '#' ||
      value.startsWith('javascript:') ||
      value.startsWith('mailto:')
    );
  }

  /**
   * Add episode safely.
   */
  addEpisode(episodes, seen, data) {
    if (
      !data ||
      !data.url ||
      data.episode === undefined ||
      data.episode === null ||
      data.episode === ''
    ) {
      return;
    }

    const episode = String(data.episode);

    const key = `${episode}-${data.url}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    episodes.push({
      id:
        data.id ||
        this.getEpisodeId(data.url),

      episode,

      title:
        data.title ||
        `Episode ${episode}`,

      url: data.url,

      image:
        data.image || null
    });
  }

  /**
   * Extract episodes from common HTML structures.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '.episode-item',
      '.episode-list li',
      '.episodes li',
      '.episodelist li',
      '.eps-item',
      '.eps li',
      '.list-episode li',
      '[class*="episode"]'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        try {
          const item = $(element);

          const anchor =
            item.is('a')
              ? item
              : item.find('a').first();

          if (!anchor.length) {
            return;
          }

          const href =
            anchor.attr('href') || '';

          if (this.isInvalidUrl(href)) {
            return;
          }

          const text = (
            item.find('.episode-number')
              .first()
              .text() ||

            item.find('.episode-title')
              .first()
              .text() ||

            item.find('.title')
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

          const url =
            this.absoluteUrl(href);

          if (!url) {
            return;
          }

          this.addEpisode(
            episodes,
            seen,
            {
              id:
                this.getEpisodeId(url),

              episode:
                episodeNumber,

              title:
                text || `Episode ${episodeNumber}`,

              url,

              image: null
            }
          );
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
   * Search all links for numbered episodes.
   */
  extractFallbackEpisodes($) {
    const episodes = [];
    const seen = new Set();

    $('a').each((_, element) => {
      try {
        const anchor = $(element);

        const href =
          anchor.attr('href') || '';

        if (this.isInvalidUrl(href)) {
          return;
        }

        const text =
          anchor
            .text()
            .replace(/\s+/g, ' ')
            .trim();

        const episodeNumber =
          this.getEpisodeNumber(text);

        if (!episodeNumber) {
          return;
        }

        const url =
          this.absoluteUrl(href);

        if (!url) {
          return;
        }

        this.addEpisode(
          episodes,
          seen,
          {
            id:
              this.getEpisodeId(url),

            episode:
              episodeNumber,

            title:
              text || `Episode ${episodeNumber}`,

            url,

            image: null
          }
        );
      } catch (error) {
        console.error(
          'Fallback extraction error:',
          error.message
        );
      }
    });

    return episodes;
  }

  /**
   * AnimeLok fallback.
   *
   * AnimeLok may expose a generic watch URL
   * instead of individual episode links in
   * server-rendered HTML.
   */
  createAnimeLokFallback(id) {
    return [
      {
        id: String(id),

        episode: '1',

        title: 'Episode 1',

        url:
          `${this.base.baseUrl}/watch/${encodeURIComponent(id)}`,

        image: null
      }
    ];
  }

  /**
   * Extract episodes from anime page.
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    const paths =
      this.base.providerId === 'animelok'
        ? [
            `/anime/${encodedId}`,
            `/anime/${encodedId}/`
          ]
        : [
            `/anime/${encodedId}`,
            `/anime/${encodedId}/`,
            `/series/${encodedId}`,
            `/series/${encodedId}/`
          ];

    let lastError = null;

    for (const path of paths) {
      try {
        console.log(
          `TRYING ${this.base.providerId}: ${path}`
        );

        const { $ } =
          await this.page(path);

        let episodes =
          this.extractEpisodes($);

        console.log(
          'NORMAL EXTRACTION:',
          episodes.length
        );

        if (episodes.length === 0) {
          episodes =
            this.extractFallbackEpisodes($);

          console.log(
            'FALLBACK EXTRACTION:',
            episodes.length
          );
        }

        if (episodes.length > 0) {
          episodes.sort(
            (a, b) =>
              parseFloat(a.episode) -
              parseFloat(b.episode)
          );

          return {
            postId: String(id),
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

    /**
     * IMPORTANT:
     * Do not fail AnimeLok completely.
     * Return its working watch URL as Episode 1.
     */
    if (
      this.base.providerId === 'animelok'
    ) {
      console.log(
        'Using AnimeLok watch fallback'
      );

      return {
        postId: String(id),
        season,
        episodes:
          this.createAnimeLokFallback(id)
      };
    }

    throw (
      lastError ||
      new Error(
        `Could not extract episodes for anime: ${id}`
      )
    );
  }

  /**
   * Compatibility method.
   */
  async extractFromAjax(
    id,
    season = 1
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
