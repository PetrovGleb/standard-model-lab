/* Downloads the ENDF/B-VIII.0 neutron and neutron fission yield sublibraries verbatim from the NNDC into data/endf; the archives stay out of git for their size, and generate-endf turns them into data/endf.generated.json. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'endf');
const ARCHIVES = ['ENDF-B-VIII.0_neutrons.zip', 'ENDF-B-VIII.0_nfy.zip'];
const BASE_URL = 'https://www.nndc.bnl.gov/endf-b8.0/zips/';

mkdirSync(target, { recursive: true });
for (const archive of ARCHIVES) {
  const response = await fetch(`${BASE_URL}${archive}`);
  if (!response.ok) {
    throw new Error(`${archive}: HTTP ${String(response.status)}`);
  }
  writeFileSync(join(target, archive), Buffer.from(await response.arrayBuffer()));
  console.log(`saved ${archive}`);
}
