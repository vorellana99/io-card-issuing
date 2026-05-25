import { CardsController } from '../src/cards/cards.controller';
import { IssueCardRequestDto } from '../src/cards/dto/issue-card-request.dto';

function makeService() {
  return {
    issue: jest.fn(),
    getStatus: jest.fn(),
  };
}

function validDto(): IssueCardRequestDto {
  return {
    customer: {
      documentType: 'DNI',
      documentNumber: '11564321',
      fullName: 'Jose Pérez',
      age: 25,
      email: 'joseperez@example.com',
    },
    product: { type: 'VISA', currency: 'PEN' },
    forceError: false,
  } as IssueCardRequestDto;
}

describe('CardsController', () => {
  describe('issue', () => {
    it('delega al servicio y retorna su resultado', async () => {
      const service = makeService();
      const expected = { requestId: 'uuid-123', status: 'PENDING' as const };
      service.issue.mockResolvedValue(expected);
      const controller = new CardsController(service as any);

      const result = await controller.issue(validDto());

      expect(service.issue).toHaveBeenCalledWith(validDto());
      expect(result).toEqual(expected);
    });

    it('propagasla excepción del servicio', async () => {
      const service = makeService();
      service.issue.mockRejectedValue(new Error('conflict'));
      const controller = new CardsController(service as any);

      await expect(controller.issue(validDto())).rejects.toThrow('conflict');
    });
  });

  describe('getStatus', () => {
    it('delega al servicio con el requestId y retorna su resultado', async () => {
      const service = makeService();
      const expected = { requestId: 'uuid-123', status: 'ISSUED' as const, updatedAt: new Date() };
      service.getStatus.mockResolvedValue(expected);
      const controller = new CardsController(service as any);

      const result = await controller.getStatus('uuid-123');

      expect(service.getStatus).toHaveBeenCalledWith('uuid-123');
      expect(result).toEqual(expected);
    });

    it('propaga la excepción del servicio (ej. 404)', async () => {
      const service = makeService();
      service.getStatus.mockRejectedValue(new Error('not found'));
      const controller = new CardsController(service as any);

      await expect(controller.getStatus('no-existe')).rejects.toThrow('not found');
    });
  });
});
