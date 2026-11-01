import AtlasHouse from './atlas-house';
import {chatGPTSignInPath,getChatGPTUser} from './chatgpt-auth';

export const dynamic='force-dynamic';
export const metadata={title:'Atlas · Una casa para tus ideas',description:'Entra en la casa 3D de Atlas: conversa, crea música, explora el laboratorio y construye mundos desde el móvil.'};

export default async function Home(){
 const user=await getChatGPTUser();
 return <AtlasHouse signedIn={!!user} displayName={user?.displayName||''} signInPath={chatGPTSignInPath('/')} />;
}
