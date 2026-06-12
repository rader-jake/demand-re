import { normalizeMetaCsvRows } from '../utils/metaCsvHelper';

const csv = `full_name,email,phone_number
Jacob Rader,rader98jacob@gmail.com,+15164049212`;

const res = normalizeMetaCsvRows(csv);
console.log('Parsed row:', res[0]);
