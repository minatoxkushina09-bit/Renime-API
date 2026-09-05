const {resolveProvider,DEFAULT_PROVIDER}=require('../config/providers');
class WatchAnimeWorldBase{
 constructor(providerKey=DEFAULT_PROVIDER){const p=resolveProvider(providerKey);Object.assign(this,{providerId:p.id,providerName:p.name,baseUrl:p.baseUrl.replace(/\/+$/,'')});}
 buildUrl(path){if(!path)return this.baseUrl;if(/^https?:\/\//i.test(path))return path;return this.baseUrl+'/'+String(path).replace(/^\/+/, '');}
}
module.exports={WatchAnimeWorldBase};
