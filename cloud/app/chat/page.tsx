import CloudChat from '../cloud-chat';
import {chatGPTSignInPath,getChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Lía · El entorno compartido de Atlas, Ion e Ícaro',description:'Habla con Lía. Atlas es la mente, Ion el cuerpo e Ícaro el cielo; sus tres entornos colaboran para desarrollarla.'};
export default async function ChatPage(){const user=await getChatGPTUser();return <CloudChat signedIn={!!user} displayName={user?.displayName||''} signInPath={chatGPTSignInPath('/chat/')} />;}
