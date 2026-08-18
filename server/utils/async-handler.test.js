const { asyncHandler } = require('./async-handler');

describe('asyncHandler', () => {
  it('calls the wrapped handler with (req, res, next) and does not call next on success', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = {};
    const res = {};
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejected promise to next(error) instead of throwing', async () => {
    const error = new Error('boom');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped({}, {}, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
