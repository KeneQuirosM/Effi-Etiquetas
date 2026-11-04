// Quita los datos personales de un export de corte para usarlo como fixture
// de las pruebas: deja vacías las columnas de remitente/destinatario y las
// notas, y conserva todo lo que usa el cálculo (con sus tipos: la guía
// sigue siendo texto si venía como texto).
//   node tests/anonimizar.mjs <entrada.xlsx> <salida.xlsx> [nombre de hoja]
import XLSX from 'xlsx';

const [entrada, salida, hoja] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error('Uso: node tests/anonimizar.mjs <entrada.xlsx> <salida.xlsx> [hoja]');
  process.exit(1);
}
const BORRAR = [
  'ID. remitente', 'Dirección remitente', 'Teléfonos remitente',
  'Destinatario', 'ID. destinatario', 'Dirección destinatario', 'Teléfonos destinatario',
  'Observación', 'Nota guía', 'Observación transacción', 'Documento', 'ID guía'
];
const wb = XLSX.readFile(entrada, { cellDates: true });
const nombre = hoja || wb.SheetNames[0];
const ws = wb.Sheets[nombre];
if (!ws) { console.error(`No existe la hoja "${nombre}"`); process.exit(1); }
const rango = XLSX.utils.decode_range(ws['!ref']);
let ultimaCol = rango.e.c;
for (let c = rango.s.c; c <= rango.e.c; c++) {
  const enc = ws[XLSX.utils.encode_cell({ r: 0, c })];
  const t = String(enc?.v ?? '').trim();
  if (t === 'Fecha de anulación transacción') ultimaCol = c;   // lo de la derecha son fórmulas de la hoja
  if (!BORRAR.includes(t)) continue;
  for (let r = 1; r <= rango.e.r; r++) delete ws[XLSX.utils.encode_cell({ r, c })];
}
// Solo A:AH (el export); sin fórmulas ni columnas calculadas de la hoja
for (const ref of Object.keys(ws)) {
  if (ref[0] === '!') continue;
  const { c } = XLSX.utils.decode_cell(ref);
  if (c > ultimaCol) delete ws[ref];
  else if (ws[ref].f) delete ws[ref].f;
}
rango.e.c = ultimaCol;
ws['!ref'] = XLSX.utils.encode_range(rango);
const out = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(out, ws, 'Worksheet');
XLSX.writeFile(out, salida);
console.log(`Listo: ${salida} (${rango.e.r} filas)`);
