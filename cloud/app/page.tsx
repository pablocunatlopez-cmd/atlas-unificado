import AtlasHouse from './atlas-house';
import {chatGPTSignInPath,getChatGPTUser} from './chatgpt-auth';

export const dynamic='force-dynamic';
export const metadata={
  title:'Lía · Atlas, Ion e Ícaro',
  description:'Lía es el objetivo de la pirámide: Atlas como mente, Ion como cuerpo y Dios/Ícaro como cielo y constelación. La casa vive mientras el juego está abierto.'
};

export default async function Home(){
  const user=await getChatGPTUser();
  return <AtlasHouse signedIn={!!user} displayName={user?.displayName||''} signInPath={chatGPTSignInPath('/')} />;
}
