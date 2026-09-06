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
        const {
          suggestion,
          q,
          query: queryParam,
          provider
        } = req.query;

        // Validate query
        if (!suggestion && !q && !queryParam) {
          throw new BadRequestError(
            'Either "suggestion", "q", or "query" parameter is required'
          );
        }

        const query = String(
          q || queryParam || suggestion || ''
        ).trim();

        if (!query) {
          throw new BadRequestError(
            'Search query cannot be empty'
          );
        }

        // Requested provider
        const requestedProvider = String(
          provider || 'animesky'
        )
          .toLowerCase()
          .trim();

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

        /**
         * Perform search with selected provider.
         */
        const performSearch = async (providerName) => {
          const searchExtractor =
            new SearchExtractor(providerName);

          return searchExtractor.search(query);
        };

        let results =
          await performSearch(requestedProvider);

        /**
         * IMPORTANT:
         *
         * Your extractor catches errors internally
         * and returns:
         *
         * {
         *   success: false,
         *   error: "Request blocked with status 403"
         * }
         *
         * Therefore we must check results.success,
         * not only catch thrown errors.
         */

        if (
          requestedProvider === 'animesky' &&
          (
            !results ||
            results.success === false ||
            !Array.isArray(results.results) ||
            results.results.length === 0
          )
        ) {
          logger.warn(
            'AnimeSky search failed, trying AnimeLok fallback',
            {
              query,
              error: results?.error || null
            }
          );

          const fallbackResults =
            await performSearch('animelok');

          // Only replace results if AnimeLok succeeds
          if (
            fallbackResults &&
            fallbackResults.success === true &&
            Array.isArray(fallbackResults.results) &&
            fallbackResults.results.length > 0
          ) {
            results = {
              ...fallbackResults,

              fallback: true,

              originalProvider:
                'animesky',

              requestedProvider:
                'animesky'
            };
          }
        }

        /**
         * Return the result.
         *
         * This preserves direct AnimeLok requests.
         */
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

module.exports = {
  SearchController
};
