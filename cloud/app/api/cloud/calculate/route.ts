import {arithmeticRequest,ARITHMETIC_VERSION} from '@/lib/cloud/arithmetic';
import {cloudJson} from '@/lib/cloud/http';
export const dynamic='force-dynamic';
// Read-only bounded computation. Sites' owner-private boundary applies; no history or secrets are read.
export function GET(request:Request){
 const question=new URL(request.url).searchParams.get('expression')||'';
 const result=arithmeticRequest('Calcula '+question);
 return result?cloudJson({tool:ARITHMETIC_VERSION,...result},result.error?400:200):cloudJson({tool:ARITHMETIC_VERSION,error:'Expresión aritmética no admitida.'},400);
}
