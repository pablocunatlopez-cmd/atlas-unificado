import {eq} from "drizzle-orm";import {getDb} from "@/db";import {atlasState,atlasEvents} from "@/db/schema";import {initialState,type AtlasState} from "./atlas-types";
export async function readState(userId:string){const db=getDb();const rows=await db.select().from(atlasState).where(eq(atlasState.userId,userId)).limit(1);if(rows[0])return {state:migrateState(JSON.parse(rows[0].content) as AtlasState),revision:rows[0].revision};const state=initialState();await db.insert(atlasState).values({userId,revision:0,content:JSON.stringify(state),updatedAt:new Date().toISOString()}).onConflictDoNothing();const row=await db.select().from(atlasState).where(eq(atlasState.userId,userId)).limit(1);return {state:migrateState(JSON.parse(row[0].content) as AtlasState),revision:row[0].revision};}
export async function writeEvent(userId:string,kind:string,payload:unknown){await getDb().insert(atlasEvents).values({id:crypto.randomUUID(),userId,kind,payload:JSON.stringify(payload),createdAt:new Date().toISOString()});}
export const privateHeaders={"Cache-Control":"private, no-store"};
export function allowedOrigin(request:Request){return request.headers.get("origin")===new URL(request.url).origin;}


function migrateState(state:AtlasState):AtlasState{return {...state,settings:{...state.settings,engine:state.settings.engine==="guided"?"guided":"native",web:state.settings.web===true}};}
