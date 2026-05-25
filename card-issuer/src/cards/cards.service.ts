import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { EventTypes, KafkaTopics } from '../common/cloud-event';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { IssueCardRequestDto } from './dto/issue-card-request.dto';
import { IssueCardResponseDto } from './dto/issue-card-response.dto';
import { CardRequest } from './entities/card-request.entity';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(CardRequest)
    private readonly cardRequestRepo: Repository<CardRequest>,
    private readonly publisher: EventPublisherService,
  ) {}

  async issue(dto: IssueCardRequestDto): Promise<IssueCardResponseDto> {
    const existing = await this.cardRequestRepo.findOne({
      where: { documentNumber: dto.customer.documentNumber },
    });
    if (existing) {
      this.logger.warn({
        msg: 'documentNumber ya tiene una solicitud previa',
        documentNumber: dto.customer.documentNumber,
        existingRequestId: existing.requestId,
        existingStatus: existing.status,
      });
      throw new ConflictException(
        'El cliente ya tiene una solicitud de tarjeta registrada',
      );
    }

    const requestId = uuidv4();

    const entity = this.cardRequestRepo.create({
      requestId,
      documentNumber: dto.customer.documentNumber,
      fullName: dto.customer.fullName,
      email: dto.customer.email,
      age: dto.customer.age,
      productType: dto.product.type,
      productCurrency: dto.product.currency,
      forceError: dto.forceError ?? false,
      status: 'PENDING',
    });
    await this.cardRequestRepo.save(entity);

    const event = this.publisher.buildEvent(
      requestId,
      1,
      EventTypes.CARD_REQUESTED,
      {
        customer: dto.customer,
        product: dto.product,
        forceError: dto.forceError ?? false,
      },
    );

    await this.publisher.publish(KafkaTopics.CARD_REQUESTED, event);

    this.logger.log({
      msg: 'Solicitud de tarjeta registrada',
      source: requestId,
      documentNumber: dto.customer.documentNumber,
    });

    return { requestId, status: 'PENDING' };
  }
}
