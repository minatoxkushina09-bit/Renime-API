/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers
 *
 * AnimeLok verified behavior:
 * /watch/{animeId}?ep=1  -> valid episode
 * /watch/{animeId}?ep=2  -> valid episode
 * ...
 * /watch/{animeId}?ep=N  -> 404 when episode does not exist
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
   * Check whether an AnimeLok episode exists.
   *
   * AnimeLok returns 404 when the episode
   * number does not exist.
   */
  async animeLokEpisodeExists(id, episode) {
    const encodedId =
      encodeURIComponent(id);

    const path =
      `/watch/${encodedId}?ep=${episode}`;

    try {
      const response =
        await this.client.get(path, {
          headers: this.getHeaders(),
          maxRedirects: 5,
          validateStatus: () => true
        });

      console.log(
        `ANIMELOK EPISODE ${episode}:`,
        response.status
      );

      /*
       * Episode exists only when the page
       * returns a successful response.
       */
      if (
        response.status >= 200 &&
        response.status < 400
      ) {
        const html =
          String(response.data || '');

        /*
         * Reject empty responses.
         */
        if (html.length < 50) {
          return false;
        }

        /*
         * Reject obvious 404 pages even if
         * AnimeLok ever returns one with
         * an unexpected status.
         */
        if (
          /404\s*(page\s*)?not\s*found/i.test(
            html
          ) ||
          /page\s*not\s*found/i.test(
            html
          )
        ) {
          return false;
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `AnimeLok episode ${episode} check failed:`,
        error.message
      );

      return false;
    }
  }

  /**
   * Sequentially discover AnimeLok episodes.
   *
   * Starts at episode 1 and continues until
   * AnimeLok returns a missing episode / 404.
   */
  async extractAnimeLokEpisodes(
    id,
    season = 1
  ) {
    const episodes = [];
    const seen = new Set();

    /*
     * Safety limit.
     *
     * This prevents an infinite loop if the
     * provider changes its behavior.
     */
    const maxEpisodes = 2000;

    for (
      let episode = 1;
      episode <= maxEpisodes;
      episode++
    ) {
      console.log(
        `CHECKING ANIMELOK EPISODE: ${episode}`
      );

      const exists =
        await this.animeLokEpisodeExists(
          id,
          episode
        );

      /*
       * Stop immediately when AnimeLok says
       * this episode does not exist.
       */
      if (!exists) {
        console.log(
          `ANIMELOK STOPPED AT EPISODE: ${episode}`
        );

        break;
      }

      const url =
        `https://animelok.live/watch/` +
        `${encodeURIComponent(id)}?ep=${episode}`;

      this.addEpisode(
        episodes,
        seen,
        {
          id:
            `${id}-${episode}`,

          episode:
            String(episode),

          title:
            `Episode ${episode}`,

          url,

          image: null
        }
      );
    }

    /*
     * If even Episode 1 does not exist,
     * return a proper error.
     */
    if (episodes.length === 0) {
      throw new Error(
        `Could not extract episodes for anime: ${id}`
      );
    }

    return {
      postId: String(id),
      season,
      episodes
    };
  }

  /**
   * Extract episodes from HTML elements.
   * Used for AnimeSky.
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

          const anchor =
            item.is('a')
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
            item
              .find('.episode-number')
              .first()
              .text() ||
            item
              .find('.episode-title')
              .first()
              .text() ||
            anchor.text() ||
            item.text();

          const cleanText =
            String(episodeText)
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
   * Used as AnimeSky fallback.
   */
  extractFallbackEpisodes($) {
    const episodes = [];
    const seen = new Set();

    $('a').each((_, element) => {
      try {
        const anchor =
          $(element);

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
   * Used as AnimeSky fallback.
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

        patterns.forEach(
          (pattern, index) => {
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
          }
        );
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

        if (
          !html ||
          html.length < 50
        ) {
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
   */
  async extractFromAnimePage(
    id,
    season = 1
  ) {
    if (
      this.base.providerId === 'animelok'
    ) {
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
