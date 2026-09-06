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
   * Check whether an element is a real episode.
   */
  isEpisodeElement($, element) {
    const item = $(element);

    const text = item
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const href =
      item.attr('href') ||
      item.find('a').first().attr('href') ||
      '';

    /*
     * Reject navigation links and generic links.
     */

    if (
      /latest-episode/i.test(href) ||
      /latest episode/i.test(text) ||
      /all-episodes/i.test(href) ||
      /episode-list/i.test(href) ||
      /^\/?latest/i.test(href)
    ) {
      return false;
    }

    /*
     * Require a real episode number in text.
     */

    const episodeNumber =
      this.getEpisodeNumber(text);

    if (episodeNumber) {
      return true;
    }

    /*
     * Support episode numbers directly inside URLs.
     */

    if (
      /episode[-_/]?\d+/i.test(href) ||
      /ep[-_/]?\d+/i.test(href) ||
      /\/watch\/.*\d+/i.test(href)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract episodes from a loaded anime page.
   */
  extractEpisodes($) {
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
      '[class*="episode"]',
      'a[href*="/episode/"]',
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

          if (!href) {
            return;
          }

          /*
           * Ignore generic navigation URLs.
           */

          if (
            /latest-episode/i.test(href) ||
            /all-episodes/i.test(href) ||
            /episode-list/i.test(href)
          ) {
            return;
          }

          const absoluteUrl =
            this.absoluteUrl(href);

          const text = (
            item.find('.episode-title')
              .first()
              .text() ||

            item.find('.entry-title')
              .first()
              .text() ||

            item.find('.episode-number')
              .first()
              .text() ||

            item.find('.num-epi')
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

          let episodeNumber =
            this.getEpisodeNumber(text);

          /*
           * Try extracting the episode number
           * from the URL if not present in text.
           */

          if (!episodeNumber) {
            const urlMatch =
              href.match(
                /(?:episode|ep)[-_/]?(\d+(?:\.\d+)?)/i
              );

            if (urlMatch) {
              episodeNumber =
                urlMatch[1];
            }
          }

          /*
           * Do not add items without
           * a confirmed episode number.
           */

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
              absoluteUrl || href
            );

          const key =
            absoluteUrl ||
            `${episodeNumber}-${text}`;

          if (seen.has(key)) {
            return;
          }

          seen.add(key);

          episodes.push({
            id: episodeId,
            episode: episodeNumber,
            title:
              text ||
              `Episode ${episodeNumber}`,
            url: absoluteUrl,
            image: image
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
   * Get episodes directly from the anime page.
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    let paths = [];

    if (
      this.base.providerId === 'animelok'
    ) {
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
          '================================'
        );

        console.log(
          'TRYING EPISODES PAGE:'
        );

        console.log(
          `${this.base.baseUrl}${path}`
        );

        const { $, html } =
          await this.page(path);

        if (
          !html ||
          html.length < 100
        ) {
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
         * Check every link, but only accept
         * links with a real episode number.
         */

        if (episodes.length === 0) {
          const fallbackEpisodes = [];
          const seen = new Set();

          $('a').each(
            (_, element) => {
              try {
                const anchor =
                  $(element);

                const href =
                  anchor.attr('href') ||
                  '';

                const text =
                  anchor
                    .text()
                    .replace(/\s+/g, ' ')
                    .trim();

                /*
                 * Ignore navigation links.
                 */

                if (
                  /latest-episode/i.test(href) ||
                  /latest episode/i.test(text) ||
                  /all-episodes/i.test(href) ||
                  /episode-list/i.test(href)
                ) {
                  return;
                }

                let episodeNumber =
                  this.getEpisodeNumber(
                    text
                  );

                /*
                 * Try URL if text does not
                 * contain an episode number.
                 */

                if (!episodeNumber) {
                  const urlMatch =
                    href.match(
                      /(?:episode|ep)[-_/]?(\d+(?:\.\d+)?)/i
                    );

                  if (urlMatch) {
                    episodeNumber =
                      urlMatch[1];
                  }
                }

                /*
                 * Only real numbered episodes.
                 */

                if (!episodeNumber) {
                  return;
                }

                const url =
                  this.absoluteUrl(href);

                if (
                  !url ||
                  seen.has(url)
                ) {
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

              } catch (error) {
                console.error(
                  'Fallback episode error:',
                  error.message
                );
              }
            }
          );

          episodes =
            fallbackEpisodes;
        }

        /*
         * Sort episodes numerically.
         */

        episodes.sort(
          (a, b) =>
            parseFloat(a.episode) -
            parseFloat(b.episode)
        );

        console.log(
          'TOTAL REAL EPISODES:',
          episodes.length
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
