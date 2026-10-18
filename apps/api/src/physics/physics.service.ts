/* PhysicsService: serves the Standard Model Lagrangian with its derived Feynman rules and computes tree-level cross sections and widths through the engine's process calculator. */
import { Injectable } from '@nestjs/common';
import {
  COUPLING_SCHEMES,
  describeProcessRequestErrors,
  validateProcessRequest,
  type CouplingScheme,
  type LagrangianResponse,
  type ProcessResult,
} from '@standard-model/contracts';
import { localizedText, PARTICLE_NAMES, type ParticleName } from '@standard-model/contracts';
import { candidateChannels, ProcessError, SHARED_PROCESS_CALCULATOR } from '@standard-model/engine';
import { badRequest } from '../http-errors.js';

@Injectable()
export class PhysicsService {
  lagrangian(scheme: string | undefined, scale: string | undefined): LagrangianResponse {
    const chosen = (COUPLING_SCHEMES as readonly string[]).includes(scheme ?? '')
      ? (scheme as CouplingScheme)
      : 'fermiConstant';
    const scaleInGev = scale === undefined ? null : Number(scale);
    if (scaleInGev !== null && !(scaleInGev >= 0)) {
      throw badRequest(
        localizedText(
          'масштаб должен быть неотрицательной энергией в ГэВ',
          'scale must be a non-negative energy in GeV',
        ),
      );
    }
    return SHARED_PROCESS_CALCULATOR.lagrangian(chosen, scaleInGev);
  }

  calculate(body: unknown): ProcessResult {
    if (!validateProcessRequest(body)) {
      throw badRequest(
        localizedText(
          `некорректный запрос процесса: ${describeProcessRequestErrors()}`,
          describeProcessRequestErrors(),
        ),
      );
    }
    try {
      return SHARED_PROCESS_CALCULATOR.calculate(body);
    } catch (error) {
      if (error instanceof ProcessError) {
        throw badRequest(error.text);
      }
      throw error;
    }
  }

  channels(first: string | undefined, second: string | undefined): readonly string[] {
    const known = (name: string | undefined): name is ParticleName =>
      name !== undefined && (PARTICLE_NAMES as readonly string[]).includes(name);
    if (!known(first) || !known(second)) {
      throw badRequest(
        localizedText(
          'first и second должны быть именами частиц',
          'first and second must be particle names',
        ),
      );
    }
    return candidateChannels(first, second);
  }
}
