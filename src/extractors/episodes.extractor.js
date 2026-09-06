/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers
 *
 * AnimeLok episode structure verified from anime page text:
 *
 * HIN - 24
 * TAM - 24
 * TEL - 24
 * ENG - 24
 * JAP - 24
 *
 * Episode watch URL:
 * https://animelok.live/watch/{animeId}?ep={episode}
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
   * Extract AnimeLok episode count.
   *
   * Verified AnimeLok page format:
   *
   * HIN - 24
   * TAM - 24
   * TEL - 24
   * ENG - 24
   * JAP - 24
   *
   * Also supports:
   *
   * 24 EPS
   * EP-24
   * Episodes: 24
   * 24 Episodes
   */
  getAnimeLokEpisodeCount($, html = '') {
    const candidates = [];

    const pageText = [
      $('body').text(),
      html
    ]
      .filter(Boolean)
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (!pageText) {
      return 0;
    }

    /*
     * Language episode counts.
     *
     * Examples:
     * HIN - 24
     * TAM - 24
     * TEL - 24
     * ENG - 24
     * JAP - 24
     */
    const languagePattern =
      /\b(?:HIN|TAM|TEL|ENG|JAP|MAL|BEN|KAN|HINDI|TAMIL|TELUGU|ENGLISH|JAPANESE|MALAYALAM|BENGALI|KANNADA)\s*[-:|]?\s*(\d{1,4})\b/gi;

    let match;

    while (
      (match = languagePattern.exec(pageText)) !== null
    ) {
      const count = parseInt(match[1], 10);

      if (
        Number.isFinite(count) &&
        count > 0 &&
        count <= 2000
      ) {
        candidates.push(count);
      }
    }

    /*
     * Explicit episode formats.
     *
     * Examples:
     * 24 EPS
     * 24 EP
     * 24 Episodes
     * Episodes: 24
     * EP-24
     */
    const episodePatterns = [
      /\b(\d{1,4})\s*EPS?\b/gi,
      /\b(\d{1,4})\s*EPISODES?\b/gi,
      /\bEP(?:ISODE)?\s*[-:#]?\s*(\d{1,4})\b/gi,
      /\bEPISODES?\s*[:\-]?\s*(\d{1,4})\b/gi
    ];

    for (const pattern of episodePatterns) {
      while (
        (match = pattern.exec(pageText)) !== null
      ) {
        const count = parseInt(match[1], 10);

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
     * Check useful data attributes.
     */
    const attributeNames = [
      'data-episodes',
      'data-episode-count',
      'data-total-episodes',
      'data-episode'
    ];

    for (const attribute of attributeNames) {
      $(`[${attribute}]`).each(
        (_, element) => {
          const value =
            $(element).attr(attribute);

          const count =
            parseInt(value, 10);

          if (
            Number.isFinite(count) &&
            count > 0 &&
            count <= 2000
          ) {
            candidates.push(count);
          }
        }
      );
    }

    if (candidates.length === 0) {
      return 0;
    }

    /*
     * AnimeLok can show one count per language.
     * They should normally all be equal.
     *
     * Use the most frequently occurring count.
     * If there is a tie, use the largest count.
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

    for (
      const [count, countFrequency]
      of frequency.entries()
    ) {
      if (
        countFrequency > bestFrequency ||
        (
          countFrequency === bestFrequency &&
          count > bestCount
        )
      ) {
        bestCount = count;
        bestFrequency = countFrequency;
      }
    }

    console.log(
      'ANIMELOK EPISODE CANDIDATES:',
      candidates
    );

    console.log(
      'ANIMELOK DETECTED EPISODE COUNT:',
      bestCount
    );

    return bestCount;
  }

  /**
   * Generate AnimeLok episode URLs.
   */
  createAnimeLokEpisodes(
    id,
    episodeCount
  ) {
    const episodes = [];
    const seen = new Set();

    const safeCount =
      Math.min(
        Math.max(
          parseInt(episodeCount, 10) || 0,
          0
        ),
        2000
      );

    for (
      let episode = 1;
      episode <= safeCount;
      episode++
    ) {
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

    return episodes;
  }

  /**
   * Extract AnimeLok episodes from the anime page.
   *
   * Only one page request is needed.
   */
  async extractAnimeLokEpisodes(
    id,
    season = 1
  ) {
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
          `TRYING ANIMELOK: ${path}`
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

        const episodeCount =
          this.getAnimeLokEpisodeCount(
            $,
            html
          );

        if (
          !episodeCount ||
          episodeCount < 1
        ) {
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
      $(selector).each(
        (_, element) => {
          try {
            const item =
              $(element);

            const anchor =
              item.is('a')
                ? item
                : item.find('a').first();

            const href =
              anchor.attr('href') ||
              item.attr('data-url') ||
              '';

            if (
              this.isInvalidUrl(href)
            ) {
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
              this.getEpisodeNumber(
                cleanText
              );

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
        }
      );

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  /**
   * Extract numbered episode links.
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
      }
    );

    return episodes;
  }

  /**
   * Extract episode objects from scripts.
   */
  extractEpisodesFromScripts($) {
    const episodes = [];
    const seen = new Set();

    $('script').each(
      (_, element) => {
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
      }
    );

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
