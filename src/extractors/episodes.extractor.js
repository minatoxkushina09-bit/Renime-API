/**
 * Episodes Extractor
 * Compatible with AnimeSky and AnimeLok providers
 */

const { SiteExtractor } = require('./site.extractor');

class EpisodesExtractor extends SiteExtractor {
  constructor(provider = 'animesky') {
    super(provider);
  }

  getEpisodeNumber(text = '', fallback = '') {
    const value = String(text)
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /episode\s*(\d+(?:\.\d+)?)/i,
      /\bep\.?\s*(\d+(?:\.\d+)?)/i,
      /s\d+\s*e(\d+(?:\.\d+)?)/i,
      /(\d+)\s*x\s*(\d+(?:\.\d+)?)/i,
      /^\d+(?:\.\d+)?$/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        return match[2] || match[1] || match[0];
      }
    }

    return fallback;
  }

  getEpisodeId(url = '') {
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

  addEpisode(episodes, seen, data) {
    if (!data || !data.url || !data.episode) {
      return;
    }

    const key = data.url;

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

      url: data.url,

      image:
        data.image || null
    });
  }

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
      '[class*="episode"]',
      'a'
    ];

    for (const selector of selectors) {
      $(selector).each((index, element) => {
        try {
          const item = $(element);

          const anchor =
            item.is('a')
              ? item
              : item.find('a').first();

          if (!anchor.length) {
            return;
          }

          const href =
            anchor.attr('href') || '';

          const url =
            this.absoluteUrl(href);

          if (!url) {
            return;
          }

          const text =
            (
              item
                .find('.episode-title')
                .first()
                .text() ||

              item
                .find('.episode-number')
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
              text,
              ''
            );

          if (!episodeNumber) {
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

  async extractFromAnimePage(
    id,
    season = 1
  ) {
    const encodedId =
      encodeURIComponent(id);

    const paths =
      this.base.providerId === 'animelok'
        ? [
            `/anime/${encodedId}`,
            `/watch/${encodedId}`
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
          `TRYING ${this.base.providerId}:`,
          path
        );

        const { $ } =
          await this.page(path);

        const episodes =
          this.extractEpisodes($);

        console.log(
          'EPISODES FOUND:',
          episodes.length
        );

        if (episodes.length > 0) {
          episodes.sort(
            (a, b) =>
              parseFloat(a.episode) -
              parseFloat(b.episode)
          );

          return {
            postId: id,
            season,
            episodes
          };
        }
      } catch (error) {
        lastError = error;

        console.error(
          `Failed: ${path}`,
          error.message
        );
      }
    }

    /**
     * Temporary AnimeLok fallback.
     * The /watch/{id} page represents
     * the available watch entry.
     */
    if (
      this.base.providerId === 'animelok'
    ) {
      return {
        postId: id,
        season,
        episodes: [
          {
            id,
            episode: '1',
            title: 'Episode 1',
            url:
              `${this.base.baseUrl}/watch/${encodedId}`,
            image: null
          }
        ]
      };
    }

    throw (
      lastError ||
      new Error(
        `Could not extract episodes for anime: ${id}`
      )
    );
  }

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
