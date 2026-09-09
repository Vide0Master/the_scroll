import bcrypt from 'bcrypt';

export const hash = async (plainText: string) => {
	const saltRounds = 10;

	const hash = await bcrypt.hash(plainText, saltRounds);

	return hash;
};

export const compareToHash = async (plainText: string, hash: string) => {
	const isMatch = await bcrypt.compare(plainText, hash);

	return isMatch;
};
