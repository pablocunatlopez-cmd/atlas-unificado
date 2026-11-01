import CloudChat from '../cloud-chat';
import {chatGPTSignInPath,getChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Atlas · Conversar',description:'Habla con tu Atlas desde cualquier lugar y conserva tu historial privado.'};
export default async function ChatPage(){const user=await getChatGPTUser();return <CloudChat signedIn={!!user} displayName={user?.displayName||''} signInPath={chatGPTSignInPath('/chat/')} />;}
