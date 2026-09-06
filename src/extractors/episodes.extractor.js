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
      /^\s*(\d+(?:\.\d+)?)\s*$/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        if (
          match.length > 2 &&
          match[2]
        ) {
          return match[2];
        }

        return match[1] || '';
      }
    }

    return '';
  }

  /**
   * Extract ID from URL.
   */
  getEpisodeId(url = '') {
    if (!url) {
      return '';
    }

    try {
      const absoluteUrl =
        this.absoluteUrl(url);

      if (!absoluteUrl) {
        return '';
      }

      const parsed =
        new URL(absoluteUrl);

      const parts =
        parsed.pathname
          .split('/')
          .filter(Boolean);

      return (
        parts[parts.length - 1] ||
        ''
      );
    } catch (error) {
      return '';
    }
  }

  /**
   * Check invalid URLs.
   */
  isInvalidUrl(url = '') {
    const value =
      String(url)
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
   * Check whether URL appears
   * to represent an episode.
   */
  isEpisodeUrl(url = '') {
    const value =
      String(url)
        .toLowerCase()
        .trim();

    if (!value) {
      return false;
    }

    return (
      /\/episode\/[^/]+/i.test(value) ||
      /\/episodes\/[^/]+/i.test(value) ||
      /\/ep\/[^/]+/i.test(value) ||
      /episode[-_/]?\d+/i.test(value) ||
      /ep[-_/]?\d+/i.test(value) ||
      /s\d+e\d+/i.test(value)
    );
  }

  /**
   * Add episode safely.
   */
  addEpisode(
    episodes,
    seen,
    data
  ) {
    if (
      !data ||
      !data.url ||
      data.episode === undefined ||
      data.episode === null ||
      data.episode === ''
    ) {
      return;
    }

    const episode =
      String(data.episode);

    const key =
      `${episode}-${data.url}`;

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

      url:
        data.url,

      image:
        data.image || null
    });
  }

  /**
   * Extract episodes from
   * normal HTML structures.
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
      '.servers li',
      '[data-episode]',
      '[data-episode-number]',
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
              anchor.attr('href') ||
              item.attr('data-url') ||
              '';

            if (
              this.isInvalidUrl(href)
            ) {
              return;
            }

            const text =
              (
                item.attr(
                  'data-episode'
                ) ||

                item.attr(
                  'data-episode-number'
                ) ||

                item
                  .find(
                    '.episode-number'
                  )
                  .first()
                  .text() ||

                item
                  .find(
                    '.episode-title'
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

            const episodeNumber =
              this.getEpisodeNumber(
                text
              );

            if (!episodeNumber) {
              return;
            }

            const url =
              this.absoluteUrl(href);

            if (!url) {
              return;
            }

            const imageElement =
              item.find('img').first();

            const image =
              imageElement.attr(
                'data-src'
              ) ||
              imageElement.attr(
                'data-lazy-src'
              ) ||
              imageElement.attr(
                'src'
              ) ||
              null;

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
                  image
                    ? this.absoluteUrl(image)
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
   * Extract from all links.
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

          const episodeNumber =
            this.getEpisodeNumber(
              text
            );

          if (!episodeNumber) {
            return;
          }

          /*
           * Important:
           * Do not accept a generic
           * /watch/{animeId} URL unless
           * the page explicitly provides
           * multiple episode numbers.
           */
          if (
            !this.isEpisodeUrl(href) &&
            !/episode|ep\.?/i.test(text) &&
            !/^\d+(?:\.\d+)?$/.test(text)
          ) {
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
      }
    );

    return episodes;
  }

  /**
   * Extract episode information
   * from JavaScript data.
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

          const patterns = [
            /["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?[\s\S]{0,1000}?["'](?:url|href|link)["']\s*:\s*["']([^"']+)["']/gi,

            /["'](?:url|href|link)["']\s*:\s*["']([^"']+)["'][\s\S]{0,1000}?["']episode["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?/gi,

            /["']episodeNumber["']\s*:\s*["']?(\d+(?:\.\d+)?)["']?[\s\S]{0,1000}?["'](?:url|href|link)["']\s*:\s*["']([^"']+)["']/gi
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

              if (index === 1) {
                rawUrl =
                  match[1];

                episodeNumber =
                  match[2];
              } else {
                episodeNumber =
                  match[1];

                rawUrl =
                  match[2];
              }

              if (
                !episodeNumber ||
                !rawUrl ||
                this.isInvalidUrl(
                  rawUrl
                )
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

                  image: null
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

    const paths =
      this.base.providerId ===
      'animelok'
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

        const {
          $,
          html
        } =
          await this.page(path);

        if (
          !html ||
          html.length < 50
        ) {
          continue;
        }

        let episodes =
          this.extractEpisodes($);

        console.log(
          'NORMAL EXTRACTION:',
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
            'FALLBACK EXTRACTION:',
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
            'SCRIPT EXTRACTION:',
            episodes.length
          );
        }

        if (
          episodes.length > 0
        ) {
          episodes.sort(
            (a, b) =>
              parseFloat(
                a.episode
              ) -
              parseFloat(
                b.episode
              )
          );

          return {
            postId:
              String(id),

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
