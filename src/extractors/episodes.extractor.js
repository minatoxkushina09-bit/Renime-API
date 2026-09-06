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
   * Clean text.
   */
  cleanText(value = '') {
    return String(value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract episode number from text.
   */
  getEpisodeNumber(text = '') {
    const value = this.cleanText(text);

    if (!value) {
      return '';
    }

    let match;

    /*
     * Episode 12
     */
    match = value.match(
      /\bepisode\s*(\d+(?:\.\d+)?)\b/i
    );

    if (match) {
      return match[1];
    }

    /*
     * Ep 12 / EP. 12
     */
    match = value.match(
      /\bep\.?\s*(\d+(?:\.\d+)?)\b/i
    );

    if (match) {
      return match[1];
    }

    /*
     * S1 E12
     */
    match = value.match(
      /\bs\d+\s*e\s*(\d+(?:\.\d+)?)\b/i
    );

    if (match) {
      return match[1];
    }

    /*
     * 1x12
     */
    match = value.match(
      /\b\d+\s*x\s*(\d+(?:\.\d+)?)\b/i
    );

    if (match) {
      return match[1];
    }

    /*
     * Episode title starting with number
     *
     * Example:
     * 12 - The Battle Begins
     */
    match = value.match(
      /^(\d+(?:\.\d+)?)\s*[-:|]/
    );

    if (match) {
      return match[1];
    }

    /*
     * Text is only a number
     */
    match = value.match(
      /^(\d+(?:\.\d+)?)$/
    );

    if (match) {
      return match[1];
    }

    return '';
  }

  /**
   * Extract episode number from a URL.
   */
  getEpisodeNumberFromUrl(url = '') {
    const value = String(url);

    if (!value) {
      return '';
    }

    let match;

    /*
     * /episode/12
     * /episode-12
     * /ep/12
     */
    match = value.match(
      /(?:episode|episodes|ep)[\/\-_]?(\d+(?:\.\d+)?)/i
    );

    if (match) {
      return match[1];
    }

    /*
     * /watch/...-12
     */
    match = value.match(
      /[-_/](\d+(?:\.\d+)?)(?:\/)?$/i
    );

    if (match) {
      return match[1];
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
   * Check whether URL looks like an episode/watch URL.
   */
  isEpisodeUrl(url = '') {
    const value = String(url).toLowerCase();

    if (!value) {
      return false;
    }

    /*
     * Reject obvious navigation URLs.
     */
    if (
      value === '/' ||
      value === '#' ||
      value.startsWith('javascript:') ||
      value.includes('latest-episode') ||
      value.includes('all-episodes') ||
      value.includes('episode-list') ||
      value.includes('/search') ||
      value.includes('/category') ||
      value.includes('/genre') ||
      value.includes('/tag')
    ) {
      return false;
    }

    /*
     * Accept common episode/watch paths.
     */
    return (
      value.includes('/episode/') ||
      value.includes('/episodes/') ||
      value.includes('/ep/') ||
      value.includes('/watch/') ||
      value.includes('/watching/') ||
      value.includes('/anime-watch/')
    );
  }

  /**
   * Get the most useful URL from an element.
   */
  getElementUrl($, element) {
    const item = $(element);

    const directHref =
      item.attr('href') ||
      '';

    if (directHref) {
      return directHref;
    }

    const anchorHref =
      item.find('a[href]').first().attr('href') ||
      '';

    if (anchorHref) {
      return anchorHref;
    }

    /*
     * Some sites store URLs in data attributes.
     */
    const dataAttributes = [
      'data-href',
      'data-url',
      'data-link',
      'data-episode-url',
      'data-watch-url'
    ];

    for (const attribute of dataAttributes) {
      const value =
        item.attr(attribute) ||
        item.find(`[${attribute}]`)
          .first()
          .attr(attribute) ||
        '';

      if (value) {
        return value;
      }
    }

    return '';
  }

  /**
   * Try to get episode number from element attributes.
   */
  getEpisodeNumberFromElement($, element) {
    const item = $(element);

    const attributes = [
      'data-episode',
      'data-episode-number',
      'data-number',
      'data-ep',
      'data-index',
      'data-episode-id',
      'episode'
    ];

    for (const attribute of attributes) {
      const value =
        item.attr(attribute) ||
        item.find(`[${attribute}]`)
          .first()
          .attr(attribute) ||
        '';

      const number =
        this.getEpisodeNumber(value);

      if (number) {
        return number;
      }

      const directMatch =
        String(value).match(
          /(\d+(?:\.\d+)?)/
        );

      if (directMatch) {
        return directMatch[1];
      }
    }

    return '';
  }

  /**
   * Get useful episode title.
   */
  getEpisodeTitle($, element, fallback = '') {
    const item = $(element);

    const selectors = [
      '.episode-title',
      '.episode-name',
      '.episode_name',
      '.episode-number',
      '.entry-title',
      '.title',
      '.name',
      '.film-name',
      'h1',
      'h2',
      'h3',
      'h4'
    ];

    for (const selector of selectors) {
      const text = this.cleanText(
        item.find(selector)
          .first()
          .text()
      );

      if (text) {
        return text;
      }
    }

    const anchor = item.is('a')
      ? item
      : item.find('a').first();

    const anchorText =
      this.cleanText(anchor.text());

    if (anchorText) {
      return anchorText;
    }

    const itemText =
      this.cleanText(item.text());

    if (itemText) {
      return itemText;
    }

    return fallback;
  }

  /**
   * Add episode safely.
   */
  addEpisode(
    episodes,
    seen,
    episodeData
  ) {
    if (!episodeData || !episodeData.url) {
      return;
    }

    const key =
      episodeData.url ||
      episodeData.id;

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);

    episodes.push(episodeData);
  }

  /**
   * Extract episode links from DOM.
   */
  extractEpisodes($) {
    const episodes = [];
    const seen = new Set();

    /*
     * First, look for links that clearly look
     * like episode/watch URLs.
     */
    const episodeSelectors = [
      'a[href*="/episode/"]',
      'a[href*="/episodes/"]',
      'a[href*="/ep/"]',
      'a[href*="/watch/"]',
      'a[href*="/watching/"]',
      '[data-episode-url]',
      '[data-watch-url]',
      '.episode-item',
      '.episode',
      '.episode-list li',
      '.episodes li',
      '.episodelist li',
      '.eps-item',
      '.list-episode li'
    ];

    for (const selector of episodeSelectors) {
      $(selector).each((index, element) => {
        try {
          const item = $(element);

          const href =
            this.getElementUrl(
              $,
              item
            );

          if (!href) {
            return;
          }

          const absoluteUrl =
            this.absoluteUrl(href);

          if (!absoluteUrl) {
            return;
          }

          /*
           * If this selector is broad,
           * require the URL to look like
           * an episode/watch URL.
           */
          if (
            !this.isEpisodeUrl(href)
          ) {
            return;
          }

          const title =
            this.getEpisodeTitle(
              $,
              item,
              `Episode ${index + 1}`
            );

          let episodeNumber =
            this.getEpisodeNumberFromElement(
              $,
              item
            );

          if (!episodeNumber) {
            episodeNumber =
              this.getEpisodeNumber(title);
          }

          if (!episodeNumber) {
            episodeNumber =
              this.getEpisodeNumberFromUrl(
                href
              );
          }

          /*
           * IMPORTANT:
           *
           * AnimeLok may use opaque episode IDs
           * without the episode number in the URL.
           *
           * If the URL is clearly an episode URL,
           * keep it even if we cannot determine
           * the number.
           */
          if (!episodeNumber) {
            episodeNumber =
              String(index + 1);
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
              absoluteUrl
            );

          this.addEpisode(
            episodes,
            seen,
            {
              id: episodeId,

              episode:
                episodeNumber,

              title:
                title ||
                `Episode ${episodeNumber}`,

              url:
                absoluteUrl,

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
      });
    }

    return episodes;
  }

  /**
   * Extract episode URLs embedded in scripts.
   *
   * Some providers render episode data
   * inside JSON or JavaScript instead
   * of normal HTML links.
   */
  extractEpisodesFromScripts($) {
    const episodes = [];
    const seen = new Set();

    $('script').each((_, element) => {
      try {
        const script =
          String($(element).html() || '');

        if (!script) {
          return;
        }

        /*
         * Find URLs containing episode/watch paths.
         */
        const matches =
          script.matchAll(
            /["']([^"'\\]*(?:\\.[^"'\\]*)*)["']/g
          );

        for (const match of matches) {
          let value = match[1]
            .replace(/\\\//g, '/')
            .replace(/\\u002F/g, '/')
            .replace(/\\u002f/g, '/')
            .trim();

          if (!value) {
            continue;
          }

          if (
            !this.isEpisodeUrl(value)
          ) {
            continue;
          }

          const absoluteUrl =
            this.absoluteUrl(value);

          if (!absoluteUrl) {
            continue;
          }

          const episodeNumber =
            this.getEpisodeNumberFromUrl(
              value
            ) ||
            String(episodes.length + 1);

          const episodeId =
            this.getEpisodeId(
              absoluteUrl
            );

          this.addEpisode(
            episodes,
            seen,
            {
              id: episodeId,

              episode:
                episodeNumber,

              title:
                `Episode ${episodeNumber}`,

              url:
                absoluteUrl,

              image: null
            }
          );
        }

      } catch (error) {
        console.error(
          'Script episode extraction error:',
          error.message
        );
      }
    });

    return episodes;
  }

  /**
   * Extract episodes directly from AnimeLok.
   */
  extractAnimeLokEpisodes($) {
    let episodes =
      this.extractEpisodes($);

    /*
     * If normal DOM extraction fails,
     * inspect JavaScript/JSON content.
     */
    if (episodes.length === 0) {
      episodes =
        this.extractEpisodesFromScripts($);
    }

    /*
     * Final fallback:
     *
     * Look through every anchor but accept
     * only episode/watch-like URLs.
     */
    if (episodes.length === 0) {
      const fallback = [];
      const seen = new Set();

      $('a[href]').each(
        (index, element) => {
          try {
            const anchor =
              $(element);

            const href =
              anchor.attr('href') ||
              '';

            if (
              !this.isEpisodeUrl(href)
            ) {
              return;
            }

            const absoluteUrl =
              this.absoluteUrl(href);

            if (!absoluteUrl) {
              return;
            }

            let episodeNumber =
              this.getEpisodeNumber(
                anchor.text()
              );

            if (!episodeNumber) {
              episodeNumber =
                this.getEpisodeNumberFromUrl(
                  href
                );
            }

            /*
             * Keep valid episode links even when
             * AnimeLok uses opaque IDs.
             */
            if (!episodeNumber) {
              episodeNumber =
                String(index + 1);
            }

            const episodeId =
              this.getEpisodeId(
                absoluteUrl
              );

            this.addEpisode(
              fallback,
              seen,
              {
                id: episodeId,

                episode:
                  episodeNumber,

                title:
                  this.cleanText(
                    anchor.text()
                  ) ||
                  `Episode ${episodeNumber}`,

                url:
                  absoluteUrl,

                image: null
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

      episodes = fallback;
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
          console.log(
            'PAGE HTML TOO SHORT'
          );

          continue;
        }

        console.log(
          'EPISODES PAGE LENGTH:',
          html.length
        );

        let episodes = [];

        if (
          this.base.providerId ===
          'animelok'
        ) {
          episodes =
            this.extractAnimeLokEpisodes($);
        } else {
          episodes =
            this.extractEpisodes($);

          if (
            episodes.length === 0
          ) {
            episodes =
              this.extractEpisodesFromScripts(
                $
              );
          }
        }

        /*
         * Remove duplicates.
         */
        const uniqueEpisodes = [];
        const seen = new Set();

        for (const episode of episodes) {
          const key =
            episode.url ||
            episode.id;

          if (
            !key ||
            seen.has(key)
          ) {
            continue;
          }

          seen.add(key);

          uniqueEpisodes.push(
            episode
          );
        }

        episodes =
          uniqueEpisodes;

        /*
         * Sort numerically when possible.
         */
        episodes.sort((a, b) => {
          const aNumber =
            parseFloat(a.episode);

          const bNumber =
            parseFloat(b.episode);

          if (
            !Number.isNaN(aNumber) &&
            !Number.isNaN(bNumber)
          ) {
            return aNumber - bNumber;
          }

          return 0;
        });

        console.log(
          'TOTAL REAL EPISODES:',
          episodes.length
        );

        /*
         * Helpful debugging output.
         */
        if (episodes.length > 0) {
          console.log(
            'FIRST EPISODE:',
            JSON.stringify(
              episodes[0]
            )
          );
        }

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
