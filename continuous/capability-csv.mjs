const MAX_TEXT=12000,MAX_ROWS=256,MAX_COLUMNS=64;
const failure=error=>({ok:false,error});
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};

export const csvTask=freeze({
 id:'csv-parse',name:'Analizar texto CSV con comillas y campos vacíos',
 task:'Implementa function transform(input) como función pura de JSON para analizar un perfil CSV acotado inspirado en RFC 4180. Entrada: objeto no nulo y no array con clave propia text de tipo cadena; delimiter es opcional, por defecto coma, y solo admite ",", ";" o tabulador "\\t" real. Salida exacta al tener éxito: {ok:true,rows:string[][]}; nunca conviertas tipos, infieras cabecera ni recortes blancos. Las filas pueden tener distintas cantidades de campos. Una marca BOM U+FEFF solo al inicio se ignora. Texto vacío o solo esa BOM produce rows:[]. Conserva campos vacíos, incluido el último tras un separador. Admite CRLF y LF como final de fila; un CR solitario fuera de comillas es inválido. El terminador final no crea una fila adicional; dos terminadores consecutivos sí representan filas vacías. Comillas dobles solo al inicio de un campo; dentro de comillas conserva exactamente comas, separadores y CR/LF, y decodifica dos comillas dobles seguidas como una. Tras cerrar comillas solo se permite separador, final de fila o fin de texto: no ignores blancos ni texto adicional. Una comilla en un campo sin comillas o sin cierre es inválida. Si input/text tienen formato incorrecto devuelve {ok:false,error:"invalid_input"}; si delimiter está presente y no es uno de los tres caracteres admitidos devuelve {ok:false,error:"invalid_delimiter"}. Tras validar tipos/separador, si text excede 12000 unidades UTF-16 devuelve {ok:false,error:"limit_exceeded"}. Como máximo 256 filas y 64 campos por fila; al excederlo durante el análisis devuelve ese mismo error. Sintaxis CSV incorrecta devuelve {ok:false,error:"invalid_csv"}. El límite de transporte JSON del ejecutor puede impedir entradas muy escapadas antes de esta función: no prometas procesar archivos ni tamaños ilimitados. Diseño orientativo y revisable: distingue inicio de campo, campo sin comillas, dentro de comillas y después del cierre. La comilla de apertura no entra en el valor y el cierre no elimina ningún dato. Al terminar una fila guarda el campo, agrega la fila completa y reinicia ambos. El estado posterior al cierre solo admite separador, fin de fila o fin de texto; una comilla doblada dentro de un campo representa un dato. Comprueba límites al agregar campos y filas, sin código inalcanzable después de continue. Tabla lógica sugerida: estado INICIO: comilla abre CITADO, separador guarda campo vacío, salto cierra fila, otro carácter inicia SIMPLE. SIMPLE: comilla es error, separador guarda campo y pasa a INICIO, salto guarda campo y fila y pasa a INICIO, otro añade dato. CITADO: comilla seguida de comilla añade una y avanza dos; otra comilla pasa a CERRADO; los demás caracteres, incluso CR/LF, son datos. CERRADO: solo separador, salto o fin son válidos; separador guarda campo y vuelve a INICIO; salto guarda campo y fila y vuelve a INICIO. CRLF fuera de CITADO es un único salto. Al guardar una fila: añadir el campo actual, guardar la fila completa y reiniciar fila/campo. EOF en CITADO es error; en otros estados guardar campo/fila salvo si acaba de consumirse un salto final. Nunca busques comillas en el valor ya decodificado para decidir validez: una comilla escapada es un dato válido. No imports, exports, red, archivos, procesos, relojes ni mutación de la entrada. Devuelve únicamente el código JavaScript completo. Referencia del formato: https://www.rfc-editor.org/rfc/rfc4180.html; este perfil define deliberadamente separadores adicionales, LF y límites propios de Atlas.',
 learningPlan:{
  hypothesis:'Un analizador por estados distingue campos, comillas y finales de fila sin confundir CSV con una división por comas.',
  refutations:['Un campo entre comillas puede contener el separador, saltos de línea y comillas dobladas.','Los campos vacíos y los blancos son datos, no ruido que recortar.','Comillas mal cerradas, delimitadores desconocidos y presupuestos excedidos deben producir errores tipados.'],
  evidence:'Contrastar ocho casos externos y conservar refutaciones; los experimentos amplían entradas del mismo perfil, sin acreditar todo CSV existente.',
  scope:'Analiza texto JSON ya disponible dentro de presupuestos; no lee archivos ni cambia pesos, servidor o permisos.'
 },
 acceptanceTests:[
  {input:{text:''},expected:{ok:true,rows:[]}},
  {input:{text:'\uFEFFname,note\r\nAtlas,"dice ""hola"""\r\n'},expected:{ok:true,rows:[['name','note'],['Atlas','dice "hola"']]}},
  {input:{text:'"a;b";"dos\r\nlíneas";\n x ;"";final',delimiter:';'},expected:{ok:true,rows:[['a;b','dos\r\nlíneas',''],[' x ','','final']]}},
  {input:{text:'a\t"b\tc"\t\n\n',delimiter:'\t'},expected:{ok:true,rows:[['a','b\tc',''],['']]}},
  {input:{text:'sin"comillas,x'},expected:{ok:false,error:'invalid_csv'}},
  {input:{text:'"sin cierre'},expected:{ok:false,error:'invalid_csv'}},
  {input:{text:'a|b',delimiter:'|'},expected:{ok:false,error:'invalid_delimiter'}},
  {input:{text:7},expected:{ok:false,error:'invalid_input'}}
 ]
});

/** Independent application oracle. A finite-state parser over already supplied
 * JSON data; it does not execute model code or infer truth from a model verdict. */
export function csvOracle(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(input,'text')||typeof input.text!=='string')return failure('invalid_input');
 const delimiter=Object.hasOwn(input,'delimiter')?input.delimiter:',';
 if(![',',';','\t'].includes(delimiter))return failure('invalid_delimiter');
 if(input.text.length>MAX_TEXT)return failure('limit_exceeded');
 const value=input.text.startsWith('\uFEFF')?input.text.slice(1):input.text;
 if(!value.length)return {ok:true,rows:[]};
 const rows=[];let row=[],field='',mode='start',endedRow=false;
 const addField=()=>{row.push(field);field='';return row.length<=MAX_COLUMNS;};
 const addRow=()=>{if(!addField())return false;rows.push(row);row=[];return rows.length<=MAX_ROWS;};
 for(let index=0;index<value.length;index++){
  const character=value[index];endedRow=false;
  if(mode==='quoted'){
   if(character==='"'){
    if(value[index+1]==='"'){field+='"';index++;}else mode='closed';
   }else field+=character;
   continue;
  }
  if(character===delimiter){if(!addField())return failure('limit_exceeded');mode='start';continue;}
  if(character==='\n'||character==='\r'){
   if(character==='\r'){if(value[index+1]!=='\n')return failure('invalid_csv');index++;}
   if(!addRow())return failure('limit_exceeded');mode='start';endedRow=true;continue;
  }
  if(mode==='closed')return failure('invalid_csv');
  if(character==='"'){if(mode!=='start')return failure('invalid_csv');mode='quoted';continue;}
  field+=character;mode='plain';
 }
 if(mode==='quoted')return failure('invalid_csv');
 if(!endedRow&&!addRow())return failure('limit_exceeded');
 return {ok:true,rows};
}

const encode=(rows,delimiter,newline)=>rows.map(row=>row.map(field=>/["\r\n]/.test(field)||field.includes(delimiter)?'"'+field.replaceAll('"','""')+'"':field).join(delimiter)).join(newline);

/** Eight deterministic inputs for the same reviewed profile. Different seeds
 * change examples, not the coverage class or evidence-of-improvement rules. */
export function generateCsvCases(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('La semilla CSV debe ser uint32.');
 let state=seed>>>0;
 const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 const label='Atlas-'+next().toString(16),number=String(next()%1000);
 return [
  {text:'\uFEFF'+encode([['id','nota',''],[label,'coma, comillas " y Ω',number],['',' fin ','']],',','\r\n')+'\r\n'},
  {text:encode([[label,'salto\ninterior','punto;y coma'],['"','\r\n','']],';','\n'),delimiter:';'},
  {text:encode([['  '+label,'tab\tinterior',''],['0','false','null']],'\t','\r\n'),delimiter:'\t'},
  {text:'"sin cierre '+label+'\n'+number},
  {text:'"'+label+'" fuera,'+number},
  {text:label+'\r'+number},
  seed%2?{text:label,delimiter:'|'}:{text:[label,number]},
  seed%2?{text:Array.from({length:MAX_COLUMNS+1},()=>label).join(',')}:{text:Array.from({length:MAX_ROWS+1},()=>number).join('\n')}
 ];
}
