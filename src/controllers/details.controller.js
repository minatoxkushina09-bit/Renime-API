/**
 * Details Controller
 * Copyright (c) 2025 Dark & Pyro Team
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseController } = require('./base.controller');
const { logger } = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');
const { DetailsExtractor } = require('../extractors/details.extractor');

class DetailsController extends BaseController {
  async getDetails(req, res, next) {
    await this.execute(req, res, next, async () => {
      try {
        const { id } = req.params;

        if (!id) {
          throw new BadRequestError(
            'ID parameter is required'
          );
        }

        const provider =
          req.query.provider || 'animesky';

        const detailsExtractor =
          new DetailsExtractor(provider);

        // DetailsExtractor has getDetails(),
        // not extractFromUrl()
        const detailsData =
          await detailsExtractor.getDetails(id);

        return res
          .status(200)
          .json(detailsData);

      } catch (error) {
        logger.error(
          'Error extracting details data',
          {
            message: error.message,
            stack: error.stack,
            status: error.response?.status || null
          }
        );

        throw new BadRequestError(
          `Failed to extract details data: ${error.message}`
        );
      }
    });
  }
}

module.exports = {
  DetailsController
};
