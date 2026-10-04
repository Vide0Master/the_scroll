import { Outlet } from 'react-router-dom';

/** Frame of the settings pages: the menu at `/settings`, each section at `/settings/<section>`. */
export default function Settings() {
	return <Outlet />;
}
