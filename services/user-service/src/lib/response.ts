export function failResponse(code: string, description: string) {
	return {
		success: false as const,
		errorDetails: {
			code,
			description,
		},
	};
}

export function okResponse<T extends object>(data?: T) {
	return {
		success: true as const,
		...data,
	};
}
