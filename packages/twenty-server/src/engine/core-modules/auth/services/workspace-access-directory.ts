export type DirectoryUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isEmailVerified: boolean;
};

export type DirectoryMembership = {
  organizationId: string;
  roleSlug: string | null;
  isActive: boolean;
};

export type DirectoryOrganizationMember = {
  directoryUserId: string;
  roleSlug: string | null;
  isActive: boolean;
};

// The identity provider that decides who belongs to which workspace. WorkOS
// implements it today; the ColabAuth service will replace that implementation.
export abstract class WorkspaceAccessDirectory {
  abstract isEnabled(): boolean;

  abstract findUser(directoryUserId: string): Promise<DirectoryUser | null>;

  abstract findUserByEmail(email: string): Promise<DirectoryUser | null>;

  abstract listMemberships(
    directoryUserId: string,
  ): Promise<DirectoryMembership[]>;

  abstract listOrganizationMembers(
    organizationId: string,
  ): Promise<DirectoryOrganizationMember[]>;

  abstract findWorkspaceIdForOrganization(
    organizationId: string,
  ): Promise<string | null>;
}
