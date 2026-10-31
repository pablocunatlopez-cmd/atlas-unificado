import type {Brief,StudioMode} from './scene';
export type StudioProject={id:string;title:string;mode:StudioMode;prompt:string;brief:Brief;code:string;revision:number;viewingVersion:number;createdAt:string;updatedAt:string;versions:{version:number;date:string}[]};
export type ProjectSummary=Pick<StudioProject,'id'|'title'|'mode'|'revision'|'updatedAt'>;
