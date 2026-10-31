import CloudChat from './cloud-chat';
import {chatGPTSignInPath,getChatGPTUser} from './chatgpt-auth';

export const dynamic='force-dynamic';
export const metadata={title:'Atlas · Contigo, desde cualquier lugar',description:'Tu espacio para conversar con Atlas. Historial en la nube y un motor Qwen que responde desde tu ordenador.'};

export default async function Home(){
 const user=await getChatGPTUser();
 return <CloudChat signedIn={!!user} displayName={user?.displayName||''} signInPath={chatGPTSignInPath('/')} />;
}
