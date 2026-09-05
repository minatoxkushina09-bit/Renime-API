const { SiteExtractor }=require('./site.extractor');
class HomeExtractor extends SiteExtractor{
 async extractFromFile(){const { $ }=await this.page(this.base.providerId==='animelok'?'/home':'/');
 const all=this.list($,'article,.post,.swiper-slide,.item__card,.film-poster,.flw-item');
 const pick=(words)=>all.filter(x=>words.some(w=>x.title.toLowerCase().includes(w)));
 return {provider:this.base.providerId,source:this.base.providerName,newestDrops:all.slice(0,20),newAnimeArrivals:all.slice(0,20),
 cartoonSeries:all.filter(x=>x.type==='series').slice(0,20),animeMovies:all.filter(x=>x.type==='movie').slice(0,20),
 cartoonFilms:pick(['movie','film']).slice(0,20),mostWatchedShows:all.filter(x=>x.type==='series').slice(0,10),
 mostWatchedFilms:all.filter(x=>x.type==='movie').slice(0,10)};}
}
module.exports={HomeExtractor};
