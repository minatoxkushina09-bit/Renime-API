/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers.
 *
 * Verified AnimeLok behavior:
 * Anime page:
 *   https://animelok.live/anime/{animeId}
 *
 * Episode URL:
 *   https://animelok.live/watch/{animeId}?ep={episode}
 *
 * AnimeLok may expose episode counts like:
 *   HIN - 24
 *   TAM - 24
 *   TEL - 24
 *
 * Or in compact text:
 *   HIN - 24TAM - 24TEL - 24ENG - 24JAP - 24
 */

const { SiteExtractor } = require('./site.extractor');

class EpisodesExtractor extends SiteExtractor {
  constructor(provider = 'animesky') {
    super(provider);
  }

  /**
   * Extract an episode number from text.
   *
   * @param {string} text
   * @returns {string}
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
        return match[1];
      }
    }

    return '';
  }

  /**
   * Extract the last path segment from a URL.
   *
   * @param {string} url
   * @returns {string}
   */
  getEpisodeId(url = '') {
    try {
      const absoluteUrl = this.absoluteUrl(url);

      if (!absoluteUrl) {
        return '';
      }

      const parsedUrl = new URL(absoluteUrl);

      const parts = parsedUrl.pathname
        .split('/')
        .filter(Boolean);

      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  }

  /**
   * Determine whether a URL should be ignored.
   *
   * @param {string} url
   * @returns {boolean}
   */
  isInvalidUrl(url = '') {
    const value = String(url)
      .trim()
      .toLowerCase();

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
   * Add an episode while preventing duplicates.
   *
   * @param {Array} episodes
   * @param {Set} seen
   * @param {Object} data
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
    const key = `${episode}:${data.url}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    episodes.push({
      id: data.id || this.getEpisodeId(data.url),
      episode,
      title: data.title || `Episode ${episode}`,
      url: data.url,
      image: data.image || null
    });
  }

  /**
   * Extract AnimeLok episode count.
   *
   * Important:
   * Do NOT require a word boundary after the number.
   *
   * AnimeLok can return:
   *   HIN - 24TAM - 24
   *
   * Therefore "24" is immediately followed by "TAM".
   *
   * @param {Function} $
   * @returns {number}
   */
  getAnimeLokEpisodeCount($) {
    const pageText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    if (!pageText) {
      return 0;
    }

    const candidates = [];

    /*
     * Language count examples:
     *
     * HIN - 24
     * TAM - 24
     * TEL - 24
     * ENG - 24
     * JAP - 24
     *
     * Compact version:
     *
     * HIN - 24TAM - 24TEL - 24
     */
    const languagePattern =
      /(?:HIN|TAM|TEL|ENG|JAP|MAL|BEN|KAN|HINDI|TAMIL|TELUGU|ENGLISH|JAPANESE|MALAYALAM|BENGALI|KANNADA)\s*[-:|]?\s*(\d{1,4})/gi;

    let match;

    while ((match = languagePattern.exec(pageText)) !== null) {
      const count = Number.parseInt(match[1], 10);

      if (
        Number.isFinite(count) &&
        count > 0 &&
        count <= 2000
      ) {
        candidates.push(count);
      }
    }

    /*
     * Generic episode count formats.
     */
    const genericPatterns = [
      /\b(\d{1,4})\s*EPS?\b/gi,
      /\b(\d{1,4})\s*EPISODES?\b/gi,
      /\bEPISODES?\s*[:\-]?\s*(\d{1,4})\b/gi
    ];

    for (const pattern of genericPatterns) {
      while ((match = pattern.exec(pageText)) !== null) {
        const count = Number.parseInt(match[1], 10);

        if (
          Number.isFinite(count) &&
          count > 0 &&
          count <= 2000
        ) {
          candidates.push(count);
        }
      }
    }

    /*
     * Check common HTML attributes.
     */
    const attributes = [
      'data-episodes',
      'data-episode-count',
      'data-total-episodes'
    ];

    for (const attribute of attributes) {
      $(`[${attribute}]`).each((_, element) => {
        const value = $(element).attr(attribute);
        const count = Number.parseInt(value, 10);

        if (
          Number.isFinite(count) &&
          count > 0 &&
          count <= 2000
        ) {
          candidates.push(count);
        }
      });
    }

    console.log(
      'ANIMELOK EPISODE CANDIDATES:',
      candidates
    );

    if (candidates.length === 0) {
      return 0;
    }

    /*
     * Select the most frequently occurring count.
     *
     * AnimeLok usually repeats the same count
     * for every available language.
     */
    const frequency = new Map();

    for (const count of candidates) {
      frequency.set(
        count,
        (frequency.get(count) || 0) + 1
      );
    }

    let bestCount = 0;
    let bestFrequency = 0;

    for (const [count, occurrences] of frequency.entries()) {
      if (
        occurrences > bestFrequency ||
        (
          occurrences === bestFrequency &&
          count > bestCount
        )
      ) {
        bestCount = count;
        bestFrequency = occurrences;
      }
    }

    console.log(
      'ANIMELOK DETECTED EPISODE COUNT:',
      bestCount
    );

    return bestCount;
  }

  /**
   * Generate verified AnimeLok episode URLs.
   *
   * @param {string} id
   * @param {number} episodeCount
   * @returns {Array}
   */
  createAnimeLokEpisodes(id, episodeCount) {
    const episodes = [];
    const seen = new Set();

    const count = Math.min(
      Math.max(
        Number.parseInt(episodeCount, 10) || 0,
        0
      ),
      2000
    );

    for (let episode = 1; episode <= count; episode++) {
      const url =
        `https://animelok.live/watch/` +
        `${encodeURIComponent(id)}?ep=${episode}`;

      this.addEpisode(episodes, seen, {
        id: `${id}-${episode}`,
        episode,
        title: `Episode ${episode}`,
        url,
        image: null
      });
    }

    return episodes;
  }

  /**
   * Extract AnimeLok episodes.
   *
   * @param {string} id
   * @param {number} season
   * @returns {Promise<Object>}
   */
  async extractAnimeLokEpisodes(id, season = 1) {
    const encodedId = encodeURIComponent(id);

    const paths = [
      `/anime/${encodedId}`,
      `/anime/${encodedId}/`
    ];

    let lastError = null;

    for (const path of paths) {
      try {
        console.log(`TRYING ANIMELOK: ${path}`);

        const { $, html } = await this.page(path);

        if (!html || html.length < 50) {
          continue;
        }

        const episodeCount =
          this.getAnimeLokEpisodeCount($);

        if (episodeCount < 1) {
          console.log(
            'NO ANIMELOK EPISODE COUNT FOUND'
          );

          continue;
        }

        const episodes =
          this.createAnimeLokEpisodes(
            id,
            episodeCount
          );

        if (episodes.length > 0) {
          return {
            postId: String(id),
            season,
            episodes
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
   * Extract episodes from normal HTML.
   *
   * @param {Function} $
   * @returns {Array}
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
            item.find('.episode-number').first().text() ||
            item.find('.episode-title').first().text() ||
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

          const url = this.absoluteUrl(href);

          if (!url) {
            return;
          }

          this.addEpisode(episodes, seen, {
            id: this.getEpisodeId(url),
            episode: episodeNumber,
            title:
              cleanText ||
              `Episode ${episodeNumber}`,
            url,
            image: null
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
   * Extract numbered episode links.
   *
   * @param {Function} $
   * @returns {Array}
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

        const url = this.absoluteUrl(href);

        if (!url) {
          return;
        }

        this.addEpisode(episodes, seen, {
          id: this.getEpisodeId(url),
          episode: episodeNumber,
          title:
            text ||
            `Episode ${episodeNumber}`,
          url,
          image: null
        });
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
   * Extract episode objects embedded in scripts.
   *
   * @param {Function} $
   * @returns {Array}
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

          while ((match = pattern.exec(content)) !== null) {
            const episodeNumber =
              index === 0
                ? match[1]
                : match[2];

            const rawUrl =
              index === 0
                ? match[2]
                : match[1];

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

            this.addEpisode(episodes, seen, {
              id: this.getEpisodeId(url),
              episode: episodeNumber,
              title: `Episode ${episodeNumber}`,
              url,
              image: null
            });
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
   * Extract AnimeSky episodes.
   *
   * @param {string} id
   * @param {number} season
   * @returns {Promise<Object>}
   */
  async extractAnimeSkyEpisodes(id, season = 1) {
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
        console.log(`TRYING ANIMESKY: ${path}`);

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
              Number.parseFloat(a.episode) -
              Number.parseFloat(b.episode)
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
          `AnimeSky request failed: ${path}`,
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
   * Main extraction method.
   *
   * @param {string} id
   * @param {number} season
   * @returns {Promise<Object>}
   */
  async extractFromAnimePage(id, season = 1) {
    const providerId = String(
      this.base?.providerId ||
      this.providerId ||
      this.provider ||
      ''
    )
      .toLowerCase()
      .trim();

    if (providerId === 'animelok') {
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
   *
   * @param {string} id
   * @param {number} season
   * @returns {Promise<Object>}
   */
  async extractFromAjax(id, season = 1) {
    return this.extractFromAnimePage(
      id,
      season
    );
  }
}

module.exports = {
  EpisodesExtractor
};
