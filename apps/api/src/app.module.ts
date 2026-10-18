/* Root NestJS module: database connection plus catalog, templates, runs, physics, species search and health endpoints. */
import { Module } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller.js';
import { CatalogService } from './catalog/catalog.service.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { PhysicsController } from './physics/physics.controller.js';
import { PhysicsService } from './physics/physics.service.js';
import { RunsController } from './runs/runs.controller.js';
import { RunsService } from './runs/runs.service.js';
import { SpeciesController } from './species/species.controller.js';
import { SpeciesService } from './species/species.service.js';
import { TemplatesController } from './templates/templates.controller.js';
import { TemplatesService } from './templates/templates.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    CatalogController,
    TemplatesController,
    RunsController,
    HealthController,
    PhysicsController,
    SpeciesController,
  ],
  providers: [CatalogService, TemplatesService, RunsService, PhysicsService, SpeciesService],
})
export class AppModule {}
