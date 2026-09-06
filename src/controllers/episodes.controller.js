/**
 * Episodes Controller
 */

const { BaseController } = require('./base.controller');
const { logger } = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');
const { EpisodesExtractor } = require('../extractors/episodes.extractor');

class EpisodesController extends BaseController {
  async getEpisodes(req, res, next) {
    await this.execute(req, res, next, async () => {
      try {
        const { id, season } = req.params;

        if (!id) {
          throw new BadRequestError(
            'ID parameter is required'
          );
        }

        const seasonNum =
          parseInt(season, 10);

        if (
          isNaN(seasonNum) ||
          seasonNum < 1
        ) {
          throw new BadRequestError(
            'Season must be a positive integer'
          );
        }

        const provider =
          String(
            req.query.provider || 'animesky'
          )
            .toLowerCase()
            .trim();

        const episodesExtractor =
          new EpisodesExtractor(provider);

        const result =
          await episodesExtractor.extractFromAjax(
            id,
            seasonNum
          );

        return res.status(200).json({
          success: true,

          data: {
            id,

            postId:
              result.postId,

            season:
              seasonNum,

            episodes:
              result.episodes
          },

          provider,

          timestamp:
            new Date().toISOString()
        });
      } catch (error) {
        logger.error(
          'Error extracting episodes data',
          error
        );

        throw new BadRequestError(
          `Failed to extract episodes data: ${error.message}`
        );
      }
    });
  }
}

module.exports = {
  EpisodesController
};
