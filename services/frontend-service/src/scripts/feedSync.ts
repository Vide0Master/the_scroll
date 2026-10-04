import { postCreated } from './events';
import { prependPost } from './useInfiniteList';

// A post the user just made goes to the top of the lists that would show it, whether or not they
// are on screen: they are kept in memory, so it is already there when the user gets to them. A
// list that was never loaded (or expired) loads fresh anyway, and the post is in it.
postCreated.on((post) => {
	prependPost('feed:forYou', post);
	prependPost(`profile:${post.authorID}:${post.parentPostID ? 'replies' : 'posts'}`, post);
});
