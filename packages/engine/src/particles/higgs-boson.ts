/* HiggsBoson: scalar with no internal observable; its decays follow the Yukawa couplings in the catalog. */
import type { Decayable, DecayChannel } from '@standard-model/contracts';
import { Boson } from './boson.js';
import { meanLifeInSecondsFromSpec } from './capabilities.js';

export class HiggsBoson extends Boson implements Decayable {
  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays;
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }
}
