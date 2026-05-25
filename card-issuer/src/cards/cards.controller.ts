import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { GetCardStatusDocs, IssueCardDocs } from './cards.docs';
import { CardStatusResponseDto } from './dto/card-status-response.dto';
import { IssueCardRequestDto } from './dto/issue-card-request.dto';
import { IssueCardResponseDto } from './dto/issue-card-response.dto';

@ApiTags('Cards')
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post('issue')
  @HttpCode(202)
  @IssueCardDocs()
  async issue(@Body() dto: IssueCardRequestDto): Promise<IssueCardResponseDto> {
    return this.cardsService.issue(dto);
  }

  @Get(':requestId/status')
  @GetCardStatusDocs()
  async getStatus(@Param('requestId') requestId: string): Promise<CardStatusResponseDto> {
    return this.cardsService.getStatus(requestId);
  }
}
