/**
 * Site Extractor
 * Shared base extractor for anime providers
 */

const axios = require('axios');
const cheerio = require('cheerio');

class SiteExtractor {
  constructor(provider = 'animesky') {
    this.providers = {
      animesky: {
        providerId: 'animesky',
        baseUrl: 'https://animesky.app'
      },

      animelok: {
        providerId: 'animelok',
        baseUrl: 'https://animelok.live'
      }
    };

    const normalizedProvider = String(provider || 'animesky')
      .toLowerCase()
      .trim();

    this.base =
      this.providers[normalizedProvider] ||
      this.providers.animesky;

    this.client = axios.create({
      baseURL: this.base.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
       
