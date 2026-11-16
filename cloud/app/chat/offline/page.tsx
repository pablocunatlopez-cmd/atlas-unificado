import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
// Compatibility route: do not present the rule-only Atlas Core as the full Lía.
export default function OfflineChatPage(){redirect('/chat/');}
