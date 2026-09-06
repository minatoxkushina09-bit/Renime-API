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
    return (
      this.base.providerName ||
      this.base.providerId ||
      'Unknown'
    );
  }

  extractEpisode($, item) {
    const episodeNum =
      this.extractText(
        $(item).find('.num-epi').first()
      ) ||
      this.extractText(
        $(item).find('.episode-number').first()
      );

    const title =
      this.extractText(
        $(item).find('.entry-title').first()
      ) ||
      this.extractText(
        $(item).find('.title').first()
      ) ||
      this.extractText(
        $(item).find('.name').first()
      );

    const image =
      this.extractAttribute(
        $(item).find('img').first(),
        'data-src'
      ) ||
      this.extractAttribute(
        $(item).find('img').first(),
        'data-lazy-src'
      ) ||
      this.extractAttribute(
        $(item).find('img').first(),
        'src'
      );

    const link =
      this.extractAttribute(
        $(item).find('a.lnk-blk').first(),
        'href'
      ) ||
      this.extractAttribute(
        $(item).find('a[href]').first(),
        'href'
      );

    let episodeId = '';

    if (link) {
      try {
        const fullUrl =
          this.base.buildUrl(link);

        const urlParts =
          fullUrl
            .split('/')
            .filter(Boolean);

        episodeId =
          urlParts[
            urlParts.length - 1
          ] || '';
      } catch (error) {
        episodeId = '';
      }
    }

    let detectedSeason = '';
    let episode = '';

    if (episodeNum) {
      let match =
        episodeNum.match(
          /(\d+)\s*[xX]\s*(\d+)/
        );

      if (match) {
        detectedSeason = match[1];
        episode = match[2];
      } else {
        match =
          episodeNum.match(
            /[sS]\s*(\d+)\s*[eE]\s*(\d+)/
          );

        if (match) {
          detectedSeason = match[1];
          episode = match[2];
        } else {
          const epMatch =
            episodeNum.match(/\d+/);

          if (epMatch) {
            episode = epMatch[0];
          }
        }
      }
    }

    return {
      id: episodeId,
      season: detectedSeason,
      episode,
      title,
      image:
        this.normalizeImageUrl(image),
      url: link
        ? this.base.buildUrl(link)
        : ''
    };
  }

  async extract(html) {
    const $ = this.loadCheerio(html);

    const episodes = [];
    const seen = new Set();

    const selectors = [
      '.episode-item',
      '.episodes li',
      '.episodelist li',
      '.aa-cnt li',
      '.listing li',
      'li'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        try {
          const episode =
            this.extractEpisode(
              $,
              element
            );

          if (
            !episode.title &&
            !episode.episode &&
            !episode.id
          ) {
            return;
          }

          const key =
            episode.id ||
            `${episode.season}-${episode.episode}-${episode.title}`;

          if (seen.has(key)) {
            return;
          }

          seen.add(key);
          episodes.push(episode);

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

    console.log(
      'TOTAL EPISODES:',
      episodes.length
    );

    return episodes;
  }

  async getAnimePage(id) {
    const { httpClient } =
      require('../utils/http');

    const { getRandomUserAgent } =
      require('../config/user-agents');

    const encodedId =
      encodeURIComponent(id);

    const possiblePaths =
      this.base.providerId === 'animelok'
        ? [
            `/anime/${encodedId}`,
            `/anime/${encodedId}/`,
            `/series/${encodedId}`,
            `/series/${encodedId}/`
          ]
        : [
            `/series/${encodedId}/`,
            `/movies/${encodedId}/`
          ];

    let lastError = null;

    for (const path of possiblePaths) {
      const url =
        this.base.buildUrl(path);

      try {
        console.log(
          'TRYING ANIME PAGE:',
          url
        );

        const html =
          await httpClient.get(url, {
            headers: {
              'User-Agent':
                getRandomUserAgent(),

              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',

              'Accept-Language':
                'en-US,en;q=0.9'
            }
          });

        if (
          !html ||
          typeof html !== 'string'
        ) {
          continue;
        }

        console.log(
          'PAGE LENGTH:',
          html.length
        );

        return {
          html,
          url
        };

      } catch (error) {
        lastError = error;

        console.error(
          'PAGE REQUEST FAILED:',
          url,
          error.message
        );
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

    const html = page.html;

    const $ =
      this.loadCheerio(html);

    console.log(
      'SEARCHING POST ID IN:',
      page.url
    );

    // Method 1: body class
    const bodyClass =
      $('body').attr('class') || '';

    let match =
      bodyClass.match(
        /postid-(\d+)/i
      );

    if (match) {
      console.log(
        'POST ID FOUND IN BODY:',
        match[1]
      );

      return {
        postId: match[1],
        url: page.url
      };
    }

    // Method 2: article ID
    const articleId =
      $('article[id*="post-"]')
        .first()
        .attr('id');

    if (articleId) {
      match =
        articleId.match(
          /post-(\d+)/i
        );

      if (match) {
        console.log(
          'POST ID FOUND IN ARTICLE:',
          match[1]
        );

        return {
          postId: match[1],
          url: page.url
        };
      }
    }

    // Method 3: data-post
    const dataPost =
      $('[data-post]')
        .first()
        .attr('data-post');

    if (
      dataPost &&
      /^\d+$/.test(
        String(dataPost)
      )
    ) {
      console.log(
        'POST ID FOUND IN DATA-POST:',
        dataPost
      );

      return {
        postId: String(dataPost),
        url: page.url
      };
    }

    // Method 4: data-post-id
    const dataPostId =
      $('[data-post-id]')
        .first()
        .attr('data-post-id');

    if (
      dataPostId &&
      /^\d+$/.test(
        String(dataPostId)
      )
    ) {
      console.log(
        'POST ID FOUND IN DATA-POST-ID:',
        dataPostId
      );

      return {
        postId: String(dataPostId),
        url: page.url
      };
    }

    // Method 5: hidden input
    const hiddenPost =
      $('input[name="post"]')
        .first()
        .val();

    if (
      hiddenPost &&
      /^\d+$/.test(
        String(hiddenPost)
      )
    ) {
      console.log(
        'POST ID FOUND IN INPUT:',
        hiddenPost
      );

      return {
        postId: String(hiddenPost),
        url: page.url
      };
    }

    // Method 6: Search raw HTML
    match =
      html.match(
        /postid-(\d+)/i
      );

    if (match) {
      return {
        postId: match[1],
        url: page.url
      };
    }

    // Method 7: JavaScript post_id
    match =
      html.match(
        /["']post_id["']\s*[:=]\s*["']?(\d+)/i
      );

    if (match) {
      console.log(
        'POST ID FOUND IN SCRIPT:',
        match[1]
      );

      return {
        postId: match[1],
        url: page.url
      };
    }

    // Method 8: Generic post value
    match =
      html.match(
        /["']post["']\s*[:=]\s*["']?(\d+)/i
      );

    if (match) {
      console.log(
        'POST ID FOUND AS POST:',
        match[1]
      );

      return {
        postId: match[1],
        url: page.url
      };
    }

    console.error(
      'POST ID NOT FOUND'
    );

    throw new Error(
      `Could not find post ID for: ${id}`
    );
  }

  async extractFromAjax(id, season) {
    const { httpClient } =
      require('../utils/http');

    const { getRandomUserAgent } =
      require('../config/user-agents');

    console.log('====================');
    console.log('EPISODES REQUEST');
    console.log(
      'PROVIDER:',
      this.base.providerId
    );
    console.log('ANIME ID:', id);
    console.log('SEASON:', season);

    const animeData =
      await this.getPostId(id);

    const postId =
      animeData.postId;

    console.log(
      'POST ID:',
      postId
    );

    const params = [
      `season=${encodeURIComponent(season)}`,
      `post=${encodeURIComponent(postId)}`
    ].join('&');

    const ajaxUrls = [
      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&${params}`,

      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(season)}&post_id=${encodeURIComponent(postId)}`,

      `${this.base.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(season)}&id=${encodeURIComponent(postId)}`
    ];

    let lastError = null;

    for (const ajaxUrl of ajaxUrls) {
      try {
        console.log(
          'TRYING AJAX:',
          ajaxUrl
        );

        const html =
          await httpClient.get(
            ajaxUrl,
            {
              headers: {
                'User-Agent':
                  getRandomUserAgent(),

                Accept: '*/*',

                'Accept-Language':
                  'en-US,en;q=0.9',

                Referer:
                  animeData.url,

                'X-Requested-With':
                  'XMLHttpRequest'
              }
            }
          );

        if (
          !html ||
          typeof html !== 'string'
        ) {
          continue;
        }

        console.log(
          'AJAX LENGTH:',
          html.length
        );

        const episodes =
          await this.extract(html);

        if (episodes.length > 0) {
          console.log(
            'EPISODES FOUND:',
            episodes.length
          );

          return {
            postId,
            episodes
          };
        }

      } catch (error) {
        lastError = error;

        console.error(
          'AJAX FAILED:',
          error.message
        );
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
