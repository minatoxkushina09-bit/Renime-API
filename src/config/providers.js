const PROVIDERS={
  animesky:{id:'animesky',name:'Anime Sky',baseUrl:'https://animesky.app',aliases:['animesky','animesalt','salt','as']},
  animelok:{id:'animelok',name:'Animelok',baseUrl:'https://animelok.live',aliases:['animelok','watchanimeworld','waw','animeworld','awi']}
};
const DEFAULT_PROVIDER='animesky';
function resolveProvider(key){const k=String(key||DEFAULT_PROVIDER).trim().toLowerCase();return PROVIDERS[k]||Object.values(PROVIDERS).find(p=>p.aliases.includes(k))||PROVIDERS[DEFAULT_PROVIDER];}
function listProviders(){return Object.values(PROVIDERS).map(({id,name,baseUrl,aliases})=>({id,name,baseUrl,aliases}));}
module.exports={PROVIDERS,DEFAULT_PROVIDER,resolveProvider,listProviders};
