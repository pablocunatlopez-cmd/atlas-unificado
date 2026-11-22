import {cloudError,cloudJson,cloudUser,queue} from '@/lib/cloud/http';
import {projectLiaHypothesisTimeline} from '@/lib/lia/lia-hypothesis-timeline.mjs';
import {projectLiaKnowledgeState} from '@/lib/lia/lia-knowledge-state.mjs';
import {projectLiaConversation} from '@/lib/lia/lia-conversation-projection.mjs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{
  const user=await cloudUser();
  const {id}=await context.params;
  const store=queue();
  const conversation=await store.conversation(user.userId,id);
  const execution=await store.conversationExecutionEvents(user.userId,id);
  const hypothesisTimeline=projectLiaHypothesisTimeline(execution.events);
  return cloudJson({conversation:conversation.conversation,events:projectLiaConversation(conversation.messages),executionEvents:execution.events,hypothesisTimeline,knowledgeState:projectLiaKnowledgeState(hypothesisTimeline)});
 }catch(error){return cloudError(error);}
}
