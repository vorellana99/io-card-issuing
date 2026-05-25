import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { IssueCardDocs } from './cards.docs';
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
}
