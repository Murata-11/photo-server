// Generated from api/openapi.yaml by scripts/generate-mocks.mjs. Do not edit.
import type {operations} from './api.generated';
type Response<K extends keyof operations> = operations[K]['responses'][200]['content']['application/json'];
async function request<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,init);if(!response.ok)throw new Error('通信に失敗しました。もう一度お試しください。');return response.json();}
export const api={
list:()=>request<Response<'listPhotos'>>('/api/photos'),
update:(id:string,body:operations['updatePhoto']['requestBody']['content']['application/json'])=>request<Response<'updatePhoto'>>('/api/photos/{id}'.replace('{id}',encodeURIComponent(id)),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
create:(src:string,name:string)=>request<Response<'createPhoto'>>('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({src,name} satisfies operations['createPhoto']['requestBody']['content']['application/json'])})
};
