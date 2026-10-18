/* Templates endpoints: list, get, save, delete and validate experiment plans. */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  languageFrom,
  type SaveTemplateRequest,
  type TemplateDetail,
  type TemplateListResponse,
  type ValidatePlanRequest,
  type ValidatePlanResponse,
} from '@standard-model/contracts';
import { TemplatesService } from './templates.service.js';

const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;

@Controller('templates')
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly templates: TemplatesService) {}

  @Get()
  async list(@Query('lang') language?: string): Promise<TemplateListResponse> {
    return { templates: await this.templates.list(languageFrom(language)) };
  }

  @Post('validate')
  @HttpCode(HTTP_OK)
  validate(@Body() body: ValidatePlanRequest): ValidatePlanResponse {
    return this.templates.validate(body.plan);
  }

  @Get(':name')
  get(@Param('name') name: string, @Query('lang') language?: string): Promise<TemplateDetail> {
    return this.templates.get(name, languageFrom(language));
  }

  @Post()
  save(@Body() body: SaveTemplateRequest): Promise<TemplateDetail> {
    return this.templates.save(body.plan);
  }

  @Delete(':name')
  @HttpCode(HTTP_NO_CONTENT)
  remove(@Param('name') name: string): Promise<void> {
    return this.templates.remove(name);
  }
}
