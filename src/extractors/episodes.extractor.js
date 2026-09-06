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
   * Extract episode number from visible text only.
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
      /^\s*(\d+(?:\.\d+)?)\s*$/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        /*
         * For formats like:
         * 1x23
         * return 23, not 1
         */
        if (
          match.length > 2 &&
          pattern.toString().includes('x')
        ) {
          return match[2];
        }

        return match[1];
      }
    }

    return '';
  }

  /**
   * Get ID from URL.
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
      return '';
    }
  }

  /**
   * Check if URL looks like a specific episode.
   *
   * IMPORTANT:
   * Do not accept generic /watch/{animeId}
   * pages as episodes.
   */
  isEpisodeUrl(url = '') {
    const value = String(url).toLowerCase();

    if (!value) {
      return false;
    }

    return (
      /\/episode\/[^/]+/i.test(value) ||
      /\/episodes\/[^/]+/i.test(value) ||
      /episode[-_/]?\d+/i.test(value) ||
      /\/ep[-_/]?\d+/i.test(value) ||
      /s\d+e\d+/i.test(value)
    );
  }

  /**
   * Reject invalid or navigation URLs.
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
      value.includes('latest-episode') ||
      value.includes('all-episodes') ||
      value.includes('episode-list') ||
      value.includes('/search') ||
      value.includes('/login') ||
      value.includes('/register')
    );
  }

  /**
   * Add an episode safely.
   */
  addEpisode(episodes, seen, data) {
    if (
      !data ||
      !data.url ||
      !data.episode
    ) {
      return;
    }

    const key =
      `${data.episode}-${data.url}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    episodes.push({
      id:
        data.id ||
        this.getEpisodeId(data.url),

      episode:
        String(data.episode),

      title:
        data.title ||
        `Episode ${data.episode}`,

      url:
        data.url,

      image:
        data.image || null
    });
  }

  /**
   * Extract episodes from the HTML.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    const selectors = [
      '.episode-item',
      '.episodes li',
      '.episode-list li',
      '.episodelist li',
      '.eps-item',
      '.eps li',
      '.list-episode li',
      '[class*="episode"]'
    ];

    for (const selector of selectors) {
      $(selector).each(
        (_, element) => {
          try {
            const item =
              $(element);

            const anchor =
              item.is('a')
                ? item
                : item.find('a').first();

            if (!anchor.length) {
              return;
            }

            const href =
              anchor.attr('href') || '';

            if (
              this.isInvalidUrl(href)
            ) {
              return;
            }

            const text =
              (
                item
                  .find(
                    '.episode-title'
                  )
                  .first()
                  .text() ||

                item
                  .find(
                    '.episode-number'
                  )
                  .first()
                  .text() ||

                item
                  .find('.title')
                  .first()
                  .text() ||

                anchor.text() ||

                item.text()
              )
                .replace(/\s+/g, ' ')
                .trim();

            /*
             * Episode number MUST come
             * from visible text.
             */
            const episodeNumber =
              this.getEpisodeNumber(text);

            if (!episodeNumber) {
              return;
            }

            const absoluteUrl =
              this.absoluteUrl(href);

            if (!absoluteUrl) {
              return;
            }

            const imageElement =
              item.find('img').first();

            const image =
              imageElement.attr('data-src') ||
              imageElement.attr(
                'data-lazy-src'
              ) ||
              imageElement.attr(
                'data-original'
              ) ||
              imageElement.attr('src') ||
              null;

            this.addEpisode(
              episodes,
              seen,
              {
                id:
                  this.getEpisodeId(
                    absoluteUrl
                  ),

                episode:
                  episodeNumber,

                title:
                  text ||
                  `Episode ${episodeNumber}`,

                url:
                  absoluteUrl,

                image:
                  image
                    ? this.absoluteUrl(
                        image
                      )
                    : null
              }
            );
          } catch (error) {
            console.error(
              'Episode extraction error:',
              error.message
            );
          }
        }
      );

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  /**
   * Fallback: inspect links, but only
   * accept links with a visible episode number.
   */
  extractFallbackEpisodes($) {
    const episodes = [];
    const seen = new Set();

    $('a').each(
      (_, element) => {
        try {
          const anchor =
            $(element);

          const href =
            anchor.attr('href') || '';

          if (
            this.isInvalidUrl(href)
          ) {
            return;
          }

          const text =
            anchor
              .text()
              .replace(/\s+/g, ' ')
              .trim();

          /*
           * Never extract episode numbers
           * from generic anime IDs in URLs.
           */
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

          /*
           * Require either:
           *
           * 1. An episode-looking URL
           * OR
           * 2. A clearly numbered link
           */
          if (
            !this.isEpisodeUrl(href) &&
            !/^(\d+(?:\.\d+)?)$/i.test(
              text
            ) &&
            !/episode|ep\.?/i.test(text)
          ) {
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

              image:
                null
            }
          );
        } catch (error) {
          console.error(
            'Fallback episode error:',
            error.message
          );
        }
      }
    );

    return episodes;
  }

  /**
   * Extract episodes from JSON/script data.
   *
   * This is intentionally conservative:
   * numbers must appear in an episode field
   * or episode text, not just inside a URL.
   */
  extractEpisodesFromScripts($) {
    const episodes = [];
    const seen = new Set();

    $('script').each(
      (_, element) => {
        try {
          const content =
            $(element).html() || '';

          if (
            !content ||
            content.length < 10
          ) {
            return;
          }

          /*
           * Look for objects containing
           * an episode number and URL.
           */
          const patterns = [
            /["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?[\s\S]{0,500}?["'](?:url|link|href)["']\s*:\s*["']([^"']+)["']/gi,

            /["'](?:url|link|href)["']\s*:\s*["']([^"']+)["'][\s\S]{0,500}?["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?/gi
          ];

          for (
            let index = 0;
            index < patterns.length;
            index++
          ) {
            const pattern =
              patterns[index];

            let match;

            while (
              (
                match =
                  pattern.exec(content)
              ) !== null
            ) {
              let episodeNumber;
              let rawUrl;

              if (index === 0) {
                episodeNumber =
                  match[1];

                rawUrl =
                  match[2];
              } else {
                rawUrl =
                  match[1];

                episodeNumber =
                  match[2];
              }

              if (
                !episodeNumber ||
                !rawUrl ||
                this.isInvalidUrl(rawUrl)
              ) {
                continue;
              }

              const url =
                this.absoluteUrl(
                  rawUrl
                );

              if (!url) {
                continue;
              }

              this.addEpisode(
                episodes,
                seen,
                {
                  id:
                    this.getEpisodeId(
                      url
                    ),

                  episode:
                    episodeNumber,

                  title:
                    `Episode ${episodeNumber}`,

                  url,

                  image:
                    null
                }
              );
            }
          }
        } catch (error) {
          console.error(
            'Script extraction error:',
            error.message
          );
        }
      }
    );

    return episodes;
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

    /*
     * Provider-specific paths.
     */
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
          '================================'
        );

        console.log(
          `TRYING ${this.base.providerId} EPISODES:`
        );

        console.log(
          `${this.base.baseUrl}${path}`
        );

        const {
          $,
          html
        } =
          await this.page(path);

        if (
          !html ||
          html.length < 100
        ) {
          console.log(
            'INVALID OR EMPTY HTML'
          );

          continue;
        }

        console.log(
          'PAGE LENGTH:',
          html.length
        );

        let episodes =
          this.extractEpisodes($);

        console.log(
          'NORMAL EXTRACTION TOTAL:',
          episodes.length
        );

        if (
          episodes.length === 0
        ) {
          episodes =
            this.extractFallbackEpisodes(
              $
            );

          console.log(
            'FALLBACK EXTRACTION TOTAL:',
            episodes.length
          );
        }

        if (
          episodes.length === 0
        ) {
          episodes =
            this.extractEpisodesFromScripts(
              $
            );

          console.log(
            'SCRIPT EXTRACTION TOTAL:',
            episodes.length
          );
        }

        episodes.sort(
          (a, b) =>
            parseFloat(
              a.episode
            ) -
            parseFloat(
              b.episode
            )
        );

        console.log(
          'TOTAL REAL EPISODES:',
          episodes.length
        );

        if (
          episodes.length > 0
        ) {
          return {
            postId: id,
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
   * Compatibility method used
   * by EpisodesController.
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
