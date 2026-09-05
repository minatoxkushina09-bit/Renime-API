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
        // Support all query parameter formats
        const {
          suggestion,
          q,
          query: queryParam,
          provider
        } = req.query;

        // Check if at least one search parameter exists
        if (!suggestion && !q && !queryParam) {
          throw new BadRequestError(
            'Either "suggestion", "q", or "query" parameter is required'
          );
        }

        // Get the search query
        const query = String(
          q || queryParam || suggestion || ''
        ).trim();

        // Prevent empty queries
        if (!query) {
          throw new BadRequestError(
            'Search query cannot be empty'
          );
        }

        // Default provider
        const requestedProvider = String(
          provider || 'animesky'
        )
          .toLowerCase()
          .trim();

        // Allowed providers
        const allowedProviders = [
          'animesky',
          'animelok'
        ];

        if (!allowedProviders.includes(requestedProvider)) {
          throw new BadRequestError(
            `Unsupported provider: ${requestedProvider}. ` +
            `Supported providers are: ${allowedProviders.join(', ')}`
          );
        }

        // Perform search
        const performSearch = async (providerName) => {
          const searchExtractor =
            new SearchExtractor(providerName);

          return await searchExtractor.search(query);
        };

        let results;

        try {
          results = await performSearch(
            requestedProvider
          );
        } catch (error) {
          const status =
            error.response?.status;

          // If AnimeSky is blocked, try Animelok
          if (
            status === 403 &&
            requestedProvider === 'animesky'
          ) {
            logger.warn(
              'AnimeSky search blocked, trying Animelok fallback',
              {
                query,
                status
              }
            );

            results = await performSearch(
              'animelok'
            );

            results.fallback = true;
            results.originalProvider = 'animesky';
          } else {
            throw error;
          }
        }

        return res
          .status(200)
          .json(results);

      } catch (error) {
        logger.error(
          'Error performing search',
          {
            message: error.message,
            stack: error.stack,
            status: error.response?.status,
            url: error.config?.url
          }
        );

        const status =
          error.statusCode ||
          error.response?.status ||
          500;

        return res
          .status(status)
          .json({
            success: false,
            error: error.message,
            status,
            url: error.config?.url || null
          });
      }
    });
  }
}

module.exports = { SearchController };
