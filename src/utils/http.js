/**
 * Copyright (c) 2025 Dark & Pyro Team
 * ⚠️ Educational use only. Respect copyright laws.
 */

const axios = require('axios');
const { logger } = require('./logger');

class HttpClient {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

        'Accept-Language':
          'en-US,en;q=0.9',

        'Accept-Encoding':
          'gzip, deflate, br',

        'Cache-Control':
          'no-cache',

        'Pragma':
          'no-cache',
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          `HTTP Request: ${config.method?.toUpperCase()} ${config.url}`
        );

        return config;
      },
      (error) => {
        logger.error(
          'HTTP Request Error',
          error
        );

        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `HTTP Response: ${response.status} ${response.config.url}`
        );

        return response;
      },
      (error) => {
        logger.error(
          `HTTP Error: ${
            error.response?.status || 'Unknown'
          } ${
            error.config?.url || 'Unknown URL'
          }`,
          error
        );

        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get(url, options = {}) {
    const headers = {
      ...this.client.defaults.headers.common,

      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',

      'Accept-Language':
        'en-US,en;q=0.9',

      'Cache-Control':
        'no-cache',

      'Pragma':
        'no-cache',

      ...options.headers,
    };

    /*
     * Add AnimeLok-specific headers.
     */
    if (
      String(url).includes('animelok.live')
    ) {
      headers.Referer =
        'https://animelok.live/';

      headers.Origin =
        'https://animelok.live';

      headers['Sec-Fetch-Dest'] =
        'document';

      headers['Sec-Fetch-Mode'] =
        'navigate';

      headers['Sec-Fetch-Site'] =
        'same-origin';

      headers['Upgrade-Insecure-Requests'] =
        '1';
    }

    const config = {
      url,
      method: 'GET',

      timeout:
        options.timeout ?? 30000,

      maxRedirects:
        options.maxRedirects ?? 5,

      headers,

      validateStatus(status) {
        return status >= 200 && status < 400;
      },
    };

    let lastError;

    const retries =
      options.retries ?? 2;

    const retryDelay =
      options.retryDelay ?? 1000;

    for (
      let attempt = 0;
      attempt <= retries;
      attempt++
    ) {
      try {
        const response =
          await this.client.request(
            config
          );

        logger.info(
          `HTTP Response: ${response.status} ${url}`
        );

        return response.data;

      } catch (error) {
        lastError = error;

        logger.error(
          `Request failed: ${
            error.response?.status ||
            'Unknown'
          } ${url}`,
          error
        );

        if (attempt < retries) {
          logger.warn(
            `Retrying request... (${
              attempt + 1
            }/${retries})`
          );

          await this.delay(
            retryDelay *
            (attempt + 1)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * GET binary/buffer request
   */
  async getBuffer(url, options = {}) {
    const config = {
      url,
      method: 'GET',

      responseType:
        'arraybuffer',

      timeout:
        options.timeout ?? 30000,

      maxRedirects:
        options.maxRedirects ?? 5,

      headers: {
        ...this.client.defaults.headers.common,

        ...options.headers,
      },
    };

    const response =
      await this.client.request(
        config
      );

    return Buffer.from(
      response.data
    );
  }

  /**
   * POST request
   */
  async post(
    url,
    data,
    options = {}
  ) {
    const config = {
      url,
      method: 'POST',
      data,

      timeout:
        options.timeout ?? 30000,

      maxRedirects:
        options.maxRedirects ?? 5,

      headers: {
        ...this.client.defaults.headers.common,

        ...options.headers,
      },
    };

    let lastError;

    const retries =
      options.retries ?? 0;

    const retryDelay =
      options.retryDelay ?? 1000;

    for (
      let attempt = 0;
      attempt <= retries;
      attempt++
    ) {
      try {
        const response =
          await this.client.request(
            config
          );

        return response.data;

      } catch (error) {
        lastError = error;

        logger.error(
          `POST failed: ${
            error.response?.status ||
            'Unknown'
          } ${url}`,
          error
        );

        if (attempt < retries) {
          logger.warn(
            `Retrying POST... (${
              attempt + 1
            }/${retries})`
          );

          await this.delay(
            retryDelay *
            (attempt + 1)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(resolve, ms)
    );
  }
}

const httpClient =
  new HttpClient();

module.exports = {
  httpClient,
};
