/**
 * Search Controller
 * Copyright (c) 2025 Dark & Pyro Team
 * ⚠️ Educational use only. Respect copyright laws.
 */

const { BaseController } = require('./base.controller');
const { logger } = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');
const { SearchExtractor } = require('../extractors/search.extractor');

class SearchController extends BaseController {
  async search(req, res, next) {
    await this.execute(req, res, next, async () => {
      try {
        const { suggestion, q } = req.query;

        if (!suggestion && !q) {
          throw new BadRequestError(
            'Either "suggestion" or "q" parameter is required'
          );
        }

        const provider = req.query.provider;
        const searchExtractor = new SearchExtractor(provider);

        let results;

        if (q) {
          // Full page search
          results = await searchExtractor.searchFullPage(q.trim());
        } else {
          // AJAX suggestion search
          results = await searchExtractor.search(suggestion.trim());
        }

        res.status(200).json(results);

      } catch (error) {
        logger.error('Error performing search', {
          message: error.message,
          stack: error.stack,
          status: error.response?.status,
          url: error.config?.url
        });

        res.status(error.response?.status || 500).json({
          success: false,
          error: error.message,
          status: error.response?.status || 500,
          url: error.config?.url || null
        });
      }
    });
  }
}

module.exports = { SearchController };
