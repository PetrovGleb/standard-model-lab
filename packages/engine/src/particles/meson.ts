/* Meson: quark–antiquark composite; strong and electromagnetic decays come from the PDG tables, weak decays of charm and bottom mesons from the spectator model. */
import type { Decayable, DecayChannel } from '@standard-model/contracts';
import { spectatorChannels } from '../decay/spectator.js';
import { meanLifeInSecondsFromSpec } from './capabilities.js';
import { CompositeParticle } from './composite-particle.js';

export class Meson extends CompositeParticle implements Decayable {
  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays.length > 0 ? this.spec.decays : spectatorChannels(this.spec);
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }
}
