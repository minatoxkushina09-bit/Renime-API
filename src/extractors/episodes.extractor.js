/**
 * Episodes Page Extractor
 */

const { BaseExtractor } = require('./base.extractor');
const { WatchAnimeWorldBase } = require('../base/base');

class EpisodesExtractor extends BaseExtractor {
  constructor(providerKey) {
    super();
    this.base = new WatchAnimeWorldBase(providerKey);
  }

  getSourceName() {
    return this.base.providerName || this.base.providerId || 'Unknown';
  }

  extractEpisode($, item) {
    const episodeNum = this.extractText(
      $(item).find('.num-epi').first()
    );

    const title = this.extractText(
      $(item).find('.entry-title').first()
    );

    const image = this.extractAttribute(
      $(item).find('img').first(),
      'src'
    );

    const link = this.extractAttribute(
      $(item).find('a.lnk-blk').first(),
      'href'
    );

    let episodeId = '';

    if (link) {
      const fullUrl = this.base.buildUrl(link);

      const urlParts = fullUrl
        .split('/')
        .filter(Boolean);

      episodeId =
        urlParts[urlParts.length - 1] || '';
    }

    let detectedSeason = '';
    let episode = '';

    if (episodeNum) {
      let match = episodeNum.match(
        /(\d+)[xX](\d+)/
      );

      if (match) {
        detectedSeason = match[1];
        episode = match[2];
      } else {
        match = episodeNum.match(
          /[sS](\d+)[eE](\d+)/
        );

        if (match) {
          detectedSeason = match[1];
          episode = match[2];
        } else {
          const epMatch =
            episodeNum.match(/(\d+)/);

          if (epMatch) {
            episode = epMatch[1];
          }
        }
      }
    }

    return {
      id: episodeId,
      season: detectedSeason,
      episode: episode,
      title: title,
      image: this.normalizeImageUrl(image),
      url: link
        ? this.base.buildUrl(link)
        : ''
    };
  }

  async extract(html) {
    const $ = this.loadCheerio(html);

    const episodes = [];

    const selectors = [
      'li',
      '.episode',
      '.episodes li',
      '.episodelist li',
      '.aa-cnt li',
      '.listing li'
    ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const episode =
          this.extractEpisode($, el);

        if (
          episode.title ||
          episode.episode ||
          episode.id
        ) {
          const exists = episodes.some(
            item =>
              item.id === episode.id &&
              item.id
          );

          if (!exists) {
            episodes.push(episode);
          }
        }
      });

      if (episodes.length > 0) {
        break;
      }
    }

    return episodes;
  }

  async getAnimePage(id) {
    const { httpClient } =
      require('../utils/http');

    const { getRandomUserAgent } =
      require('../config/user-agents');

    const possibleUrls = [
      `${this.base.baseUrl}/anime/${encodeURIComponent(id)}`,
      `${this.base.baseUrl}/anime/${encodeURIComponent(id)}/`,
      `${this.base.baseUrl}/series/${encodeURIComponent(id)}/`,
      `${this.base.baseUrl}/movies/${encodeURIComponent(id)}/`
    ];

    let lastError;

    for (const url of possibleUrls) {
      try {
        const response =
          await httpClient.get(url, {
            headers: {
              'User-Agent':
                getRandomUserAgent(),

              'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',

              'Accept-Language':
                'en-US,en;q=0.9'
            }
          });

        return {
          html: response,
          url: url
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        `Failed to fetch anime page: ${id}`
      )
    );
  }

  async getPostId(id) {
    const page =
      await this.getAnimePage(id);

    const $ =
      this.loadCheerio(page.html);

    const bodyClass =
      $('body').attr('class') || '';

    let postIdMatch =
      bodyClass.match(/postid-(\d+)/);

    if (postIdMatch) {
      return {
        postId: postIdMatch[1],
        url: page.url
      };
    }

    const articleId =
      $('article[id*="post-"]').first()
        .attr('id');

    if (articleId) {
      postIdMatch =
        articleId.match(/post-(\d+)/);

      if (postIdMatch) {
        return {
          postId: postIdMatch[1],
          url: page.url
        };
      }
    }

    const dataPost =
      $('[data-post]').first()
        .attr('data-post');

    if (dataPost) {
      return {
        postId: dataPost,
        url: page.url
      };
    }

    const hiddenPost =
      $('input[name="post"]').first()
        .val();

    if (hiddenPost) {
      return {
        postId: hiddenPost,
        url: page.url
      };
    }

    throw new Error(
      `Could not find post ID for: ${id}`
    );
  }

  async extractFromAjax(id, season) {
    const { httpClient } =
      require('../utils/http');

    const { getRandomUserAgent } =
      require('../config/user-agents');

    const animeData =
      await this.getPostId(id);

    const postId =
      animeData.postId;

    const ajaxUrls = [
      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(season)}&post=${encodeURIComponent(postId)}`,

      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(season)}&post_id=${encodeURIComponent(postId)}`,

      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(season)}&id=${encodeURIComponent(postId)}`
    ];

    let lastError;

    for (const ajaxUrl of ajaxUrls) {
      try {
        const html =
          await httpClient.get(ajaxUrl, {
            headers: {
              'User-Agent':
                getRandomUserAgent(),

              'Accept':
                '*/*',

              'Accept-Language':
                'en-US,en;q=0.9',

              'Referer':
                animeData.url,

              'X-Requested-With':
                'XMLHttpRequest'
            }
          });

        const episodes =
          await this.extract(html);

        if (episodes.length > 0) {
          return {
            postId,
            episodes
          };
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw (
      lastError ||
      new Error(
        'No episodes were found'
      )
    );
  }
}

module.exports = {
  EpisodesExtractor
};
