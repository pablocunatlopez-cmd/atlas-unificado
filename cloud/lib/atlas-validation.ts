import {z} from "zod";import type {MemoryScope} from "./atlas-types";import {isMemoryScope} from "./core/memory-scopes.mjs";const short=z.string().max(6000);const id=z.string().max(100);const date=z.string().max(50);
const domain=z.enum(["general","salud","dinero","relaciones","trabajo","aprendizaje","creatividad","sentido"]);
export const replySchema=z.object({answer:z.string().max(20000),basis:short,confidence:z.enum(["Limitada","Razonable","Alta"]),claims:z.array(z.object({label:short,text:short,why:short})).max(12),unknowns:z.array(short).max(12),nextSteps:z.array(short).max(12),wouldChange:short,frame:z.object({object:short,environment:short,perspective:short,scale:short}),semiosis:z.object({object:short,sign:short,interpretant:short}),triangle:z.object({center:short,animal:short,mind:short,event:short}),sources:z.array(z.object({title:short,url:z.string().max(2000),kind:short})).max(30),engine:z.enum(["native","ai","guided"]),searched:z.boolean()});
export const stateSchema=z.object({
 threads:z.array(z.object({id,title:z.string().max(150),domain,date,messages:z.array(z.object({id,role:z.enum(["user","assistant"]),text:z.string().max(20000),date,reply:replySchema.optional(),disputed:z.boolean().optional()})).max(150)})).max(100),
 memories:z.array(z.object({id,title:z.string().max(180),text:short,kind:z.enum(["Preferencia","Contexto","Objetivo","Regla"]),domain,scope:z.custom<MemoryScope>(value=>isMemoryScope(value)).optional(),status:z.enum(["Aportado","Por revisar","Confirmado","Retirado"]),date,versions:z.array(z.object({text:short,date,reason:short})).max(50)})).max(200),
 decisions:z.array(z.object({id,title:z.string().max(180),domain,options:short,known:short,unknown:short,criterion:short,action:short,review:date,outcome:short,status:z.enum(["Abierta","En prueba","Revisada"]),date})).max(200),
 corrections:z.array(z.object({id,before:short,after:short,reason:short,date,messageId:id.optional()})).max(300),
 checkins:z.array(z.object({id,date,energy:z.number().int().min(1).max(5),note:short,next:short})).max(400),
 settings:z.object({name:z.string().min(1).max(100),web:z.boolean(),deep:z.boolean(),engine:z.enum(["native","ai","guided"])})
});
export const chatSchema=z.object({text:z.string().min(1).max(8000),domain,engine:z.enum(["native","ai","guided"]),web:z.boolean(),history:z.array(z.object({role:z.enum(["user","assistant"]),text:z.string().max(20000)})).max(20)});

