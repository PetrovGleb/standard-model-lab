/* Species endpoint: GET /api/species?query=Fe&kind=nucleus|atom&limit=50 searches nuclei, atoms and ions. */
import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { SpeciesKind, SpeciesSearchResponse } from '@standard-model/contracts';
import { SpeciesService } from './species.service.js';

const KINDS: readonly SpeciesKind[] = ['nucleus', 'atom'];

@Controller('species')
export class SpeciesController {
  constructor(@Inject(SpeciesService) private readonly species: SpeciesService) {}

  @Get()
  search(
    @Query('query') query = '',
    @Query('kind') kind = '',
    @Query('limit') limit = '',
  ): SpeciesSearchResponse {
    const parsedKind = KINDS.find((candidate) => candidate === kind) ?? null;
    return this.species.search(query, parsedKind, Number(limit));
  }
}
