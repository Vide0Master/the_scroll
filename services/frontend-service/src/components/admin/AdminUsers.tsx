import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	BAN_REASON_MAX_LENGTH,
	USER_ROLES,
	type AdminUser,
	type UserRole,
} from '@the-scroll/types';
import { Avatar } from '../../elements/Avatar';
import { Button } from '../../elements/Button';
import { TextInput } from '../../elements/TextInput';
import { useCurrentUser } from '../../providers/AuthContext';
import { useToast } from '../../providers/ToastContext';
import { api } from '../../scripts/api';
import { profilePath } from '../../scripts/routes';
import { Popup } from '../Popup';

export interface AdminUsersProps {
	/** Only blocked accounts (the "Blocked" tab). */
	onlyBanned?: boolean;
}

/** Search and moderation of accounts: block or unblock, and (admins only) set roles. */
export function AdminUsers({ onlyBanned = false }: AdminUsersProps) {
	const { t, i18n } = useTranslation();
	const { show } = useToast();
	const { user: me } = useCurrentUser();
	const isAdmin = me?.roles.includes('ADMIN') ?? false;
	const [query, setQuery] = useState('');
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [hasError, setHasError] = useState(false);
	// Bumped after a change so the list reloads from the server.
	const [version, setVersion] = useState(0);
	const [target, setTarget] = useState<AdminUser | null>(null);
	const [reason, setReason] = useState('');
	const [isWorking, setIsWorking] = useState(false);
	const [actionFailed, setActionFailed] = useState(false);

	useEffect(() => {
		let isActive = true;
		// Waits for a pause in typing so each keystroke doesn't send a request.
		const timer = setTimeout(() => {
			api.admin
				.users(query.trim(), onlyBanned)
				.then((response) => {
					if (isActive) {
						setUsers(response.users);
						setHasError(false);
					}
				})
				.catch(() => isActive && setHasError(true));
		}, 200);

		return () => {
			isActive = false;
			clearTimeout(timer);
		};
	}, [query, onlyBanned, version]);

	const closeDialog = () => {
		setTarget(null);
		setReason('');
		setActionFailed(false);
	};

	const confirm = async () => {
		if (!target) {
			return;
		}

		setIsWorking(true);
		setActionFailed(false);

		try {
			const wasBanned = target.isBanned;
			await (wasBanned
				? api.admin.unban(target.userName)
				: api.admin.ban(target.userName, reason.trim()));
			show({
				kind: 'success',
				message: t(wasBanned ? 'toast.unbanned' : 'toast.banned', {
					name: target.userName,
				}),
			});
			closeDialog();
			setVersion((current) => current + 1);
		} catch {
			setActionFailed(true);
		} finally {
			setIsWorking(false);
		}
	};

	const toggleRole = async (account: AdminUser, role: UserRole) => {
		const roles = account.roles.includes(role)
			? account.roles.filter((existing) => existing !== role)
			: [...account.roles, role];

		try {
			await api.users.setRoles(account.userName, roles);
			show({ kind: 'success', message: t('toast.rolesSaved', { name: account.userName }) });
			setVersion((current) => current + 1);
		} catch {
			setHasError(true);
		}
	};

	const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

	return (
		<>
			<div className='p-4 border-b border-line'>
				<TextInput
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t(
						isAdmin ? 'admin.searchPlaceholderAdmin' : 'admin.searchPlaceholder',
					)}
				/>
			</div>

			{hasError && <div className='p-4 text-sm text-red-500'>{t('admin.loadError')}</div>}

			{users?.length === 0 && (
				<div className='p-8 text-center text-sm text-muted'>{t('admin.empty')}</div>
			)}

			{users?.map((account) => {
				// The same rules the server enforces, so a button is only shown when it can work.
				const canAct =
					account.userID !== me?.userID &&
					!account.roles.includes('ADMIN') &&
					(!account.roles.includes('MODERATOR') || isAdmin);

				return (
					<div
						key={account.userID}
						className='flex flex-col gap-2 px-4 py-3 border-b border-line'
					>
						<div className='flex items-center gap-3 min-w-0'>
							<Avatar
								name={account.visibleName || account.userName}
								src={account.avatarUrl}
							/>
							<div className='flex flex-col min-w-0 leading-tight font-mono text-xs'>
								<Link
									to={profilePath(account.userName)}
									className='font-semibold uppercase tracking-wide truncate hover:underline'
								>
									{account.visibleName || account.userName}
								</Link>
								<span className='text-muted truncate'>@{account.userName}</span>
								{account.email && (
									<span className='text-muted truncate'>{account.email}</span>
								)}
							</div>
							{canAct && (
								<Button
									onClick={() => setTarget(account)}
									className='ml-auto shrink-0'
								>
									{t(account.isBanned ? 'admin.unban' : 'admin.ban')}
								</Button>
							)}
						</div>

						{account.isBanned && account.bannedAt && (
							<div className='font-mono text-xs text-red-500'>
								{t('admin.blockedOn', { date: formatDate(account.bannedAt) })}
								{account.banReason &&
									` · ${t('admin.reason', { reason: account.banReason })}`}
							</div>
						)}

						{isAdmin && account.userID !== me?.userID && (
							<div className='flex items-center gap-4 font-mono text-xs text-muted'>
								<span>{t('admin.rolesLabel')}</span>
								{USER_ROLES.map((role) => (
									<label
										key={role}
										className='flex items-center gap-1 cursor-pointer'
									>
										<input
											type='checkbox'
											checked={account.roles.includes(role)}
											onChange={() => toggleRole(account, role)}
										/>
										{t(`roles.${role.toLowerCase()}`)}
									</label>
								))}
							</div>
						)}
					</div>
				);
			})}

			<Popup
				isOpen={target !== null}
				onClose={closeDialog}
				title={t(target?.isBanned ? 'admin.unbanTitle' : 'admin.banTitle', {
					name: target?.userName,
				})}
				footer={
					<>
						<Button
							type='button'
							onClick={closeDialog}
						>
							{t('admin.cancel')}
						</Button>
						<Button
							type='button'
							disabled={isWorking}
							onClick={confirm}
						>
							{t(target?.isBanned ? 'admin.unbanConfirm' : 'admin.banConfirm')}
						</Button>
					</>
				}
			>
				<p className='text-sm text-muted'>
					{t(target?.isBanned ? 'admin.unbanHint' : 'admin.banHint')}
				</p>
				{!target?.isBanned && (
					<TextInput
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						maxLength={BAN_REASON_MAX_LENGTH}
						placeholder={t('admin.banReason')}
						className='mt-3'
					/>
				)}
				{actionFailed && (
					<p className='mt-2 text-sm text-red-500'>{t('admin.actionError')}</p>
				)}
			</Popup>
		</>
	);
}
