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
      /\b\d+\s*x\s*(\d+(?:\.\d+)?)/i,
      /^(\d+(?:\.\d+)?)$/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        return match[1] || '';
      }
    }

    return '';
  }

  /**
   * Extract episode count from AnimeLok page text.
   *
   * Supports formats such as:
   * 220 Episodes
   * 220 EPS
   * Episodes: 220
   */
  getAnimeLokEpisodeCount($, html = '') {
    const pageText = [
      $('body').text(),
      html
    ].join(' ');

    const patterns = [
      /(\d+)\s*(?:episodes?|eps?)\b/i,
      /episodes?\s*[:\-]?\s*(\d+)/i,
      /eps?\s*[:\-]?\s*(\d+)/i
    ];

    let highestCount = 0;

    for (const pattern of patterns) {
      let match;

      const globalPattern = new RegExp(
        pattern.source,
        `${pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`}`
      );

      while (
        (match = globalPattern.exec(pageText)) !== null
      ) {
        const count = parseInt(match[1], 10);

        if (
          Number.isInteger(count) &&
          count > highestCount &&
          count <= 5000
        ) {
          highestCount = count;
        }
      }
    }

    return highestCount;
  }

  /**
   * Build AnimeLok episode list.
   *
   * Verified URL pattern:
   * /watch/{animeId}?ep={episodeNumber}
   */
  createAnimeLokEpisodes(id, totalEpisodes) {
    const episodes = [];
    const encodedId = encodeURIComponent(id);

    for (
      let episode = 1;
      episode <= totalEpisodes;
      episode++
    ) {
      episodes.push({
        id: `${id}-${episode}`,
        episode: String(episode),
        title: `Episode ${episode}`,
        url:
          `https://animelok.live/watch/` +
          `${encodedId}?ep=${episode}`,
        image: null
      });
    }

    return episodes;
  }

  /**
   * Extract ID from URL.
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
      value.startsWith('mailto:') ||
      value.includes('/login') ||
      value.includes('/register') ||
      value.includes('/search')
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
   * Extract episodes from HTML elements.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '[data-episode]',
      '[data-episode-number]',
      '.episode-item',
      '.episodes li',
      '.episode-list li',
      '.episodelist li',
      '.eps-item',
      '.list-episode li',
      '[class*="episode"]'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        try {
          const item = $(element);

          const anchor = item.is('a')
            ? item
            : item.find('a').first();

          const href =
            anchor.attr('href') ||
            item.attr('data-url') ||
            '';

          if (this.isInvalidUrl(href)) {
            return;
          }

          const episodeText =
            item.attr('data-episode') ||
            item.attr('data-episode-number') ||
            item.find('.episode-number')
              .first()
              .text() ||
            item.find('.episode-title')
              .first()
              .text() ||
            anchor.text() ||
            item.text();

          const cleanText = String(episodeText)
            .replace(/\s+/g, ' ')
            .trim();

          const episodeNumber =
            this.getEpisodeNumber(cleanText);

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
                cleanText ||
                `Episode ${episodeNumber}`,

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
   * Extract numbered links.
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

        const text = anchor
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
              text ||
              `Episode ${episodeNumber}`,

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
   * Extract episode objects from scripts.
   */
  extractEpisodesFromScripts($) {
    const episodes = [];
    const seen = new Set();

    $('script').each((_, element) => {
      try {
        const content =
          $(element).html() || '';

        if (!content) {
          return;
        }

        const patterns = [
          /["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?[\s\S]{0,1000}?["'](?:url|href|link)["']\s*:\s*["']([^"']+)["']/gi,

          /["'](?:url|href|link)["']\s*:\s*["']([^"']+)["'][\s\S]{0,1000}?["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?/gi
        ];

        patterns.forEach((pattern, index) => {
          let match;

          while (
            (match = pattern.exec(content)) !== null
          ) {
            let episodeNumber;
            let rawUrl;

            if (index === 0) {
              episodeNumber = match[1];
              rawUrl = match[2];
            } else {
              rawUrl = match[1];
              episodeNumber = match[2];
            }

            if (
              !episodeNumber ||
              !rawUrl ||
              this.isInvalidUrl(rawUrl)
            ) {
              continue;
            }

            const url =
              this.absoluteUrl(rawUrl);

            if (!url) {
              continue;
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
                  `Episode ${episodeNumber}`,

                url,

                image: null
              }
            );
          }
        });
      } catch (error) {
        console.error(
          'Script extraction error:',
          error.message
        );
      }
    });

    return episodes;
  }

  /**
   * Extract AnimeLok episodes.
   *
   * AnimeLok uses:
   * /watch/{animeId}?ep={episodeNumber}
   */
  async extractAnimeLokEpisodes(id, season = 1) {
    const encodedId =
      encodeURIComponent(id);

    const paths = [
      `/anime/${encodedId}`,
      `/anime/${encodedId}/`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        console.log(
          `TRYING AnimeLok: ${path}`
        );

        const { $, html } =
          await this.page(path);

        if (!html || html.length < 50) {
          continue;
        }

        /*
         * First try extracting real episode
         * links from the page.
         */
        let episodes =
          this.extractEpisodes($);

        if (episodes.length === 0) {
          episodes =
            this.extractFallbackEpisodes($);
        }

        if (episodes.length === 0) {
          episodes =
            this.extractEpisodesFromScripts($);
        }

        if (episodes.length > 1) {
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

        /*
         * If AnimeLok exposes only metadata,
         * read the total episode count and
         * generate URLs using the verified
         * ?ep={number} pattern.
         */
        const totalEpisodes =
          this.getAnimeLokEpisodeCount(
            $,
            html
          );

        console.log(
          'ANIMELOK TOTAL EPISODES:',
          totalEpisodes
        );

        if (totalEpisodes > 0) {
          return {
            postId: String(id),
            season,

            episodes:
              this.createAnimeLokEpisodes(
                id,
                totalEpisodes
              )
          };
        }
      } catch (error) {
        lastError = error;

        console.error(
          `AnimeLok request failed: ${path}`,
          error.message
        );
      }
    }

    throw (
      lastError ||
      new Error(
        `Could not extract episode count for anime: ${id}`
      )
    );
  }

  /**
   * Extract episodes from AnimeSky.
   */
  async extractAnimeSkyEpisodes(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    const paths = [
      `/anime/${encodedId}`,
      `/anime/${encodedId}/`,
      `/series/${encodedId}`,
      `/series/${encodedId}/`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        const { $, html } =
          await this.page(path);

        if (!html || html.length < 50) {
          continue;
        }

        let episodes =
          this.extractEpisodes($);

        if (episodes.length === 0) {
          episodes =
            this.extractFallbackEpisodes($);
        }

        if (episodes.length === 0) {
          episodes =
            this.extractEpisodesFromScripts($);
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
   * Main extraction method.
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    if (this.base.providerId === 'animelok') {
      return this.extractAnimeLokEpisodes(
        id,
        season
      );
    }

    return this.extractAnimeSkyEpisodes(
      id,
      season
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
