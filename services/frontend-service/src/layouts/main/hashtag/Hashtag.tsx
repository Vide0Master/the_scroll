import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeHashtag } from '@the-scroll/types';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PostList } from '../../../components/PostList';
import { api } from '../../../scripts/api';
import { usePostList } from '../../../scripts/useInfiniteList';

/** Posts carrying one hashtag, newest first. */
export default function Hashtag() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { tag: rawTag = '' } = useParams<{ tag: string }>();
	const tag = normalizeHashtag(rawTag);
	const list = usePostList(
		`hashtag:${tag ?? ''}`,
		// An invalid tag never reaches the server: there is nothing to list.
		(cursor) => (tag ? api.posts.getByHashtag(tag, cursor) : Promise.resolve({ posts: [] })),
	);

	return (
		<>
			<PageHeader
				title={`#${tag ?? rawTag}`}
				onBack={() => navigate(-1)}
			/>

			{!tag && <div className='p-8 text-center text-muted'>{t('hashtag.invalid')}</div>}

			{tag && (
				<PostList
					list={list}
					emptyText={t('hashtag.empty')}
					errorText={t('hashtag.loadError')}
				/>
			)}
		</>
	);
}
