export type ColabauthTenantStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'inactive';

export type ColabauthMemberRole = 'admin' | 'member';

export type ColabauthTenantMember = {
  workosUserId: string | null;
  email: string;
  role: ColabauthMemberRole;
};

export type ColabauthTenant = {
  id: string;
  name: string;
  slug: string;
  url: string;
  status: ColabauthTenantStatus;
  workosOrganizationId: string | null;
  members: ColabauthTenantMember[];
};

export type ColabauthMembershipAction =
  | 'created'
  | 'updated'
  | 'removed'
  | 'noop'
  | 'pending';

export type ColabauthMembershipSyncResult = {
  action: ColabauthMembershipAction;
  role: ColabauthMemberRole | null;
};
