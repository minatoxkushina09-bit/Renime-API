/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers
 *
 * Important:
 * This extractor only returns episode URLs that are actually
 * present in the provider response. It does NOT fabricate
 * /watch/{animeId} URLs as fake Episode 1 results.
 */

const { SiteExtractor } = require('./site.extractor');

class EpisodesExtractor extends SiteExtractor {
  constructor(provider = 'animesky') {
    super(provider);
  }

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

  isEpisodeUrl(url = '') {
    const value = String(url)
      .toLowerCase()
      .trim();

    return (
      value.includes('/episode/') ||
      value.includes('/episodes/') ||
      value.includes('/ep/') ||
      /episode[-_/]?\d+/i.test(value) ||
      /ep[-_/]?\d+/i.test(value) ||
      /s\d+e\d+/i.test(value)
    );
  }

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
      id: data.id || this.getEpisodeId(data.url),
      episode,
      title: data.title || `Episode ${episode}`,
      url: data.url,
      image: data.image || null
    });
  }

  /**
   * Try extracting episode count from visible page text.
   *
   * Examples:
   * "Naruto 220 EPS"
   * "220 EPS"
   */
  extractEpisodeCount($) {
    const text = $.root()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /\b(\d+)\s*EPS\b/i,
      /\b(\d+)\s*EPISODES?\b/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        const count = parseInt(match[1], 10);

        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }

    return null;
  }

  /**
   * Extract episodes from elements that explicitly contain
   * episode information.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '[data-episode]',
      '[data-episode-number]',
      '.episode-item',
      '.episode',
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

          if (!anchor.length) {
            return;
          }

          const href =
            anchor.attr('href') ||
            item.attr('data-url') ||
            '';

          if (
            this.isInvalidUrl(href)
          ) {
            return;
          }

          const text = (
            item.attr('data-episode') ||
            item.attr('data-episode-number') ||
            item.find('.episode-number').first().text() ||
            item.find('.episode-title').first().text() ||
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

          const url = this.absoluteUrl(href);

          if (!url) {
            return;
          }

          this.addEpisode(
            episodes,
            seen,
            {
              id: this.getEpisodeId(url),
              episode: episodeNumber,
              title: text || `Episode ${episodeNumber}`,
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
   * Extract links that clearly look like episode links.
   */
  extractFallbackEpisodes($) {
    const episodes = [];
    const seen = new Set();

    $('a').each((_, element) => {
      try {
        const anchor = $(element);

        const href =
          anchor.attr('href') || '';

        if (
          this.isInvalidUrl(href) ||
          !this.isEpisodeUrl(href)
        ) {
          return;
        }

        const text = anchor
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        let episodeNumber =
          this.getEpisodeNumber(text);

        /*
         * If the visible text does not contain the episode
         * number, try the URL.
         */
        if (!episodeNumber) {
          episodeNumber =
            this.getEpisodeNumber(href);
        }

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
          'Fallback episode extraction error:',
          error.message
        );
      }
    });

    return episodes;
  }

  /**
   * Extract episode data embedded in scripts.
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

          /["'](?:url|href|link)["']\s*:\s*["']([^"']+)["'][\s\S]{0,1000}?["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?/gi,

          /["']episodeNumber["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?[\s\S]{0,1000}?["'](?:url|href|link)["']\s*:\s*["']([^"']+)["']/gi
        ];

        patterns.forEach((pattern, index) => {
          let match;

          while (
            (match = pattern.exec(content)) !== null
          ) {
            let episodeNumber;
            let rawUrl;

            if (index === 1) {
              rawUrl = match[1];
              episodeNumber = match[2];
            } else {
              episodeNumber = match[1];
              rawUrl = match[2];
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

  async extractFromAnimePage(id, season = 1) {
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
    let detectedEpisodeCount = null;

    for (const path of paths) {
      try {
        console.log(
          `TRYING ${this.base.providerId}: ${path}`
        );

        const { $, html } =
          await this.page(path);

        if (
          !html ||
          html.length < 50
        ) {
          continue;
        }

        detectedEpisodeCount =
          detectedEpisodeCount ||
          this.extractEpisodeCount($);

        console.log(
          'DETECTED EPISODE COUNT:',
          detectedEpisodeCount
        );

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
            'LINK EXTRACTION:',
            episodes.length
          );
        }

        if (episodes.length === 0) {
          episodes =
            this.extractEpisodesFromScripts($);

          console.log(
            'SCRIPT EXTRACTION:',
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
            episodeCount:
              detectedEpisodeCount ||
              episodes.length,
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

    /*
     * Important:
     * Do not fabricate Episode 1.
     */
    if (detectedEpisodeCount) {
      return {
        postId: String(id),
        season,
        episodeCount: detectedEpisodeCount,
        episodes: []
      };
    }

    throw (
      lastError ||
      new Error(
        `Could not extract episodes for anime: ${id}`
      )
    );
  }

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
