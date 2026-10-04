import { SearchBox } from '../SearchBox';
import { TrendsCard } from '../widgets/TrendsCard';
import { WhoToFollowCard } from '../widgets/WhoToFollowCard';

export function LeftColumn() {
	return (
		<aside className='hidden lg:flex flex-col gap-4 w-[350px] shrink-0 px-4 py-2 sticky top-0 h-screen overflow-y-auto'>
			<SearchBox />
			<TrendsCard />
			<WhoToFollowCard />
		</aside>
	);
}
