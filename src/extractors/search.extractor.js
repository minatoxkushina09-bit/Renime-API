            const { SiteExtractor }=require('./site.extractor');
class SearchExtractor extends SiteExtractor{
 async search(query){const path=this.base.providerId==='animelok'?'/search?keyword='+encodeURIComponent(query):'/?s='+encodeURIComponent(query);
 const { $ }=await this.page(path);return {provider:this.base.providerId,query,results:this.list($,'article,.post,.search-item,.film-poster,.flw-item,li')};}
}
module.exports={SearchExtractor};
