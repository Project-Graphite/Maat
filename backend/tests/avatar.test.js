import { describe, expect, it, vi } from 'vitest';
import User from '../models/userModel.js';
import { putAvatar, removeAvatar } from '../utils/storage.js';
import { createUser } from './helpers.js';

vi.mock('../utils/storage.js', async (original) => ({
	...(await original()),
	putAvatar: vi.fn(),
	removeAvatar: vi.fn(),
}));

const upload = (agent) =>
	agent.put('/api/v1/users/me/avatar').set('Content-Type', 'image/png').send(Buffer.from('image'));

describe('profile pictures', () => {
	it('stores every upload under a new key and deletes the previous photo', async () => {
		const { agent, user } = await createUser();
		putAvatar.mockResolvedValueOnce('avatars/a.webp').mockResolvedValueOnce('avatars/b.webp');

		await upload(agent);
		const res = await upload(agent);

		expect(res.body.data.user.photo).toBe('avatars/b.webp');
		expect(removeAvatar).toHaveBeenCalledTimes(1);
		expect(removeAvatar).toHaveBeenCalledWith('avatars/a.webp');
		expect((await User.findById(user._id)).photo).toBe('avatars/b.webp');
	});

	it('deletes the stored photo when it is removed', async () => {
		const { agent, user } = await createUser();
		putAvatar.mockResolvedValueOnce('avatars/a.webp');
		await upload(agent);

		const res = await agent.delete('/api/v1/users/me/avatar');

		expect(res.status).toBe(204);
		expect(removeAvatar).toHaveBeenCalledWith('avatars/a.webp');
		expect((await User.findById(user._id)).photo).toBeUndefined();
	});

	it('keeps the current photo when an upload is rejected', async () => {
		const { agent, user } = await createUser();
		putAvatar.mockResolvedValueOnce('avatars/a.webp');
		await upload(agent);
		putAvatar.mockRejectedValueOnce(Object.assign(new Error('Invalid or corrupted image.'), { statusCode: 400, isOperational: true, status: 'fail' }));

		const res = await upload(agent);

		expect(res.status).toBe(400);
		expect(res.body.message).toBe('Invalid or corrupted image.');
		expect(removeAvatar).not.toHaveBeenCalled();
		expect((await User.findById(user._id)).photo).toBe('avatars/a.webp');
	});
});
