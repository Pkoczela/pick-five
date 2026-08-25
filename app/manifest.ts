import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{return{name:"Pick Five NFL Pool",short_name:"Pick Five",description:"A private mobile-first NFL against-the-spread Pick Five pool.",start_url:"/dashboard",display:"standalone",background_color:"#f4f0e6",theme_color:"#10281f",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]}}
