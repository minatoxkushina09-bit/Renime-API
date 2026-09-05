const { SiteExtractor }=require('./site.extractor');
class TypeExtractor extends SiteExtractor{
 async getType(type,page=1,pathType='category'){let path='';
 if(this.base.providerId==='animelok'){
   path=pathType==='letter'?'/search?letter='+encodeURIComponent(type)+'&page='+page:
     '/'+String(type).replace(/^category\//,'').replace(/^\/+/,'')+'?page='+page;
 }else path='/'+String(type).replace(/^\/+/,'')+(page>1?'?page='+page:'');
 const {$}=await this.page(path);return {provider:this.base.providerId,type,page:Number(page),results:this.list($,'article,.post,.film-poster,.flw-item,li')};}
}
module.exports={TypeExtractor};
