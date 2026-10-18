/* Bilingual HTTP errors: a Russian and English text, or a localized engine error, becomes a Nest exception whose body carries the text for the web client. */
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { LocalizedError, localizedText, type LocalizedText } from '@standard-model/contracts';

function body(statusCode: HttpStatus, text: LocalizedText) {
  return { statusCode, message: text.en, text };
}

export function badRequest(text: LocalizedText): BadRequestException {
  return new BadRequestException(body(HttpStatus.BAD_REQUEST, text));
}

export function notFound(text: LocalizedText): NotFoundException {
  return new NotFoundException(body(HttpStatus.NOT_FOUND, text));
}

export function conflict(text: LocalizedText): ConflictException {
  return new ConflictException(body(HttpStatus.CONFLICT, text));
}

export function textOf(error: unknown): LocalizedText {
  if (error instanceof LocalizedError) {
    return error.text;
  }
  const message = error instanceof Error ? error.message : String(error);
  return localizedText(message, message);
}
