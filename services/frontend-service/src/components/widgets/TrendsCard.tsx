import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { hashtagPath } from '../../scripts/routes';
import { useTrending } from '../../scripts/useTrending';

/** Hashtags whose posts got the most likes and replies in the last days. Hidden while empty. */
export function TrendsCard() {
	const { t } = useTranslation();
	const { tags } = useTrending();

	if (tags.length === 0) {
		return null;
	}

	return (
		<section className='border border-line bg-surface overflow-hidden'>
			<h2 className='px-4 py-3 border-b border-line font-mono text-xs uppercase tracking-widest text-muted'>
				{t('widgets.trendsTitle')}
			</h2>
			<ul className='divide-y divide-line'>
				{tags.map(({ tag, score }) => (
					<li key={tag}>
						<Link
							to={hashtagPath(tag)}
							className='flex items-baseline justify-between gap-2 px-4 py-3 hover:bg-hover'
						>
							<span className='font-mono text-sm font-semibold truncate'>#{tag}</span>
							<span className='shrink-0 font-mono text-xs text-muted'>
								{t('widgets.reactions', { count: score })}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
