/* Gauge bosons: polarization observable (2 helicities when massless, 2j+1 states when massive) and the four carriers with their distinct couplings. */
import type {
  ColorCharged,
  ColorRepresentation,
  Decayable,
  DecayChannel,
  ElectricallyCharged,
  InteractionKind,
  Observable,
} from '@standard-model/contracts';
import { Boson } from './boson.js';
import { meanLifeInSecondsFromSpec } from './capabilities.js';

const MASSLESS_HELICITY_STATES = 2;

export abstract class GaugeBoson extends Boson {
  get isMassless(): boolean {
    return this.massInGev === 0;
  }

  override get observables(): readonly Observable[] {
    const massiveStates = Math.round(2 * this.spec.spinInReducedPlanckUnits + 1);
    return [
      {
        name: 'polarization',
        dimension: this.isMassless ? MASSLESS_HELICITY_STATES : massiveStates,
      },
    ];
  }
}

export class Photon extends GaugeBoson {
  protected override carrierInteractions(): readonly InteractionKind[] {
    return ['electromagnetic'];
  }
}

export class Gluon extends GaugeBoson implements ColorCharged {
  get colorRepresentation(): ColorRepresentation {
    return this.spec.colorRepresentation;
  }
}

export class WBoson extends GaugeBoson implements ElectricallyCharged, Decayable {
  get electricChargeInElementaryUnits(): number {
    return this.spec.electricChargeInElementaryUnits;
  }

  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays;
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }
}

export class ZBoson extends GaugeBoson implements Decayable {
  get decayChannels(): readonly DecayChannel[] {
    return this.spec.decays;
  }

  get meanLifeInSeconds(): number | null {
    return meanLifeInSecondsFromSpec(this.spec);
  }

  protected override carrierInteractions(): readonly InteractionKind[] {
    return ['weak'];
  }
}
