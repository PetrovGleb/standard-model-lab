/* Baryon: three-quark composite from the nucleons to Λb, with measured magnetic dipole where CODATA has one, PDG decays, and weak decays of charm and bottom baryons from the spectator model. */
import type { Decayable, DecayChannel, MagneticDipole } from '@standard-model/contracts';
import { spectatorChannels } from '../decay/spectator.js';
import { gyromagneticRatioFromMoment, meanLifeInSecondsFromSpec } from './capabilities.js';
import { CompositeParticle } from './composite-particle.js';

export class Baryon extends CompositeParticle implements MagneticDipole, Decayable {
  get magneticMomentInJoulesPerTesla(): number {
    const moment = this.spec.magneticMomentInJoulesPerTesla;
    if (moment === null) {
      throw new Error(`${this.spec.name} has no measured magnetic moment`);
    }
    return moment.value;
  }

  get gyromagneticRatioInRadiansPerSecondPerTesla(): number {
    return gyromagneticRatioFromMoment(
      this.magneticMomentInJoulesPerTesla,
      this.spec.spinInReducedPlanckUnits,
    );
  }

  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays.length > 0 ? this.spec.decays : spectatorChannels(this.spec);
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }
}
