import {cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
import {projectLiaConversation} from '../../../../../../continuous/lia-conversation-projection.mjs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  const user=await cloudUser();
  const {id}=await context.params;
  const store=queue();
  const conversation=await store.conversation(user.userId,id);
  const execution=await store.conversationExecutionEvents(user.userId,id);
  return cloudJson({conversation:conversation.conversation,events:projectLiaConversation(conversation.messages),executionEvents:execution.events});
 }catch(error){return cloudError(error);}
}
