const { SiteExtractor }=require('./site.extractor');
class DetailsExtractor extends SiteExtractor{
 async getDetails(id){const { $ }=await this.page('/anime/'+encodeURIComponent(id));
 const title=$('h1').first().text().trim()||$('title').text().replace(/\s*[-|].*$/,'').trim();
 const desc=$('p').filter((_,e)=>$(e).text().trim().length>80).first().text().trim();
 const image=this.absolute($('meta[property="og:image"]').attr('content')||$('img').first().attr('src')||'');
 const text=$('body').text().replace(/\s+/g,' ');
 const languages=[];$('a,button,span').each((_,e)=>{const t=$(e).text().trim();if(/^(Hindi|Telugu|Tamil|Malayalam|Bengali|English|Japanese)$/i.test(t)&&!languages.includes(t))languages.push(t);});
 return {provider:this.base.providerId,id,title,image,description:desc,languages,rawMeta:{aired:text.match(/Aired:\s*([^]+?)(?=Premiered:|Duration:|Status:|$)/i)?.[1]?.trim()||'',status:text.match(/Status:\s*([A-Z]+)/i)?.[1]||''}};}
}
module.exports={DetailsExtractor};
