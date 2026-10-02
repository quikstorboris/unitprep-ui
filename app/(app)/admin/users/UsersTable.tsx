"use client";

import type { Role, RoleInfo, UserSummary } from "@/lib/auth-users";
import UserRow from "./UserRow";

interface UsersTableProps {
  users: UserSummary[];
  currentUserId: string | undefined;
  pendingUserId: string | null;
  availableRoles: RoleInfo[] | null;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManagePermissions: boolean;
  onReissue: (user: UserSummary) => void;
  onRecover: (user: UserSummary) => Promise<void>;
  onDisable: (user: UserSummary) => Promise<void>;
  onReactivate: (user: UserSummary) => Promise<void>;
  onGrantRole: (user: UserSummary, role: Role) => Promise<void>;
  onRevokeRole: (user: UserSummary, role: Role) => void;
}

/** The Users table, shared by the live list and the collapsed Disabled
 * users section so the two can never drift apart in columns or row
 * behaviour. */
export default function UsersTable({
  users,
  currentUserId,
  pendingUserId,
  ...rowProps
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Last active</th>
            <th className="px-4 py-2 font-medium">Passkeys</th>
            <th className="px-4 py-2 font-medium">TOTP</th>
            <th className="px-4 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              isPending={pendingUserId === user.id}
              {...rowProps}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
