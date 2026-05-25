import { CardEventsController } from '../src/consumer/card-events.controller';
import { KafkaTopics } from '../src/common/cloud-event';

function makeService() {
  return {
    updateStatus: jest.fn(async () => undefined),
  };
}

function envelope(source: string) {
  return { id: 2, source, type: 'test', data: {} };
}

describe('CardEventsController', () => {
  describe('onCardIssued', () => {
    it('llama updateStatus con ISSUED cuando el envelope es válido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await controller.onCardIssued(envelope('req-abc'));

      expect(service.updateStatus).toHaveBeenCalledWith('req-abc', 'ISSUED');
    });

    it('llama updateStatus cuando el payload llega como string JSON', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await controller.onCardIssued(JSON.stringify(envelope('req-str')));

      expect(service.updateStatus).toHaveBeenCalledWith('req-str', 'ISSUED');
    });

    it('descarta el mensaje sin lanzar si el envelope es inválido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardIssued(null)).resolves.toBeUndefined();
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('descarta el mensaje sin lanzar si el string no es JSON válido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardIssued('no-es-json{')).resolves.toBeUndefined();
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('no relanza si updateStatus falla con Error', async () => {
      const service = makeService();
      service.updateStatus.mockRejectedValueOnce(new Error('db error'));
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardIssued(envelope('req-err'))).resolves.toBeUndefined();
    });

    it('no relanza si updateStatus falla con valor no-Error', async () => {
      const service = makeService();
      service.updateStatus.mockRejectedValueOnce('string error');
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardIssued(envelope('req-err-str'))).resolves.toBeUndefined();
    });
  });

  describe('onCardDlq', () => {
    it('llama updateStatus con FAILED cuando el envelope es válido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await controller.onCardDlq(envelope('req-dlq'));

      expect(service.updateStatus).toHaveBeenCalledWith('req-dlq', 'FAILED');
    });

    it('descarta el mensaje sin lanzar si el envelope es inválido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardDlq(undefined)).resolves.toBeUndefined();
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('descarta el mensaje sin lanzar si el string no es JSON válido', async () => {
      const service = makeService();
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardDlq('no-es-json{')).resolves.toBeUndefined();
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('no relanza si updateStatus falla con Error', async () => {
      const service = makeService();
      service.updateStatus.mockRejectedValueOnce(new Error('db error'));
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardDlq(envelope('req-dlq-err'))).resolves.toBeUndefined();
    });

    it('no relanza si updateStatus falla con valor no-Error', async () => {
      const service = makeService();
      service.updateStatus.mockRejectedValueOnce('string error');
      const controller = new CardEventsController(service as any);

      await expect(controller.onCardDlq(envelope('req-dlq-str'))).resolves.toBeUndefined();
    });
  });

  it('los topics registrados coinciden con KafkaTopics', () => {
    expect(KafkaTopics.CARD_ISSUED).toBe('io.cards.issued.v1');
    expect(KafkaTopics.CARD_REQUESTED_DLQ).toBe('io.card.requested.v1.dlq');
  });
});
