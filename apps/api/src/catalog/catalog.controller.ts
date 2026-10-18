/* Catalog endpoints: GET /api/catalog and GET /api/catalog/nuclides/:protons with the measured NUBASE2020 nuclides of one element. */
import { BadRequestException, Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import type { CatalogResponse, NuclideEntry } from '@standard-model/contracts';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get()
  get(): CatalogResponse {
    return this.catalog.catalog();
  }

  @Get('nuclides/:protons')
  nuclides(@Param('protons', ParseIntPipe) protons: number): readonly NuclideEntry[] {
    if (!this.catalog.catalog().elements.some((element) => element.protons === protons)) {
      throw new BadRequestException(`no element with ${String(protons)} protons`);
    }
    return this.catalog.nuclides(protons);
  }
}
