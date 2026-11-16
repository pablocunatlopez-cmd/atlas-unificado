import OfflineChat from './offline-chat';
import {chatGPTSignInPath,getChatGPTUser} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Lía · Atlas Core sin PC',description:'Conversación temporal con el núcleo nativo Atlas Core, sin motor local.'};
export default async function OfflineChatPage(){
 const user=await getChatGPTUser();
 return <OfflineChat signedIn={!!user} signInPath={chatGPTSignInPath('/chat/offline/')} />;
}
