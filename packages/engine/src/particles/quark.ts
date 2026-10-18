/* Quark: color-charged fermion; confined unless it decays faster than hadronization, which only the top does. */
import { PDG_2026 } from '@standard-model/constants';
import type {
  ColorCharged,
  ColorRepresentation,
  Decayable,
  DecayChannel,
  ElectricallyCharged,
} from '@standard-model/contracts';
import { widthInGevToMeanLifeInSeconds } from '@standard-model/utils';
import { meanLifeInSecondsFromSpec } from './capabilities.js';
import { Fermion } from './fermion.js';

const HADRONIZATION_TIME_IN_SECONDS = widthInGevToMeanLifeInSeconds(
  PDG_2026.couplings.qcdScaleInGev.value,
);

export class Quark extends Fermion implements ColorCharged, ElectricallyCharged, Decayable {
  get colorRepresentation(): ColorRepresentation {
    return this.spec.colorRepresentation;
  }

  get electricChargeInElementaryUnits(): number {
    return this.spec.electricChargeInElementaryUnits;
  }

  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays;
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }

  get isConfined(): boolean {
    const meanLife = this.meanLifeInSeconds;
    return meanLife === null || meanLife > HADRONIZATION_TIME_IN_SECONDS;
  }
}
