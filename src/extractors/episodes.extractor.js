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

    const patterns = [
      /episode\s*(\d+(?:\.\d+)?)/i,
      /\bep\.?\s*(\d+(?:\.\d+)?)/i,
      /s\d+\s*e(\d+(?:\.\d+)?)/i,
      /\d+\s*x\s*(\d+(?:\.\d+)?)/i,
      /^\s*(\d+(?:\.\d+)?)\s*$/
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
   * Extract episode ID from URL.
   */
  getEpisodeId(url = '') {
    if (!url) {
      return '';
    }

    try {
      const parsed = new URL(this.absoluteUrl(url));

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
   * Check if URL looks like an episode/watch URL.
   */
  isEpisodeUrl(url = '') {
    const value = String(url);

    return (
      /\/episode\//i.test(value) ||
      /\/episodes\//i.test(value) ||
      /\/watch\//i.test(value) ||
      /episode[-_/]?\d+/i.test(value) ||
      /ep[-_/]?\d+/i.test(value)
    );
  }

  /**
   * Reject navigation URLs.
   */
  isInvalidUrl(url = '') {
    const value = String(url).toLowerCase();

    return (
      !value ||
      value === '#' ||
      value.startsWith('javascript:') ||
      value.startsWith('mailto:') ||
      value.includes('latest-episode') ||
      value.includes('all-episodes') ||
      value.includes('episode-list')
    );
  }

  /**
   * Add episode safely.
   */
  addEpisode(episodes, seen, data) {
    if (!data || !data.url) {
      return;
    }

    const key = data.url;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    episodes.push({
      id: data.id || this.getEpisodeId(data.url),
      episode: String(data.episode),
      title:
        data.title ||
        `Episode ${data.episode}`,
      url: data.url,
      image: data.image || null
    });
  }

  /**
   * Extract episodes from common HTML selectors.
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
      '[id*="episode"]',
      'a[href*="/episode/"]',
      'a[href*="/episodes/"]',
      'a[href*="/watch/"]'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        try {
          const item = $(element);

          const anchor = item.is('a')
            ? item
            : item.find('a').first();

          const href = anchor.attr('href') || '';

          if (this.isInvalidUrl(href)) {
            return;
          }

          const absoluteUrl =
            this.absoluteUrl(href);

          if (
            !this.isEpisodeUrl(href) &&
            !this.getEpisodeNumber(
              item.text()
            )
          ) {
            return;
          }

          const text = (
            item.find('.episode-title').first().text() ||
            item.find('.entry-title').first().text() ||
            item.find('.episode-number').first().text() ||
            item.find('.num-epi').first().text() ||
            item.find('.title').first().text() ||
            item.find('.name').first().text() ||
            anchor.text() ||
            item.text()
          )
            .replace(/\s+/g, ' ')
            .trim();

          let episodeNumber =
            this.getEpisodeNumber(text);

          if (!episodeNumber) {
            const urlPatterns = [
              /(?:episode|episodes)[-_/]?(\d+(?:\.\d+)?)/i,
              /(?:ep)[-_/]?(\d+(?:\.\d+)?)/i,
              /\/watch\/[^/]*?(\d+(?:\.\d+)?)/i
            ];

            for (const pattern of urlPatterns) {
              const match =
                href.match(pattern);

              if (match) {
                episodeNumber = match[1];
                break;
              }
            }
          }

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

          this.addEpisode(
            episodes,
            seen,
            {
              id: this.getEpisodeId(absoluteUrl),
              episode: episodeNumber,
              title: text,
              url: absoluteUrl,
              image: image
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

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  /**
   * Fallback: inspect all links.
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

        if (!episodeNumber) {
          const patterns = [
            /(?:episode|episodes)[-_/]?(\d+(?:\.\d+)?)/i,
            /ep[-_/]?(\d+(?:\.\d+)?)/i,
            /\/watch\/[^/]*?(\d+(?:\.\d+)?)/i
          ];

          for (const pattern of patterns) {
            const match = href.match(pattern);

            if (match) {
              episodeNumber = match[1];
              break;
            }
          }
        }

        if (!episodeNumber) {
          return;
        }

        const url =
          this.absoluteUrl(href);

        this.addEpisode(
          episodes,
          seen,
          {
            id: this.getEpisodeId(url),
            episode: episodeNumber,
            title: text,
            url,
            image: null
          }
        );
      } catch (error) {
        console.error(
          'Fallback episode error:',
          error.message
        );
      }
    });

    return episodes;
  }

  /**
   * Extract possible episode information from
   * script tags containing JSON data.
   */
  extractEpisodesFromScripts($) {
    const episodes = [];
    const seen = new Set();

    $('script').each((_, element) => {
      try {
        const content =
          $(element).html() || '';

        if (
          !/episode/i.test(content) ||
          content.length < 10
        ) {
          return;
        }

        const urlMatches =
          content.match(
            /["']([^"']*(?:\/episode\/|\/episodes\/|\/watch\/)[^"']+)["']/gi
          ) || [];

        urlMatches.forEach((match) => {
          const rawUrl =
            match.replace(/^["']|["']$/g, '');

          if (this.isInvalidUrl(rawUrl)) {
            return;
          }

          const absoluteUrl =
            this.absoluteUrl(rawUrl);

          const numberMatch =
            rawUrl.match(
              /(?:episode|episodes|ep)[-_/]?(\d+(?:\.\d+)?)/i
            ) ||
            rawUrl.match(
              /\/watch\/[^/]*?(\d+(?:\.\d+)?)/i
            );

          if (!numberMatch) {
            return;
          }

          const episodeNumber =
            numberMatch[1];

          this.addEpisode(
            episodes,
            seen,
            {
              id: this.getEpisodeId(
                absoluteUrl
              ),
              episode: episodeNumber,
              title:
                `Episode ${episodeNumber}`,
              url: absoluteUrl,
              image: null
            }
          );
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
   * Get episodes directly from anime page.
   */
  async extractFromAnimePage(
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
            'INVALID OR EMPTY HTML'
          );

          continue;
        }

        console.log(
          'EPISODES PAGE LENGTH:',
          html.length
        );

        let episodes =
          this.extractEpisodes($);

        console.log(
          'NORMAL EXTRACTION TOTAL:',
          episodes.length
        );

        if (episodes.length === 0) {
          episodes =
            this.extractFallbackEpisodes($);

          console.log(
            'FALLBACK EXTRACTION TOTAL:',
            episodes.length
          );
        }

        if (episodes.length === 0) {
          episodes =
            this.extractEpisodesFromScripts($);

          console.log(
            'SCRIPT EXTRACTION TOTAL:',
            episodes.length
          );
        }

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
