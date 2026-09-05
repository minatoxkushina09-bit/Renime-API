/**
 * Search Controller
 * Copyright (c) 2025 Dark & Pyro Team
 * Educational use only. Respect copyright laws.
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

        const query = (q || suggestion).trim();

        if (!query) {
          throw new BadRequestError(
            'Search query cannot be empty'
          );
        }

        const requestedProvider =
          req.query.provider || 'animesky';

        const performSearch = async (provider) => {
          const searchExtractor =
            new SearchExtractor(provider);

          if (q) {
            return await searchExtractor.searchFullPage(query);
          }

          return await searchExtractor.search(query);
        };

        let results;

        try {
          results = await performSearch(requestedProvider);
        } catch (error) {
          const isBlocked =
            error.response?.status === 403;

          if (
            isBlocked &&
            requestedProvider.toLowerCase() === 'animesky'
          ) {
            logger.warn(
              'AnimeSky search blocked, trying Animelok fallback',
              {
                query,
                status: error.response?.status
              }
            );

            results = await performSearch('animelok');

            results.fallback = true;
            results.originalProvider = 'animesky';
          } else {
            throw error;
          }
        }

        return res.status(200).json(results);

      } catch (error) {
        logger.error('Error performing search', {
          message: error.message,
          stack: error.stack,
          status: error.response?.status,
          url: error.config?.url
        });

        return res
          .status(error.response?.status || 500)
          .json({
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
