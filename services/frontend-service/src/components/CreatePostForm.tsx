import React, { useState, useRef, type ChangeEvent } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '../scripts/api';
import { Button } from './Button';

export interface CreatePostFormProps {
	onPostCreated?: () => void;
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
	const [content, setContent] = useState('');
	const [mediaUrls, setMediaUrls] = useState<string[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) {
			return;
		}

		setErrorMessage(null);
		setIsUploading(true);

		try {
			for (const file of Array.from(files)) {
				const response = await api.media.upload(file);
				if (response.success && response.file) {
					setMediaUrls((prev) => [...prev, response.file!.url]);
				} else {
					setErrorMessage(
						response.errorDetails?.description || 'Failed to upload media file',
					);
				}
			}
		} catch {
			setErrorMessage('Network error while uploading file');
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleRemoveMedia = (indexToRemove: number) => {
		setMediaUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!content.trim() && mediaUrls.length === 0) {
			return;
		}

		setIsSubmitting(true);
		setErrorMessage(null);

		try {
			const response = await api.posts.create({
				content: content.trim(),
				mediaUrls,
			});

			if (response.success) {
				setContent('');
				setMediaUrls([]);
				if (onPostCreated) {
					onPostCreated();
				}
			} else {
				setErrorMessage(response.errorDetails?.description || 'Could not create post');
			}
		} catch {
			setErrorMessage('Failed to send post request');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className='flex flex-col gap-3 p-4 rounded-xl bg-surface-secondary/40 border border-border/20 w-full'>
			<form
				onSubmit={handleSubmit}
				className='flex flex-col gap-3'
			>
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="What's happening?"
					rows={3}
					className='w-full bg-transparent text-main placeholder:text-main/40 resize-none outline-none text-sm leading-relaxed p-1 border-none focus:ring-0'
				/>

				{mediaUrls.length > 0 && (
					<div className='grid grid-cols-2 gap-2 mt-1'>
						{mediaUrls.map((url, idx) => (
							<div
								key={url}
								className='relative rounded-lg overflow-hidden bg-surface border border-border/20 aspect-video'
							>
								<img
									src={url}
									alt='Attachment'
									className='w-full h-full object-cover'
								/>
								<button
									type='button'
									onClick={() => handleRemoveMedia(idx)}
									className='absolute top-2 right-2 p-1 rounded-full bg-surface/80 hover:bg-surface text-main border border-border/30 transition-colors'
								>
									<XMarkIcon className='w-4 h-4' />
								</button>
							</div>
						))}
					</div>
				)}

				{errorMessage && (
					<div className='text-xs text-red-400 bg-red-950/30 border border-red-800/40 px-3 py-2 rounded-lg'>
						{errorMessage}
					</div>
				)}

				<div className='flex items-center justify-between border-t border-border/20 pt-3'>
					<div className='flex items-center gap-2'>
						<input
							type='file'
							ref={fileInputRef}
							onChange={handleFileChange}
							multiple
							accept='image/*,video/mp4'
							className='hidden'
						/>
						<button
							type='button'
							disabled={isUploading || isSubmitting}
							onClick={() => fileInputRef.current?.click()}
							className='p-2 text-main/70 hover:text-main hover:bg-surface-secondary/60 rounded-lg transition-colors disabled:opacity-50'
						>
							<PhotoIcon className='w-5 h-5' />
						</button>
						{isUploading && (
							<span className='text-xs text-main/50 animate-pulse'>Uploading...</span>
						)}
					</div>

					<Button
						type='submit'
						disabled={
							(!content.trim() && mediaUrls.length === 0) ||
							isSubmitting ||
							isUploading
						}
					>
						{isSubmitting ? 'Posting...' : 'Post'}
					</Button>
				</div>
			</form>
		</div>
	);
}
