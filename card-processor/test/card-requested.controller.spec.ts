import { CardRequestedController } from '../src/consumer/card-requested.controller';

function makeIssuance() {
  return { handle: jest.fn(async () => undefined) };
}

function envelope(source: string) {
  return { id: 1, source, type: 'io.card.requested.v1', data: { customer: {}, product: {} } };
}

describe('CardRequestedController', () => {
  describe('onCardRequested', () => {
    it('llama issuance.handle con source y data cuando el envelope es válido', async () => {
      const issuance = makeIssuance();
      const controller = new CardRequestedController(issuance as any);

      await controller.onCardRequested(envelope('req-abc'));

      expect(issuance.handle).toHaveBeenCalledWith('req-abc', expect.objectContaining({ customer: {} }));
    });

    it('parsea el envelope cuando llega como string JSON', async () => {
      const issuance = makeIssuance();
      const controller = new CardRequestedController(issuance as any);

      await controller.onCardRequested(JSON.stringify(envelope('req-str')));

      expect(issuance.handle).toHaveBeenCalledWith('req-str', expect.any(Object));
    });

    it('descarta sin lanzar si el envelope es null', async () => {
      const issuance = makeIssuance();
      const controller = new CardRequestedController(issuance as any);

      await expect(controller.onCardRequested(null)).resolves.toBeUndefined();
      expect(issuance.handle).not.toHaveBeenCalled();
    });

    it('descarta sin lanzar si el string no es JSON válido', async () => {
      const issuance = makeIssuance();
      const controller = new CardRequestedController(issuance as any);

      await expect(controller.onCardRequested('no-es-json{')).resolves.toBeUndefined();
      expect(issuance.handle).not.toHaveBeenCalled();
    });

    it('descarta sin lanzar si el objeto no tiene la propiedad data', async () => {
      const issuance = makeIssuance();
      const controller = new CardRequestedController(issuance as any);

      await expect(controller.onCardRequested({ source: 'x' })).resolves.toBeUndefined();
      expect(issuance.handle).not.toHaveBeenCalled();
    });

    it('no relanza si issuance.handle falla con Error', async () => {
      const issuance = makeIssuance();
      issuance.handle.mockRejectedValueOnce(new Error('unexpected'));
      const controller = new CardRequestedController(issuance as any);

      await expect(controller.onCardRequested(envelope('req-err'))).resolves.toBeUndefined();
    });

    it('no relanza si issuance.handle falla con valor no-Error', async () => {
      const issuance = makeIssuance();
      issuance.handle.mockRejectedValueOnce('string error');
      const controller = new CardRequestedController(issuance as any);

      await expect(controller.onCardRequested(envelope('req-err-str'))).resolves.toBeUndefined();
    });
  });
});
